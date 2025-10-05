import { query, transaction } from '@/utils/database';
import { hashPassword, comparePassword, validatePassword } from '@/utils/password';
import { generateTokenPair, generateEmailVerificationToken, verifyEmailVerificationToken } from '@/utils/jwt';
import { User, AuthTokens, AuthResponse } from '@/types/auth';
import { RedisManager } from '@/utils/redis-manager';

export class AuthService {
  /**
   * Register a new user with email and password
   */
  static async register(email: string, password: string): Promise<AuthResponse> {
    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userResult = await query(
      `INSERT INTO users (email, password_hash, email_verified) 
       VALUES ($1, $2, $3) 
       RETURNING id, email, google_id, email_verified, created_at, updated_at`,
      [email, passwordHash, false]
    );

    const user: Omit<User, 'password_hash'> = userResult.rows[0];

    // Generate tokens
    const tokens = generateTokenPair(user.id, user.email);

    // Cache user session
    await RedisManager.cacheUserSession(user.id, {
      userId: user.id,
      email: user.email,
      loginAt: new Date().toISOString()
    });

    return { user, tokens };
  }

  /**
   * Login user with email and password
   */
  static async login(email: string, password: string): Promise<AuthResponse> {
    // Get user with password hash
    const userResult = await query(
      'SELECT id, email, password_hash, google_id, email_verified, created_at, updated_at FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const userWithPassword = userResult.rows[0];

    // Check if user has a password (might be Google-only user)
    if (!userWithPassword.password_hash) {
      throw new Error('Please sign in with Google or reset your password');
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, userWithPassword.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Remove password hash from user object
    const { password_hash, ...user } = userWithPassword;

    // Generate tokens
    const tokens = generateTokenPair(user.id, user.email);

    // Update last login time
    await query(
      'UPDATE users SET updated_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Cache user session
    await RedisManager.cacheUserSession(user.id, {
      userId: user.id,
      email: user.email,
      loginAt: new Date().toISOString()
    });

    return { user, tokens };
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // This will be implemented when we add refresh token logic
      // For now, return error
      throw new Error('Refresh token functionality not yet implemented');
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Send email verification
   */
  static async sendEmailVerification(userId: string): Promise<void> {
    // Get user
    const userResult = await query(
      'SELECT id, email, email_verified FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    if (user.email_verified) {
      throw new Error('Email is already verified');
    }

    // Generate verification token
    const verificationToken = generateEmailVerificationToken(user.id, user.email);

    // In a real application, you would send this via email
    // For now, we'll just log it
    console.log(`📧 Email verification token for ${user.email}: ${verificationToken}`);
    console.log(`🔗 Verification URL: ${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`);

    // Store verification attempt in Redis for rate limiting
    await RedisManager.cacheUserSession(`email_verification:${user.id}`, {
      token: verificationToken,
      sentAt: new Date().toISOString()
    }, 24 * 60 * 60); // 24 hours
  }

  /**
   * Verify email with token
   */
  static async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    try {
      // Verify token
      const { userId, email } = verifyEmailVerificationToken(token);

      // Get user
      const userResult = await query(
        'SELECT id, email, email_verified FROM users WHERE id = $1 AND email = $2',
        [userId, email]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Invalid verification token');
      }

      const user = userResult.rows[0];

      if (user.email_verified) {
        return {
          success: true,
          message: 'Email is already verified'
        };
      }

      // Update user as verified
      await query(
        'UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1',
        [userId]
      );

      // Clear verification cache
      await RedisManager.getUserSession(`email_verification:${userId}`);

      return {
        success: true,
        message: 'Email verified successfully'
      };
    } catch (error) {
      throw new Error('Invalid or expired verification token');
    }
  }

  /**
   * Logout user (invalidate session)
   */
  static async logout(userId: string): Promise<void> {
    // Clear user session from Redis
    await RedisManager.getUserSession(userId);
    
    // In a more sophisticated system, you might also:
    // - Add the token to a blacklist
    // - Increment token version to invalidate all tokens
    // - Log the logout event
  }

  /**
   * Get user profile
   */
  static async getUserProfile(userId: string): Promise<Omit<User, 'password_hash'>> {
    const userResult = await query(
      'SELECT id, email, google_id, email_verified, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    return userResult.rows[0];
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(userId: string, updates: Partial<Pick<User, 'email'>>): Promise<Omit<User, 'password_hash'>> {
    const allowedUpdates = ['email'];
    const updateFields = Object.keys(updates).filter(key => allowedUpdates.includes(key));
    
    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    // If email is being updated, check if it's already taken
    if (updates.email) {
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [updates.email, userId]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('Email is already taken');
      }
    }

    // Build dynamic update query
    const setClause = updateFields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [userId, ...updateFields.map(field => updates[field as keyof typeof updates])];

    const userResult = await query(
      `UPDATE users SET ${setClause}, updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, email, google_id, email_verified, created_at, updated_at`,
      values
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    // If email was updated, mark as unverified and send new verification
    if (updates.email) {
      await query(
        'UPDATE users SET email_verified = false WHERE id = $1',
        [userId]
      );
      
      await this.sendEmailVerification(userId);
    }

    return userResult.rows[0];
  }

  /**
   * Change user password
   */
  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    // Get user with current password hash
    const userResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    // Verify current password
    if (user.password_hash) {
      const isCurrentPasswordValid = await comparePassword(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );
  }
}