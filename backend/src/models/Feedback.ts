import { query, transaction } from '@/utils/database';
import { 
  FeedbackData, 
  FeedbackWithAnalysis, 
  FeedbackFilters, 
  PaginationOptions, 
  PaginatedResponse,
  Platform,
  FeedbackAuthor,
  FeedbackEngagement,
  FeedbackMetadata
} from '@/types/feedback';

export class FeedbackModel {
  /**
   * Create a new feedback entry
   */
  static async create(feedbackData: Omit<FeedbackData, 'id' | 'ingested_at'>): Promise<FeedbackData> {
    const result = await query(
      `INSERT INTO feedback (
        platform, external_id, content, author_username, author_follower_count, 
        author_verified, likes, shares, comments, posted_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, platform, external_id, content, author_username, 
                author_follower_count, author_verified, likes, shares, 
                comments, posted_at, ingested_at, metadata`,
      [
        feedbackData.platform,
        feedbackData.external_id,
        feedbackData.content,
        feedbackData.author.username,
        feedbackData.author.followerCount || null,
        feedbackData.author.verified || false,
        feedbackData.engagement.likes,
        feedbackData.engagement.shares,
        feedbackData.engagement.comments,
        feedbackData.posted_at || null,
        feedbackData.metadata || null
      ]
    );

    return this.mapRowToFeedback(result.rows[0]);
  }

  /**
   * Get feedback by ID
   */
  static async findById(id: string): Promise<FeedbackData | null> {
    const result = await query(
      `SELECT id, platform, external_id, content, author_username, 
              author_follower_count, author_verified, likes, shares, 
              comments, posted_at, ingested_at, metadata
       FROM feedback WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToFeedback(result.rows[0]);
  }

  /**
   * Get feedback by external ID and platform
   */
  static async findByExternalId(externalId: string, platform: Platform): Promise<FeedbackData | null> {
    const result = await query(
      `SELECT id, platform, external_id, content, author_username, 
              author_follower_count, author_verified, likes, shares, 
              comments, posted_at, ingested_at, metadata
       FROM feedback WHERE external_id = $1 AND platform = $2`,
      [externalId, platform]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToFeedback(result.rows[0]);
  }

  /**
   * Get feedback with analysis and response data
   */
  static async findWithAnalysis(id: string): Promise<FeedbackWithAnalysis | null> {
    const result = await query(
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
   * Get paginated feedback with filters
   */
  static async findMany(
    filters: FeedbackFilters = {}, 
    pagination: PaginationOptions = { page: 1, limit: 50 }
  ): Promise<PaginatedResponse<FeedbackWithAnalysis>> {
    const { whereClause, params } = this.buildWhereClause(filters);
    const offset = (pagination.page - 1) * pagination.limit;
    
    // Build ORDER BY clause
    const sortBy = pagination.sort_by || 'ingested_at';
    const sortOrder = pagination.sort_order || 'desc';
    const orderClause = `ORDER BY f.${sortBy} ${sortOrder.toUpperCase()}`;

    // Get total count
    const countResult = await query(
      `SELECT COUNT(DISTINCT f.id) as total
       FROM feedback f
       LEFT JOIN analysis a ON f.id = a.feedback_id
       LEFT JOIN alerts al ON f.id = al.feedback_id
       ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].total);

    // Get paginated data
    const dataResult = await query(
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

    const data = dataResult.rows.map(row => this.mapRowToFeedbackWithAnalysis(row));

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
   * Update feedback engagement metrics
   */
  static async updateEngagement(id: string, engagement: FeedbackEngagement): Promise<FeedbackData | null> {
    const result = await query(
      `UPDATE feedback 
       SET likes = $1, shares = $2, comments = $3
       WHERE id = $4
       RETURNING id, platform, external_id, content, author_username, 
                 author_follower_count, author_verified, likes, shares, 
                 comments, posted_at, ingested_at, metadata`,
      [engagement.likes, engagement.shares, engagement.comments, id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToFeedback(result.rows[0]);
  }

  /**
   * Delete feedback and related data
   */
  static async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM feedback WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  /**
   * Get recent feedback for live feed
   */
  static async getRecentFeedback(limit: number = 50): Promise<FeedbackWithAnalysis[]> {
    const result = await query(
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

    return result.rows.map(row => this.mapRowToFeedbackWithAnalysis(row));
  }

  /**
   * Build WHERE clause for filtering
   */
  private static buildWhereClause(filters: FeedbackFilters): { whereClause: string; params: any[] } {
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params };
  }

  /**
   * Map database row to FeedbackData
   */
  private static mapRowToFeedback(row: any): FeedbackData {
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
        likes: row.likes,
        shares: row.shares,
        comments: row.comments
      },
      posted_at: row.posted_at,
      ingested_at: row.ingested_at,
      metadata: row.metadata
    };
  }

  /**
   * Map database row to FeedbackWithAnalysis
   */
  private static mapRowToFeedbackWithAnalysis(row: any): FeedbackWithAnalysis {
    const feedback = this.mapRowToFeedback(row);
    
    const result: FeedbackWithAnalysis = { ...feedback };

    // Add analysis if present
    if (row.analysis_id) {
      result.analysis = {
        id: row.analysis_id,
        feedback_id: row.id,
        sentiment: {
          label: row.sentiment,
          confidence: parseFloat(row.sentiment_confidence)
        },
        emotions: row.emotions || [],
        virality_score: row.virality_score,
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
}