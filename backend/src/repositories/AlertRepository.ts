import { BaseRepository, QueryOptions, WhereCondition } from './BaseRepository';
import { AlertData, AlertSeverity, AlertFilters, PaginationOptions, PaginatedResponse } from '@/types/feedback';

export class AlertRepository extends BaseRepository<AlertData> {
  constructor() {
    super('alerts', 'id');
  }

  /**
   * Find alert by feedback ID
   */
  async findByFeedbackId(feedbackId: string): Promise<AlertData | null> {
    return await this.findOne({
      where: [{ field: 'feedback_id', operator: '=' as const, value: feedbackId }]
    });
  }

  /**
   * Find alerts by severity
   */
  async findBySeverity(severity: AlertSeverity, limit?: number): Promise<AlertData[]> {
    const options: QueryOptions = {
      where: [{ field: 'severity', operator: '=' as const, value: severity }],
      orderBy: [{ field: 'created_at', direction: 'DESC' }]
    };

    const results = await this.findMany(options);
    
    if (limit) {
      return results.slice(0, limit);
    }
    
    return results;
  }

  /**
   * Get active (unresolved) alerts
   */
  async getActiveAlerts(limit: number = 50): Promise<AlertData[]> {
    const result = await this.raw(
      `SELECT * FROM alerts 
       WHERE resolved = $1 
       ORDER BY 
         CASE severity 
           WHEN 'viral-threat' THEN 1 
           WHEN 'risky' THEN 2 
           WHEN 'mild' THEN 3 
         END,
         created_at DESC 
       LIMIT $2`,
      [false, limit]
    );

    return result.rows.map((row: Record<string, any>) => this.mapRowToEntity(row));
  }

  /**
   * Get resolved alerts
   */
  async getResolvedAlerts(limit: number = 50): Promise<AlertData[]> {
    const result = await this.raw(
      `SELECT * FROM alerts 
       WHERE resolved = $1 
       ORDER BY resolved_at DESC 
       LIMIT $2`,
      [true, limit]
    );

    return result.rows.map((row: Record<string, any>) => this.mapRowToEntity(row));
  }

  /**
   * Find alerts with filters and pagination
   */
  async findWithFilters(
    filters: AlertFilters = {},
    pagination: PaginationOptions = { page: 1, limit: 50 }
  ): Promise<PaginatedResponse<AlertData>> {
    const { whereClause, params } = this.buildAlertFilters(filters);
    
    // Get total count
    const countResult = await this.raw(
      `SELECT COUNT(*) as total FROM alerts a ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].total);
    const offset = (pagination.page - 1) * pagination.limit;

    // Build ORDER BY clause
    const sortBy = pagination.sort_by || 'created_at';
    const sortOrder = pagination.sort_order || 'desc';
    const orderClause = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

    // Get paginated data
    const dataResult = await this.raw(
      `SELECT * FROM alerts a 
       ${whereClause}
       ${orderClause}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pagination.limit, offset]
    );

    const data = dataResult.rows.map((row: Record<string, any>) => this.mapRowToEntity(row));

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
   * Resolve an alert
   */
  async resolve(id: string): Promise<AlertData | null> {
    return await this.update(id, {
      resolved: true,
      resolved_at: new Date()
    } as any);
  }

  /**
   * Mark alert as sent to Slack
   */
  async markSlackSent(id: string): Promise<AlertData | null> {
    return await this.update(id, { sent_slack: true } as any);
  }

  /**
   * Mark alert as sent to email
   */
  async markEmailSent(id: string): Promise<AlertData | null> {
    return await this.update(id, { sent_email: true } as any);
  }

  /**
   * Get alerts with feedback data
   */
  async findWithFeedback(limit: number = 50): Promise<any[]> {
    const result = await this.raw(
      `SELECT 
        a.id, a.feedback_id, a.severity, a.message, a.sent_slack, a.sent_email,
        a.resolved, a.created_at, a.resolved_at,
        f.platform, f.content, f.author_username, f.ingested_at,
        an.sentiment, an.virality_score, an.risk_level
       FROM alerts a
       JOIN feedback f ON a.feedback_id = f.id
       LEFT JOIN analysis an ON f.id = an.feedback_id
       ORDER BY a.created_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row: Record<string, any>) => ({
      ...this.mapRowToEntity(row),
      feedback: {
        platform: row.platform,
        content: row.content,
        author_username: row.author_username,
        ingested_at: row.ingested_at
      },
      analysis: row.sentiment ? {
        sentiment: row.sentiment,
        virality_score: row.virality_score,
        risk_level: row.risk_level
      } : null
    }));
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(): Promise<{
    total: number;
    active: number;
    resolved: number;
    mild: number;
    risky: number;
    viral_threat: number;
    sent_slack: number;
    sent_email: number;
  }> {
    const result = await this.raw(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN resolved = false THEN 1 END) as active,
        COUNT(CASE WHEN resolved = true THEN 1 END) as resolved,
        COUNT(CASE WHEN severity = 'mild' THEN 1 END) as mild,
        COUNT(CASE WHEN severity = 'risky' THEN 1 END) as risky,
        COUNT(CASE WHEN severity = 'viral-threat' THEN 1 END) as viral_threat,
        COUNT(CASE WHEN sent_slack = true THEN 1 END) as sent_slack,
        COUNT(CASE WHEN sent_email = true THEN 1 END) as sent_email
      FROM alerts
    `);

    const row = result.rows[0];
    return {
      total: parseInt(row.total),
      active: parseInt(row.active),
      resolved: parseInt(row.resolved),
      mild: parseInt(row.mild),
      risky: parseInt(row.risky),
      viral_threat: parseInt(row.viral_threat),
      sent_slack: parseInt(row.sent_slack),
      sent_email: parseInt(row.sent_email)
    };
  }

  /**
   * Get high-priority alerts (risky and viral-threat)
   */
  async getHighPriorityAlerts(limit: number = 50): Promise<AlertData[]> {
    const result = await this.raw(
      `SELECT * FROM alerts 
       WHERE severity IN ('risky', 'viral-threat') 
         AND resolved = $1 
       ORDER BY 
         CASE severity 
           WHEN 'viral-threat' THEN 1 
           WHEN 'risky' THEN 2 
         END,
         created_at DESC 
       LIMIT $2`,
      [false, limit]
    );

    return result.rows.map((row: Record<string, any>) => this.mapRowToEntity(row));
  }

  /**
   * Get alerts pending notification
   */
  async getPendingNotifications(): Promise<AlertData[]> {
    return await this.findMany({
      where: [
        { field: 'resolved', operator: '=' as const, value: false },
        { field: 'sent_slack', operator: '=' as const, value: false },
        { field: 'sent_email', operator: '=' as const, value: false }
      ],
      orderBy: [
        { field: 'severity', direction: 'DESC' },
        { field: 'created_at', direction: 'ASC' }
      ]
    });
  }

  /**
   * Get alerts created in date range
   */
  async getAlertsInDateRange(dateFrom: Date, dateTo: Date): Promise<AlertData[]> {
    return await this.findMany({
      where: [
        { field: 'created_at', operator: '>=' as const, value: dateFrom },
        { field: 'created_at', operator: '<=' as const, value: dateTo }
      ],
      orderBy: [{ field: 'created_at', direction: 'DESC' }]
    });
  }

  /**
   * Build WHERE clause for alert filters
   */
  private buildAlertFilters(filters: AlertFilters): { whereClause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.severity && filters.severity.length > 0) {
      conditions.push(`a.severity = ANY($${paramIndex})`);
      params.push(filters.severity);
      paramIndex++;
    }

    if (filters.resolved !== undefined) {
      conditions.push(`a.resolved = $${paramIndex}`);
      params.push(filters.resolved);
      paramIndex++;
    }

    if (filters.date_from) {
      conditions.push(`a.created_at >= $${paramIndex}`);
      params.push(filters.date_from);
      paramIndex++;
    }

    if (filters.date_to) {
      conditions.push(`a.created_at <= $${paramIndex}`);
      params.push(filters.date_to);
      paramIndex++;
    }

    if (filters.platform && filters.platform.length > 0) {
      conditions.push(`f.platform = ANY($${paramIndex})`);
      params.push(filters.platform);
      paramIndex++;
      
      // Need to join with feedback table if filtering by platform
      if (!conditions.some(c => c.includes('JOIN feedback'))) {
        // This will be handled in the calling method by adding the join
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params };
  }

  /**
   * Map database row to AlertData
   */
  protected mapRowToEntity(row: Record<string, any>): AlertData {
    return {
      id: row.id,
      feedback_id: row.feedback_id,
      severity: row.severity,
      message: row.message,
      sent_slack: row.sent_slack,
      sent_email: row.sent_email,
      resolved: row.resolved,
      created_at: row.created_at,
      resolved_at: row.resolved_at
    };
  }
}