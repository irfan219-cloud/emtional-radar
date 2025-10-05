import { query } from '@/utils/database';
import { 
  AnalysisResult, 
  Sentiment, 
  Emotion, 
  ViralityFactors, 
  RiskLevel,
  SentimentStats,
  EmotionStats,
  TimeSeriesData
} from '@/types/feedback';

export class AnalysisModel {
  /**
   * Create a new analysis result
   */
  static async create(analysisData: Omit<AnalysisResult, 'id' | 'processed_at'>): Promise<AnalysisResult> {
    const result = await query(
      `INSERT INTO analysis (
        feedback_id, sentiment, sentiment_confidence, emotions, 
        virality_score, virality_factors, risk_level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, feedback_id, sentiment, sentiment_confidence, emotions,
                virality_score, virality_factors, risk_level, processed_at`,
      [
        analysisData.feedback_id,
        analysisData.sentiment.label,
        analysisData.sentiment.confidence,
        JSON.stringify(analysisData.emotions),
        analysisData.virality_score,
        JSON.stringify(analysisData.virality_factors),
        analysisData.risk_level
      ]
    );

    return this.mapRowToAnalysis(result.rows[0]);
  }

  /**
   * Get analysis by ID
   */
  static async findById(id: string): Promise<AnalysisResult | null> {
    const result = await query(
      `SELECT id, feedback_id, sentiment, sentiment_confidence, emotions,
              virality_score, virality_factors, risk_level, processed_at
       FROM analysis WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToAnalysis(result.rows[0]);
  }

  /**
   * Get analysis by feedback ID
   */
  static async findByFeedbackId(feedbackId: string): Promise<AnalysisResult | null> {
    const result = await query(
      `SELECT id, feedback_id, sentiment, sentiment_confidence, emotions,
              virality_score, virality_factors, risk_level, processed_at
       FROM analysis WHERE feedback_id = $1`,
      [feedbackId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToAnalysis(result.rows[0]);
  }

  /**
   * Update analysis result
   */
  static async update(id: string, updates: Partial<Omit<AnalysisResult, 'id' | 'feedback_id' | 'processed_at'>>): Promise<AnalysisResult | null> {
    const setClause: string[] = [];
    const params: any[] = [id];
    let paramIndex = 2;

    if (updates.sentiment) {
      setClause.push(`sentiment = $${paramIndex}, sentiment_confidence = $${paramIndex + 1}`);
      params.push(updates.sentiment.label, updates.sentiment.confidence);
      paramIndex += 2;
    }

    if (updates.emotions) {
      setClause.push(`emotions = $${paramIndex}`);
      params.push(JSON.stringify(updates.emotions));
      paramIndex++;
    }

    if (updates.virality_score !== undefined) {
      setClause.push(`virality_score = $${paramIndex}`);
      params.push(updates.virality_score);
      paramIndex++;
    }

    if (updates.virality_factors) {
      setClause.push(`virality_factors = $${paramIndex}`);
      params.push(JSON.stringify(updates.virality_factors));
      paramIndex++;
    }

    if (updates.risk_level) {
      setClause.push(`risk_level = $${paramIndex}`);
      params.push(updates.risk_level);
      paramIndex++;
    }

    if (setClause.length === 0) {
      throw new Error('No fields to update');
    }

    const result = await query(
      `UPDATE analysis 
       SET ${setClause.join(', ')}
       WHERE id = $1
       RETURNING id, feedback_id, sentiment, sentiment_confidence, emotions,
                 virality_score, virality_factors, risk_level, processed_at`,
      params
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToAnalysis(result.rows[0]);
  }

  /**
   * Delete analysis
   */
  static async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM analysis WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  /**
   * Get sentiment statistics for a date range
   */
  static async getSentimentStats(dateFrom?: Date, dateTo?: Date): Promise<SentimentStats> {
    let whereClause = '';
    const params: any[] = [];

    if (dateFrom || dateTo) {
      const conditions: string[] = [];
      let paramIndex = 1;

      if (dateFrom) {
        conditions.push(`a.processed_at >= $${paramIndex}`);
        params.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        conditions.push(`a.processed_at <= $${paramIndex}`);
        params.push(dateTo);
        paramIndex++;
      }

      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    const result = await query(
      `SELECT 
        sentiment,
        COUNT(*) as count
       FROM analysis a
       ${whereClause}
       GROUP BY sentiment`,
      params
    );

    const stats: SentimentStats = {
      positive: 0,
      neutral: 0,
      negative: 0,
      total: 0
    };

    result.rows.forEach(row => {
      const count = parseInt(row.count);
      stats[row.sentiment as keyof SentimentStats] = count;
      stats.total += count;
    });

    return stats;
  }

  /**
   * Get emotion statistics for a date range
   */
  static async getEmotionStats(dateFrom?: Date, dateTo?: Date): Promise<EmotionStats> {
    let whereClause = '';
    const params: any[] = [];

    if (dateFrom || dateTo) {
      const conditions: string[] = [];
      let paramIndex = 1;

      if (dateFrom) {
        conditions.push(`a.processed_at >= $${paramIndex}`);
        params.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        conditions.push(`a.processed_at <= $${paramIndex}`);
        params.push(dateTo);
        paramIndex++;
      }

      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    const result = await query(
      `SELECT emotions
       FROM analysis a
       ${whereClause}`,
      params
    );

    const emotionCounts: EmotionStats = {};

    result.rows.forEach(row => {
      const emotions: Emotion[] = row.emotions || [];
      emotions.forEach(emotion => {
        emotionCounts[emotion.emotion] = (emotionCounts[emotion.emotion] || 0) + 1;
      });
    });

    return emotionCounts;
  }

  /**
   * Get time series data for dashboard charts
   */
  static async getTimeSeriesData(
    dateFrom: Date, 
    dateTo: Date, 
    interval: 'hour' | 'day' | 'week' = 'hour'
  ): Promise<TimeSeriesData[]> {
    const dateFormat = interval === 'hour' ? 'YYYY-MM-DD HH24:00:00' : 
                      interval === 'day' ? 'YYYY-MM-DD' : 'YYYY-"W"WW';

    const result = await query(
      `SELECT 
        DATE_TRUNC('${interval}', a.processed_at) as time_bucket,
        a.sentiment,
        a.emotions,
        a.virality_score,
        COUNT(*) as feedback_count,
        COUNT(al.id) as alert_count
       FROM analysis a
       LEFT JOIN alerts al ON a.feedback_id = al.feedback_id
       WHERE a.processed_at >= $1 AND a.processed_at <= $2
       GROUP BY time_bucket, a.sentiment, a.emotions, a.virality_score
       ORDER BY time_bucket`,
      [dateFrom, dateTo]
    );

    // Group by time bucket and aggregate data
    const timeSeriesMap = new Map<string, TimeSeriesData>();

    result.rows.forEach(row => {
      const timestamp = new Date(row.time_bucket);
      const key = timestamp.toISOString();

      if (!timeSeriesMap.has(key)) {
        timeSeriesMap.set(key, {
          timestamp,
          sentiment_stats: { positive: 0, neutral: 0, negative: 0, total: 0 },
          emotion_stats: {},
          virality_avg: 0,
          alert_count: 0
        });
      }

      const data = timeSeriesMap.get(key)!;
      const count = parseInt(row.feedback_count);
      
      // Update sentiment stats
      data.sentiment_stats[row.sentiment as keyof SentimentStats] += count;
      data.sentiment_stats.total += count;

      // Update emotion stats
      const emotions: Emotion[] = row.emotions || [];
      emotions.forEach(emotion => {
        data.emotion_stats[emotion.emotion] = (data.emotion_stats[emotion.emotion] || 0) + 1;
      });

      // Update virality average (will be calculated properly later)
      data.virality_avg += row.virality_score * count;
      data.alert_count += parseInt(row.alert_count);
    });

    // Calculate proper averages and return sorted array
    return Array.from(timeSeriesMap.values())
      .map(data => ({
        ...data,
        virality_avg: data.sentiment_stats.total > 0 ? data.virality_avg / data.sentiment_stats.total : 0
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get high-risk analysis results
   */
  static async getHighRiskAnalysis(limit: number = 50): Promise<AnalysisResult[]> {
    const result = await query(
      `SELECT id, feedback_id, sentiment, sentiment_confidence, emotions,
              virality_score, virality_factors, risk_level, processed_at
       FROM analysis 
       WHERE risk_level IN ('high', 'viral-threat')
       ORDER BY virality_score DESC, processed_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => this.mapRowToAnalysis(row));
  }

  /**
   * Get analysis results pending alert processing
   */
  static async getPendingAlerts(): Promise<AnalysisResult[]> {
    const result = await query(
      `SELECT a.id, a.feedback_id, a.sentiment, a.sentiment_confidence, a.emotions,
              a.virality_score, a.virality_factors, a.risk_level, a.processed_at
       FROM analysis a
       LEFT JOIN alerts al ON a.feedback_id = al.feedback_id
       WHERE a.risk_level IN ('high', 'viral-threat') AND al.id IS NULL
       ORDER BY a.virality_score DESC, a.processed_at DESC`
    );

    return result.rows.map(row => this.mapRowToAnalysis(row));
  }

  /**
   * Map database row to AnalysisResult
   */
  private static mapRowToAnalysis(row: any): AnalysisResult {
    return {
      id: row.id,
      feedback_id: row.feedback_id,
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
}