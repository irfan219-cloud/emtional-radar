import { BaseRepository, QueryOptions, WhereCondition } from './BaseRepository';
import {
  FeedbackData,
  FeedbackWithAnalysis,
  FeedbackFilters,
  Platform,
  PaginationOptions,
  PaginatedResponse
} from '@/types/feedback';

export class FeedbackRepository extends BaseRepository<FeedbackData> {
  constructor() {
    super('feedback', 'id');
  }

  /**
   * Find feedback by external ID and platform
   */
  async findByExternalId(externalId: string, platform: Platform): Promise<FeedbackData | null> {
    return await this.findOne({
      where: [
        { field: 'external_id', operator: '=', value: externalId },
        { field: 'platform', operator: '=', value: platform }
      ]
    });
  }

  /**
   * Find feedback with analysis, response, and alert data
   */
  async findWithAnalysis(id: string): Promise<FeedbackWithAnalysis | null> {
    const result = await this.raw(
      `SELECT 
        f.id, f.platform, f.external_id, f.content, f.author_username, 
        f.author_follower_count, f.author_verified, f.likes, f.shares, 
        f.comments, f.posted_at, f.ingested_at, f.metadata,
        a.id as analysis_id, a.sentiment, a.sentiment_confidence, a.emotions,
        a.virality_score, a.virality_factors, a.risk_level, a.processed_at,
        r.id as response_id, r.drafts, r.selected_draft, r.sent_at, 
        r.sent_to, r.status as response_status, r.created_at as response_created_at,
        al.id as alert_id, al.severity, al.message, al.sent_slack, al.sent_email,
        al.resolved, al.created_at as alert_created_at, al.resolved_at
       FROM feedback f
       LEFT JOIN analysis a ON f.id = a.feedback_id
       LEFT JOIN responses r ON f.id = r.feedback_id
       LEFT JOIN alerts al ON f.id = al.feedback_id
       WHERE f.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToFeedbackWithAnalysis(result.rows[0]);
  }

  /**
   * Find multiple feedback entries with analysis data
   */
  async findManyWithAnalysis(filters: FeedbackFilters = {}): Promise<FeedbackWithAnalysis[]> {
    const { whereClause, params } = this.buildFeedbackFilters(filters);

    const result = await this.raw(
      `SELECT DISTINCT
        f.id, f.platform, f.external_id, f.content, f.author_username, 
        f.author_follower_count, f.author_verified, f.likes, f.shares, 
        f.comments, f.posted_at, f.ingested_at, f.metadata,
        a.id as analysis_id, a.sentiment, a.sentiment_confidence, a.emotions,
        a.virality_score, a.virality_factors, a.risk_level, a.processed_at,
        r.id as response_id, r.drafts, r.selected_draft, r.sent_at, 
        r.sent_to, r.status as response_status, r.created_at as response_created_at,
        al.id as alert_id, al.severity, al.message, al.sent_slack, al.sent_email,
        al.resolved, al.created_at as alert_created_at, al.resolved_at
       FROM feedback f
       LEFT JOIN analysis a ON f.id = a.feedback_id
       LEFT JOIN responses r ON f.id = r.feedback_id
       LEFT JOIN alerts al ON f.id = al.feedback_id
       ${whereClause}
       ORDER BY f.ingested_at DESC`,
      params
    );

    return result.rows.map((row: any) => this.mapRowToFeedbackWithAnalysis(row));
  }

  /**
   * Find paginated feedback with analysis data and filters
   */
  async findPaginatedWithAnalysis(
    filters: FeedbackFilters = {},
    pagination: PaginationOptions = { page: 1, limit: 50 }
  ): Promise<PaginatedResponse<FeedbackWithAnalysis>> {
    const { whereClause, params } = this.buildFeedbackFilters(filters);

    // Get total count
    const countResult = await this.raw(
      `SELECT COUNT(DISTINCT f.id) as total
       FROM feedback f
       LEFT JOIN analysis a ON f.id = a.feedback_id
       LEFT JOIN alerts al ON f.id = al.feedback_id
       ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].total);
    const offset = (pagination.page - 1) * pagination.limit;

    // Build ORDER BY clause
    const sortBy = pagination.sort_by || 'ingested_at';
    const sortOrder = pagination.sort_order || 'desc';
    const orderClause = `ORDER BY f.${sortBy} ${sortOrder.toUpperCase()}`;

    // Get paginated data
    const dataResult = await this.raw(
      `SELECT DISTINCT
        f.id, f.platform, f.external_id, f.content, f.author_username, 
        f.author_follower_count, f.author_verified, f.likes, f.shares, 
        f.comments, f.posted_at, f.ingested_at, f.metadata,
        a.id as analysis_id, a.sentiment, a.sentiment_confidence, a.emotions,
        a.virality_score, a.virality_factors, a.risk_level, a.processed_at,
        r.id as response_id, r.drafts, r.selected_draft, r.sent_at, 
        r.sent_to, r.status as response_status, r.created_at as response_created_at,
        al.id as alert_id, al.severity, al.message, al.sent_slack, al.sent_email,
        al.resolved, al.created_at as alert_created_at, al.resolved_at
       FROM feedback f
       LEFT JOIN analysis a ON f.id = a.feedback_id
       LEFT JOIN responses r ON f.id = r.feedback_id
       LEFT JOIN alerts al ON f.id = al.feedback_id
       ${whereClause}
       ${orderClause}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pagination.limit, offset]
    );

    const data = dataResult.rows.map((row: any) => this.mapRowToFeedbackWithAnalysis(row));

    return {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        total_pages: Math.ceil(total / pagination.limit),
        has_next: pagination.page * pagination.limit < total,
        has_prev: pagination.page > 1
      }
    };
  }

  /**
   * Get recent feedback for live feed
   */
  async getRecentFeedback(limit: number = 50): Promise<FeedbackWithAnalysis[]> {
    const result = await this.raw(
      `SELECT 
        f.id, f.platform, f.external_id, f.content, f.author_username, 
        f.author_follower_count, f.author_verified, f.likes, f.shares, 
        f.comments, f.posted_at, f.ingested_at, f.metadata,
        a.id as analysis_id, a.sentiment, a.sentiment_confidence, a.emotions,
        a.virality_score, a.virality_factors, a.risk_level, a.processed_at
       FROM feedback f
       LEFT JOIN analysis a ON f.id = a.feedback_id
       ORDER BY f.ingested_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row: any) => this.mapRowToFeedbackWithAnalysis(row));
  }

  /**
   * Update engagement metrics
   */
  async updateEngagement(id: string, likes: number, shares: number, comments: number): Promise<FeedbackData | null> {
    return await this.update(id, { likes, shares, comments } as any);
  }

  /**
   * Get feedback by platform
   */
  async findByPlatform(platform: Platform, limit?: number): Promise<FeedbackData[]> {
    const options: QueryOptions = {
      where: [{ field: 'platform', operator: '=', value: platform }],
      orderBy: [{ field: 'ingested_at', direction: 'DESC' }]
    };

    const result = await this.findMany(options);

    if (limit) {
      return result.slice(0, limit);
    }

    return result;
  }

  /**
   * Get feedback without analysis
   */
  async findUnanalyzed(limit: number = 100): Promise<FeedbackData[]> {
    const result = await this.raw(
      `SELECT f.id, f.platform, f.external_id, f.content, f.author_username, 
              f.author_follower_count, f.author_verified, f.likes, f.shares, 
              f.comments, f.posted_at, f.ingested_at, f.metadata
       FROM feedback f
       LEFT JOIN analysis a ON f.id = a.feedback_id
       WHERE a.id IS NULL
       ORDER BY f.ingested_at ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * Build WHERE clause for feedback filters
   */
  private buildFeedbackFilters(filters: FeedbackFilters): { whereClause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.platform && filters.platform.length > 0) {
      conditions.push(`f.platform = ANY($${paramIndex})`);
      params.push(filters.platform);
      paramIndex++;
    }

    if (filters.sentiment && filters.sentiment.length > 0) {
      conditions.push(`a.sentiment = ANY($${paramIndex})`);
      params.push(filters.sentiment);
      paramIndex++;
    }

    if (filters.risk_level && filters.risk_level.length > 0) {
      conditions.push(`a.risk_level = ANY($${paramIndex})`);
      params.push(filters.risk_level);
      paramIndex++;
    }

    if (filters.date_from) {
      conditions.push(`f.ingested_at >= $${paramIndex}`);
      params.push(filters.date_from);
      paramIndex++;
    }

    if (filters.date_to) {
      conditions.push(`f.ingested_at <= $${paramIndex}`);
      params.push(filters.date_to);
      paramIndex++;
    }

    if (filters.has_alert !== undefined) {
      if (filters.has_alert) {
        conditions.push('al.id IS NOT NULL');
      } else {
        conditions.push('al.id IS NULL');
      }
    }

    if (filters.min_virality_score !== undefined) {
      conditions.push(`a.virality_score >= $${paramIndex}`);
      params.push(filters.min_virality_score);
      paramIndex++;
    }

    if (filters.max_virality_score !== undefined) {
      conditions.push(`a.virality_score <= $${paramIndex}`);
      params.push(filters.max_virality_score);
      paramIndex++;
    }

    if (filters.emotions && filters.emotions.length > 0) {
      // Check if any of the specified emotions exist in the emotions JSONB array
      const emotionConditions = filters.emotions.map(emotion => {
        const condition = `a.emotions @> '[{"emotion": "${emotion}"}]'`;
        return condition;
      });
      conditions.push(`(${emotionConditions.join(' OR ')})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params };
  }

  /**
   * Map database row to FeedbackData
   */
  protected mapRowToEntity(row: any): FeedbackData {
    return {
      id: row.id,
      platform: row.platform,
      external_id: row.external_id,
      content: row.content,
      author: {
        username: row.author_username,
        followerCount: row.author_follower_count,
        verified: row.author_verified
      },
      engagement: {
        likes: row.likes || 0,
        shares: row.shares || 0,
        comments: row.comments || 0
      },
      posted_at: row.posted_at,
      ingested_at: row.ingested_at,
      metadata: row.metadata
    };
  }

  /**
   * Map database row to FeedbackWithAnalysis
   */
  private mapRowToFeedbackWithAnalysis(row: any): FeedbackWithAnalysis {
    const feedback = this.mapRowToEntity(row);
    const result: FeedbackWithAnalysis = { ...feedback };

    // Add analysis if present
    if (row.analysis_id) {
      result.analysis = {
        id: row.analysis_id,
        feedback_id: row.id,
        sentiment: {
          label: row.sentiment,
          confidence: parseFloat(row.sentiment_confidence || 0)
        },
        emotions: row.emotions || [],
        virality_score: row.virality_score || 0,
        virality_factors: row.virality_factors || {},
        risk_level: row.risk_level,
        processed_at: row.processed_at
      };
    }

    // Add response if present
    if (row.response_id) {
      result.response = {
        id: row.response_id,
        feedback_id: row.id,
        drafts: row.drafts || [],
        selected_draft: row.selected_draft,
        sent_at: row.sent_at,
        sent_to: row.sent_to,
        status: row.response_status,
        created_at: row.response_created_at
      };
    }

    // Add alert if present
    if (row.alert_id) {
      result.alert = {
        id: row.alert_id,
        feedback_id: row.id,
        severity: row.severity,
        message: row.message,
        sent_slack: row.sent_slack,
        sent_email: row.sent_email,
        resolved: row.resolved,
        created_at: row.alert_created_at,
        resolved_at: row.resolved_at
      };
    }

    return result;
  }

  /**
   * Find recent feedback without analysis
   */
  async findRecentWithoutAnalysis(since: Date, limit: number = 100): Promise<FeedbackData[]> {
    const result = await this.raw(
      `SELECT f.* FROM feedback f
       LEFT JOIN analysis a ON f.id = a.feedback_id
       WHERE f.ingested_at >= $1 AND a.id IS NULL
       ORDER BY f.ingested_at DESC
       LIMIT $2`,
      [since, limit]
    );

    return result.rows.map((row: Record<string, any>) => this.mapRowToEntity(row));
  }
}