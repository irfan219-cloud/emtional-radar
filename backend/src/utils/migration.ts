import fs from 'fs';
import path from 'path';
import { query } from './database';

/**
 * Migration utility for running database migrations
 */
export class MigrationRunner {
  private migrationsPath: string;
  private seedsPath: string;

  constructor() {
    this.migrationsPath = path.join(__dirname, '../../database/migrations');
    this.seedsPath = path.join(__dirname, '../../database/seeds');
  }

  /**
   * Create migrations table if it doesn't exist
   */
  private async createMigrationsTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await query(createTableQuery);
  }

  /**
   * Get list of executed migrations
   */
  private async getExecutedMigrations(): Promise<string[]> {
    const result = await query('SELECT filename FROM migrations ORDER BY id');
    return result.rows.map((row: any) => row.filename);
  }

  /**
   * Run pending migrations
   */
  async runMigrations(): Promise<void> {
    console.log('🔄 Running database migrations...');
    
    await this.createMigrationsTable();
    const executedMigrations = await this.getExecutedMigrations();
    
    if (!fs.existsSync(this.migrationsPath)) {
      console.log('📁 No migrations directory found, skipping migrations');
      return;
    }

    const migrationFiles = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      if (!executedMigrations.includes(file)) {
        console.log(`📄 Running migration: ${file}`);
        
        const migrationPath = path.join(this.migrationsPath, file);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        try {
          await query(migrationSQL);
          await query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
          console.log(`✅ Migration completed: ${file}`);
        } catch (error) {
          console.error(`❌ Migration failed: ${file}`, error);
          throw error;
        }
      }
    }
    
    console.log('✅ All migrations completed');
  }

  /**
   * Run database seeds (development data)
   */
  async runSeeds(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      console.log('🚫 Skipping seeds in production environment');
      return;
    }

    console.log('🌱 Running database seeds...');
    
    if (!fs.existsSync(this.seedsPath)) {
      console.log('📁 No seeds directory found, skipping seeds');
      return;
    }

    const seedFiles = fs.readdirSync(this.seedsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of seedFiles) {
      console.log(`🌱 Running seed: ${file}`);
      
      const seedPath = path.join(this.seedsPath, file);
      const seedSQL = fs.readFileSync(seedPath, 'utf8');
      
      try {
        await query(seedSQL);
        console.log(`✅ Seed completed: ${file}`);
      } catch (error) {
        console.error(`❌ Seed failed: ${file}`, error);
        // Don't throw error for seeds, just log and continue
      }
    }
    
    console.log('✅ All seeds completed');
  }

  /**
   * Initialize database with migrations and seeds
   */
  async initialize(): Promise<void> {
    try {
      await this.runMigrations();
      await this.runSeeds();
      console.log('🎉 Database initialization completed successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }
}