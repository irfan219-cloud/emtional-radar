import { Pool, PoolClient } from 'pg';
import { pool, redisClient } from '@/config/database';

/**
 * Execute a database query with automatic connection management
 */
export const query = async (text: string, params?: any[]): Promise<any> => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};

/**
 * Execute multiple queries in a transaction
 */
export const transaction = async (queries: Array<{ text: string; params?: any[] }>): Promise<any[]> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];
    
    for (const { text, params } of queries) {
      const result = await client.query(text, params);
      results.push(result);
    }
    
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Redis cache utilities
 */
export const cache = {
  /**
   * Set a value in Redis with optional expiration
   */
  set: async (key: string, value: any, expireInSeconds?: number): Promise<void> => {
    const serializedValue = JSON.stringify(value);
    if (expireInSeconds) {
      await redisClient.setEx(key, expireInSeconds, serializedValue);
    } else {
      await redisClient.set(key, serializedValue);
    }
  },

  /**
   * Get a value from Redis
   */
  get: async <T = any>(key: string): Promise<T | null> => {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  },

  /**
   * Delete a key from Redis
   */
  del: async (key: string): Promise<void> => {
    await redisClient.del(key);
  },

  /**
   * Check if a key exists in Redis
   */
  exists: async (key: string): Promise<boolean> => {
    const result = await redisClient.exists(key);
    return result === 1;
  },

  /**
   * Add item to a Redis list
   */
  listPush: async (key: string, value: any): Promise<void> => {
    await redisClient.lPush(key, JSON.stringify(value));
  },

  /**
   * Get items from a Redis list
   */
  listRange: async <T = any>(key: string, start: number = 0, end: number = -1): Promise<T[]> => {
    const items = await redisClient.lRange(key, start, end);
    return items.map(item => JSON.parse(item));
  },

  /**
   * Add item to a Redis sorted set
   */
  sortedSetAdd: async (key: string, score: number, value: any): Promise<void> => {
    await redisClient.zAdd(key, { score, value: JSON.stringify(value) });
  },

  /**
   * Get items from a Redis sorted set by score range
   */
  sortedSetRange: async <T = any>(key: string, min: number = 0, max: number = -1): Promise<T[]> => {
    const items = await redisClient.zRange(key, min, max);
    return items.map(item => JSON.parse(item));
  },

  /**
   * Set hash field in Redis
   */
  hashSet: async (key: string, field: string, value: any): Promise<void> => {
    await redisClient.hSet(key, field, JSON.stringify(value));
  },

  /**
   * Get hash field from Redis
   */
  hashGet: async <T = any>(key: string, field: string): Promise<T | null> => {
    const value = await redisClient.hGet(key, field);
    return value ? JSON.parse(value) : null;
  },

  /**
   * Get all hash fields from Redis
   */
  hashGetAll: async <T = any>(key: string): Promise<Record<string, T>> => {
    const hash = await redisClient.hGetAll(key);
    const result: Record<string, T> = {};
    
    for (const [field, value] of Object.entries(hash)) {
      result[field] = JSON.parse(value);
    }
    
    return result;
  }
};

/**
 * Database health check
 */
export const healthCheck = async (): Promise<{ postgres: boolean; redis: boolean }> => {
  const health = { postgres: false, redis: false };
  
  try {
    await query('SELECT 1');
    health.postgres = true;
  } catch (error) {
    console.error('PostgreSQL health check failed:', error);
  }
  
  try {
    await redisClient.ping();
    health.redis = true;
  } catch (error) {
    console.error('Redis health check failed:', error);
  }
  
  return health;
};