/**
 * Redis key constants and utilities for consistent key naming
 */

export const REDIS_KEYS = {
  // Real-time feed data
  LIVE_FEED: 'feedback:live',
  ANALYSIS_PENDING: 'analysis:pending',
  
  // Alert management
  ALERTS_ACTIVE: 'alerts:active',
  ALERTS_HISTORY: 'alerts:history',
  
  // Heatmap data
  HEATMAP_CURRENT: 'heatmap:current',
  HEATMAP_PLATFORM: (platform: string) => `heatmap:platform:${platform}`,
  HEATMAP_REGION: (region: string) => `heatmap:region:${region}`,
  HEATMAP_TOPIC: (topic: string) => `heatmap:topic:${topic}`,
  
  // User sessions
  USER_SESSION: (userId: string) => `session:${userId}`,
  
  // Rate limiting
  RATE_LIMIT: (identifier: string) => `rate_limit:${identifier}`,
  
  // Cache keys
  CACHE_FEEDBACK: (feedbackId: string) => `cache:feedback:${feedbackId}`,
  CACHE_ANALYSIS: (analysisId: string) => `cache:analysis:${analysisId}`,
  CACHE_USER: (userId: string) => `cache:user:${userId}`,
  
  // Queue keys
  QUEUE_INGESTION: 'queue:ingestion',
  QUEUE_ANALYSIS: 'queue:analysis',
  QUEUE_ALERTS: 'queue:alerts',
  
  // WebSocket rooms
  WS_DASHBOARD: 'ws:dashboard',
  WS_ALERTS: 'ws:alerts',
  WS_HEATMAP: 'ws:heatmap',
  
  // Virality configuration
  VIRALITY_CONFIG: (version: string) => `virality:config:${version}`,
  VIRALITY_CONFIG_HISTORY: 'virality:config:history',
  VIRALITY_AB_TEST: (testId: string) => `virality:ab_test:${testId}`,
  VIRALITY_CACHE: (feedbackId: string) => `virality:cache:${feedbackId}`
} as const;

/**
 * Generate time-based keys for historical data
 */
export const generateTimeKey = (baseKey: string, date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  
  return `${baseKey}:${year}:${month}:${day}:${hour}`;
};

/**
 * Generate daily aggregation keys
 */
export const generateDailyKey = (baseKey: string, date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${baseKey}:daily:${year}:${month}:${day}`;
};

/**
 * Generate weekly aggregation keys
 */
export const generateWeeklyKey = (baseKey: string, date: Date = new Date()): string => {
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  
  return `${baseKey}:weekly:${year}:${week}`;
};

/**
 * Get week number of the year
 */
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}