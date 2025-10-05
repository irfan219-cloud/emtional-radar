import { BaseRepository, WhereCondition } from './BaseRepository';
import { User } from '@/types/auth';

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super('users', 'id');
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return await this.findOne({
      where: [{ field: 'email', operator: '=' as const, value: email }]
    });
  }

  /**
   * Find user by Google ID
   */
  async findByGoogleId(googleId: string): Promise<User | null> {
    return await this.findOne({
      where: [{ field: 'google_id', operator: '=' as const, value: googleId }]
    });
  }

  /**
   * Find user by email or Google ID
   */
  async findByEmailOrGoogleId(email: string, googleId: string): Promise<User | null> {
    const result = await this.raw(
      'SELECT * FROM users WHERE email = $1 OR google_id = $2 LIMIT 1',
      [email, googleId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Create user with email and password
   */
  async createWithPassword(email: string, passwordHash: string): Promise<User> {
    const result = await this.raw(
      `INSERT INTO users (email, password_hash, email_verified) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [email, passwordHash, false]
    );

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Create user with Google OAuth
   */
  async createWithGoogle(email: string, googleId: string): Promise<User> {
    const result = await this.raw(
      `INSERT INTO users (email, google_id, email_verified) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [email, googleId, true]
    );

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update password
   */
  async updatePassword(id: string, passwordHash: string): Promise<User | null> {
    return await this.update(id, { password_hash: passwordHash } as any);
  }

  /**
   * Update email verification status
   */
  async updateEmailVerification(id: string, verified: boolean): Promise<User | null> {
    return await this.update(id, { email_verified: verified } as any);
  }

  /**
   * Link Google account to existing user
   */
  async linkGoogleAccount(id: string, googleId: string): Promise<User | null> {
    return await this.update(id, { 
      google_id: googleId, 
      email_verified: true 
    } as any);
  }

  /**
   * Unlink Google account from user
   */
  async unlinkGoogleAccount(id: string): Promise<User | null> {
    return await this.update(id, { google_id: null } as any);
  }

  /**
   * Get users with email verification pending
   */
  async findUnverifiedUsers(olderThanDays: number = 7): Promise<User[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    return await this.findMany({
      where: [
        { field: 'email_verified', operator: '=' as const, value: false },
        { field: 'created_at', operator: '<' as const, value: cutoffDate }
      ],
      orderBy: [{ field: 'created_at', direction: 'ASC' }]
    });
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<{
    total: number;
    verified: number;
    unverified: number;
    google_users: number;
    password_users: number;
  }> {
    const result = await this.raw(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN email_verified = true THEN 1 END) as verified,
        COUNT(CASE WHEN email_verified = false THEN 1 END) as unverified,
        COUNT(CASE WHEN google_id IS NOT NULL THEN 1 END) as google_users,
        COUNT(CASE WHEN password_hash IS NOT NULL THEN 1 END) as password_users
      FROM users
    `);

    const row = result.rows[0];
    return {
      total: parseInt(row.total),
      verified: parseInt(row.verified),
      unverified: parseInt(row.unverified),
      google_users: parseInt(row.google_users),
      password_users: parseInt(row.password_users)
    };
  }

  /**
   * Check if email is already taken by another user
   */
  async isEmailTaken(email: string, excludeUserId?: string): Promise<boolean> {
    const conditions: WhereCondition[] = [{ field: 'email', operator: '=' as const, value: email }];
    
    if (excludeUserId) {
      conditions.push({ field: 'id', operator: '!=' as const, value: excludeUserId });
    }

    const user = await this.findOne({ where: conditions });
    return user !== null;
  }

  /**
   * Check if Google ID is already linked to another user
   */
  async isGoogleIdTaken(googleId: string, excludeUserId?: string): Promise<boolean> {
    const conditions: WhereCondition[] = [{ field: 'google_id', operator: '=' as const, value: googleId }];
    
    if (excludeUserId) {
      conditions.push({ field: 'id', operator: '!=' as const, value: excludeUserId });
    }

    const user = await this.findOne({ where: conditions });
    return user !== null;
  }

  /**
   * Get recently registered users
   */
  async getRecentUsers(limit: number = 50): Promise<User[]> {
    const result = await this.raw(
      `SELECT * FROM users 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row: Record<string, any>) => this.mapRowToEntity(row));
  }

  /**
   * Search users by email pattern
   */
  async searchByEmail(emailPattern: string, limit: number = 50): Promise<User[]> {
    const result = await this.raw(
      `SELECT * FROM users 
       WHERE email ILIKE $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [`%${emailPattern}%`, limit]
    );

    return result.rows.map((row: Record<string, any>) => this.mapRowToEntity(row));
  }

  /**
   * Map database row to User entity (excluding password_hash for security)
   */
  protected mapRowToEntity(row: Record<string, any>): User {
    return {
      id: row.id,
      email: row.email,
      password_hash: row.password_hash, // Include for internal operations, exclude in API responses
      google_id: row.google_id,
      email_verified: row.email_verified,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * Map to safe user object (without password_hash)
   */
  mapToSafeUser(user: User): Omit<User, 'password_hash'> {
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }
}