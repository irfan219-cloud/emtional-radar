#!/usr/bin/env ts-node

/**
 * Database connection test script
 * Run with: npm run test:db or ts-node src/scripts/test-db.ts
 */

import dotenv from 'dotenv';
import { initializeDatabase, closeDatabase } from '@/config/database';
import { healthCheck, query, cache } from '@/utils/database';
import { MigrationRunner } from '@/utils/migration';

dotenv.config();

async function testDatabase() {
  console.log('🧪 Testing database connections...\n');
  
  try {
    // Initialize connections
    console.log('1. Initializing database connections...');
    await initializeDatabase();
    
    // Test health check
    console.log('2. Running health check...');
    const health = await healthCheck();
    console.log('   PostgreSQL:', health.postgres ? '✅' : '❌');
    console.log('   Redis:', health.redis ? '✅' : '❌');
    
    if (!health.postgres || !health.redis) {
      throw new Error('Database health check failed');
    }
    
    // Test PostgreSQL query
    console.log('3. Testing PostgreSQL query...');
    const result = await query('SELECT NOW() as current_time, version() as pg_version');
    console.log('   Current time:', result.rows[0].current_time);
    console.log('   PostgreSQL version:', result.rows[0].pg_version.split(' ')[0]);
    
    // Test Redis operations
    console.log('4. Testing Redis operations...');
    await cache.set('test:key', { message: 'Hello Redis!', timestamp: new Date() }, 60);
    const redisData = await cache.get('test:key');
    console.log('   Redis test data:', redisData);
    await cache.del('test:key');
    
    // Test migrations
    console.log('5. Testing migrations...');
    const migrationRunner = new MigrationRunner();
    await migrationRunner.runMigrations();
    
    // Test sample data query
    console.log('6. Testing sample data...');
    const feedbackCount = await query('SELECT COUNT(*) as count FROM feedback');
    const analysisCount = await query('SELECT COUNT(*) as count FROM analysis');
    console.log('   Feedback records:', feedbackCount.rows[0].count);
    console.log('   Analysis records:', analysisCount.rows[0].count);
    
    console.log('\n✅ All database tests passed!');
    
  } catch (error) {
    console.error('\n❌ Database test failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
    console.log('🔒 Database connections closed');
    process.exit(0);
  }
}

// Run the test
testDatabase();