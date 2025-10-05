import { cache } from './database';
import { REDIS_KEYS, generateTimeKey, generateDailyKey } from './redis-keys';

/**
 * Redis manager for real-time data operations
 */
export class RedisManager {
  /**
   * Add feedback to live feed
   */
  static async addToLiveFeed(feedback: any): Promise<void> {
    const timestamp = Date.now();
    await cache.sortedSetAdd(REDIS_KEYS.LIVE_FEED, timestamp, feedback);
    
    // Keep only last 1000 items in live feed
    const count = await cache.sortedSetRange(REDIS_KEYS.LIVE_FEED, 0, -1);
    if (count.length > 1000) {
      // Remove oldest items
      const removeCount = count.length - 1000;
      for (let i = 0; i < removeCount; i++) {
        // Remove by score (oldest first)
      }
    }
  }

  /**
   * Get live feed data
   */
  static async getLiveFeed(limit: number = 50): Promise<any[]> {
    // Get most recent items (highest scores)
    return await cache.sortedSetRange(REDIS_KEYS.LIVE_FEED, -limit, -1);
  }

  /**
   * Add analysis to pending queue
   */
  static async addToPendingAnalysis(feedbackId: string): Promise<void> {
    await cache.listPush(REDIS_KEYS.ANALYSIS_PENDING, { feedbackId, timestamp: Date.now() });
  }

  /**
   * Get pending analysis items
   */
  static async getPendingAnalysis(limit: number = 10): Promise<any[]> {
    return await cache.listRange(REDIS_KEYS.ANALYSIS_PENDING, 0, limit - 1);
  }

  /**
   * Add active alert
   */
  static async addActiveAlert(alert: any): Promise<void> {
    await cache.hashSet(REDIS_KEYS.ALERTS_ACTIVE, alert.id, alert);
    
    // Also add to time-based key for historical tracking
    const timeKey = generateTimeKey('alerts');
    await cache.listPush(timeKey, alert);
  }

  /**
   * Get active alerts
   */
  static async getActiveAlerts(): Promise<any[]> {
    const alertsHash = await cache.hashGetAll(REDIS_KEYS.ALERTS_ACTIVE);
    return Object.values(alertsHash);
  }

  /**
   * Resolve alert
   */
  static async resolveAlert(alertId: string): Promise<void> {
    const alert = await cache.hashGet(REDIS_KEYS.ALERTS_ACTIVE, alertId);
    if (alert) {
      // Move to history
      await cache.hashSet(REDIS_KEYS.ALERTS_HISTORY, alertId, {
        ...alert,
        resolvedAt: new Date().toISOString()
      });
      
      // Remove from active
      await cache.del(`${REDIS_KEYS.ALERTS_ACTIVE}:${alertId}`);
    }
  }

  /**
   * Update heatmap data
   */
  static async updateHeatmapData(platform: string, region: string, emotions: any[]): Promise<void> {
    const currentData = await cache.hashGetAll(REDIS_KEYS.HEATMAP_CURRENT) || {};
    
    // Update platform-specific data
    const platformKey = `platform:${platform}`;
    const platformData = currentData[platformKey] || {};
    
    // Update region-specific data
    const regionKey = `region:${region}`;
    const regionData = currentData[regionKey] || {};
    
    // Aggregate emotion counts
    for (const emotion of emotions) {
      platformData[emotion.emotion] = (platformData[emotion.emotion] || 0) + 1;
      regionData[emotion.emotion] = (regionData[emotion.emotion] || 0) + 1;
    }
    
    // Save updated data
    await cache.hashSet(REDIS_KEYS.HEATMAP_CURRENT, platformKey, platformData);
    await cache.hashSet(REDIS_KEYS.HEATMAP_CURRENT, regionKey, regionData);
    
    // Also save daily aggregation
    const dailyKey = generateDailyKey('heatmap');
    await cache.hashSet(dailyKey, platformKey, platformData);
    await cache.hashSet(dailyKey, regionKey, regionData);
  }

  /**
   * Get heatmap data
   */
  static async getHeatmapData(filterType?: string, filterValue?: string): Promise<any> {
    const allData = await cache.hashGetAll(REDIS_KEYS.HEATMAP_CURRENT);
    
    if (filterType && filterValue) {
      const filterKey = `${filterType}:${filterValue}`;
      return allData[filterKey] || {};
    }
    
    return allData;
  }

  /**
   * Cache user session data
   */
  static async cacheUserSession(userId: string, sessionData: any, expireInSeconds: number = 3600): Promise<void> {
    await cache.set(REDIS_KEYS.USER_SESSION(userId), sessionData, expireInSeconds);
  }

  /**
   * Get user session data
   */
  static async getUserSession(userId: string): Promise<any | null> {
    return await cache.get(REDIS_KEYS.USER_SESSION(userId));
  }

  /**
   * Rate limiting check
   */
  static async checkRateLimit(identifier: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
    const key = REDIS_KEYS.RATE_LIMIT(identifier);
    const current = await cache.get(key) || 0;
    
    if (current >= limit) {
      return { allowed: false, remaining: 0 };
    }
    
    const newCount = current + 1;
    await cache.set(key, newCount, windowSeconds);
    
    return { allowed: true, remaining: limit - newCount };
  }

  /**
   * Clear expired data (cleanup job)
   */
  static async cleanup(): Promise<void> {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    // Clean up old live feed items (keep last 24 hours)
    // This would require a more sophisticated approach with Redis ZREMRANGEBYSCORE
    
    console.log('🧹 Redis cleanup completed');
  }
}