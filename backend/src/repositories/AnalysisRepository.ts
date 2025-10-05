import { BaseRepository, QueryOptions } from './BaseRepository';
import { 
  AnalysisResult, 
  SentimentStats, 
  EmotionStats, 
  EmotionType,
  TimeSeriesData,
  PlatformStats,
  Platform
} from '@/types/feedback';

export class AnalysisRepository extends BaseRepository<AnalysisResult> {
  constructor() {
    super('analysis', 'id');
  }

  /**
   * Find analysis by feedback ID
   */
  async findByFeedbackId(feedbackId: string): Promise<AnalysisResult | null> {
    return await this.findOne({
      where: [{ field: 'feedback_id', operator: '=', value: feedbackId }]
    });
  }

  /**
   * Get sentiment statistics for a date range
   */
  async getSentimentStats(dateFrom?: Date, dateTo?: Date): Promise<SentimentStats> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (dateFrom) {
      conditions.push(`processed_at >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      conditions.push(`processed_at <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.raw(
      `SELECT 
        sentiment,
        COUNT(*) as count
       FROM analysis
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

    result.rows.forEach((row: any) => {
      const count = parseInt(row.count);
      stats[row.sentiment as keyof SentimentStats] = count;
      stats.total += count;
    });

    return stats;
  }

  /**
   * Get emotion statistics for a date range
   */
  async getEmotionStats(dateFrom?: Date, dateTo?: Date): Promise<EmotionStats> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (dateFrom) {
      conditions.push(`processed_at >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      conditions.push(`processed_at <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.raw(
      `SELECT emotions FROM analysis ${whereClause}`,
      params
    );

    const emotionCounts: EmotionStats = {};

    result.rows.forEach((row: any) => {
      const emotions = row.emotions || [];
      emotions.forEach((emotion: any) => {
        const emotionType = emotion.emotion as EmotionType;
        emotionCounts[emotionType] = (emotionCounts[emotionType] || 0) + 1;
      });
    });

    return emotionCounts;
  }

  /**
   * Get platform statistics
   */
  async getPlatformStats(dateFrom?: Date, dateTo?: Date): Promise<PlatformStats[]> {
    const conditions: string[] = [];
    const params: any[] = [];
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.raw(
      `SELECT 
        f.platform,
        a.sentiment,
        COUNT(*) as count,
        AVG(a.virality_score) as avg_virality
       FROM analysis a
       JOIN feedback f ON a.feedback_id = f.id
       ${whereClause}
       GROUP BY f.platform, a.sentiment
       ORDER BY f.platform, a.sentiment`,
      params
    );

    // Group by platform and aggregate sentiment data
    const platformMap = new Map<Platform, PlatformStats>();

    result.rows.forEach((row: any) => {
      const platform = row.platform as Platform;
      const sentiment = row.sentiment;
      const count = parseInt(row.count);
      const avgVirality = parseFloat(row.avg_virality);

      if (!platformMap.has(platform)) {
        platformMap.set(platform, {
          platform,
          count: 0,
          sentiment_breakdown: { positive: 0, neutral: 0, negative: 0, total: 0 },
          avg_virality_score: 0
        });
      }

      const stats = platformMap.get(platform)!;
      stats.count += count;
      stats.sentiment_breakdown[sentiment as keyof SentimentStats] += count;
      stats.sentiment_breakdown.total += count;
      stats.avg_virality_score = avgVirality; // This will be recalculated properly below
    });

    // Calculate proper average virality scores
    for (const [platform, stats] of platformMap) {
      const viralityResult = await this.raw(
        `SELECT AVG(a.virality_score) as avg_virality
         FROM analysis a
         JOIN feedback f ON a.feedback_id = f.id
         WHERE f.platform = $1 ${dateFrom ? 'AND a.processed_at >= $2' : ''} ${dateTo ? `AND a.processed_at <= $${dateFrom ? 3 : 2}` : ''}`,
        [platform, ...(dateFrom ? [dateFrom] : []), ...(dateTo ? [dateTo] : [])]
      );

      stats.avg_virality_score = parseFloat(viralityResult.rows[0]?.avg_virality || 0);
    }

    return Array.from(platformMap.values());
  }

  /**
   * Get time series data for dashboard charts
   */
  async getTimeSeriesData(
    dateFrom: Date,
    dateTo: Date,
    interval: 'hour' | 'day' | 'week' = 'hour'
  ): Promise<TimeSeriesData[]> {
    const result = await this.raw(
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

    result.rows.forEach((row: any) => {
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
      const emotions = row.emotions || [];
      emotions.forEach((emotion: any) => {
        const emotionType = emotion.emotion as EmotionType;
        data.emotion_stats[emotionType] = (data.emotion_stats[emotionType] || 0) + 1;
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
  async getHighRiskAnalysis(limit: number = 50): Promise<AnalysisResult[]> {
    return await this.findMany({
      where: [
        { field: 'risk_level', operator: 'IN', value: ['high', 'viral-threat'] }
      ],
      orderBy: [
        { field: 'virality_score', direction: 'DESC' },
        { field: 'processed_at', direction: 'DESC' }
      ]
    });
  }

  /**
   * Get analysis results pending alert processing
   */
  async getPendingAlerts(): Promise<AnalysisResult[]> {
    const result = await this.raw(
      `SELECT a.id, a.feedback_id, a.sentiment, a.sentiment_confidence, a.emotions,
              a.virality_score, a.virality_factors, a.risk_level, a.processed_at
       FROM analysis a
       LEFT JOIN alerts al ON a.feedback_id = al.feedback_id
       WHERE a.risk_level IN ('high', 'viral-threat') AND al.id IS NULL
       ORDER BY a.virality_score DESC, a.processed_at DESC`
    );

    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * Get analysis results by risk level
   */
  async findByRiskLevel(riskLevel: string, limit?: number): Promise<AnalysisResult[]> {
    const options: QueryOptions = {
      where: [{ field: 'risk_level', operator: '=', value: riskLevel }],
      orderBy: [{ field: 'processed_at', direction: 'DESC' }]
    };

    const results = await this.findMany(options);
    
    if (limit) {
      return results.slice(0, limit);
    }
    
    return results;
  }

  /**
   * Get analysis results by sentiment
   */
  async findBySentiment(sentiment: string, limit?: number): Promise<AnalysisResult[]> {
    const options: QueryOptions = {
      where: [{ field: 'sentiment', operator: '=', value: sentiment }],
      orderBy: [{ field: 'processed_at', direction: 'DESC' }]
    };

    const results = await this.findMany(options);
    
    if (limit) {
      return results.slice(0, limit);
    }
    
    return results;
  }

  /**
   * Get average virality score for a date range
   */
  async getAverageViralityScore(dateFrom?: Date, dateTo?: Date): Promise<number> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (dateFrom) {
      conditions.push(`processed_at >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      conditions.push(`processed_at <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.raw(
      `SELECT AVG(virality_score) as avg_score FROM analysis ${whereClause}`,
      params
    );

    return parseFloat(result.rows[0]?.avg_score || 0);
  }

  /**
   * Map database row to AnalysisResult
   */
  protected mapRowToEntity(row: any): AnalysisResult {
    return {
      id: row.id,
      feedback_id: row.feedback_id,
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

  /**
   * Find analyses in date range
   */
  async findInDateRange(dateFrom: Date, dateTo: Date): Promise<AnalysisResult[]> {
    return await this.findMany({
      where: [
        { field: 'processed_at', operator: '>=' as const, value: dateFrom },
        { field: 'processed_at', operator: '<=' as const, value: dateTo }
      ],
      orderBy: [{ field: 'processed_at', direction: 'DESC' }]
    });
  }
}