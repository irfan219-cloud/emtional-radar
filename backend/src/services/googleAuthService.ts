import axios from 'axios';
import { query } from '@/utils/database';
import { generateTokenPair } from '@/utils/jwt';
import { User, AuthResponse } from '@/types/auth';
import { RedisManager } from '@/utils/redis-manager';

interface GoogleTokenInfo {
  iss: string;
  azp: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
  iat: number;
  exp: number;
}

export class GoogleAuthService {
  private static readonly GOOGLE_TOKEN_INFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
  private static readonly GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

  /**
   * Verify Google token and get user info
   */
  private static async verifyGoogleToken(token: string): Promise<GoogleTokenInfo> {
    try {
      // First, try to verify the token with Google's tokeninfo endpoint
      const tokenInfoResponse = await axios.get(`${this.GOOGLE_TOKEN_INFO_URL}?id_token=${token}`);
      
      if (tokenInfoResponse.status !== 200) {
        throw new Error('Invalid Google token');
      }

      const tokenInfo = tokenInfoResponse.data;

      // Verify the token is for our application
      const expectedAudience = process.env.GOOGLE_CLIENT_ID;
      if (tokenInfo.aud !== expectedAudience) {
        throw new Error('Token audience mismatch');
      }

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (tokenInfo.exp < now) {
        throw new Error('Google token expired');
      }

      return tokenInfo;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Google token verification failed: ${error.response?.data?.error_description || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get additional user info from Google
   */
  private static async getGoogleUserInfo(accessToken: string): Promise<any> {
    try {
      const response = await axios.get(this.GOOGLE_USERINFO_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      return response.data;
    } catch (error) {
      console.warn('Failed to get additional Google user info:', error);
      return null;
    }
  }

  /**
   * Authenticate user with Google OAuth token
   */
  static async authenticateWithGoogle(googleToken: string): Promise<AuthResponse> {
    // Verify the Google token
    const tokenInfo = await this.verifyGoogleToken(googleToken);

    if (!tokenInfo.email_verified) {
      throw new Error('Google email is not verified');
    }

    // Check if user already exists
    let userResult = await query(
      'SELECT id, email, google_id, email_verified, created_at, updated_at FROM users WHERE email = $1 OR google_id = $2',
      [tokenInfo.email, tokenInfo.sub]
    );

    let user: Omit<User, 'password_hash'>;

    if (userResult.rows.length > 0) {
      // User exists, update Google ID if needed
      const existingUser = userResult.rows[0];
      
      if (!existingUser.google_id) {
        // Link Google account to existing email account
        await query(
          'UPDATE users SET google_id = $1, email_verified = true, updated_at = NOW() WHERE id = $2',
          [tokenInfo.sub, existingUser.id]
        );
      }

      // Update last login
      await query(
        'UPDATE users SET updated_at = NOW() WHERE id = $1',
        [existingUser.id]
      );

      user = {
        ...existingUser,
        google_id: tokenInfo.sub,
        email_verified: true
      };
    } else {
      // Create new user
      userResult = await query(
        `INSERT INTO users (email, google_id, email_verified) 
         VALUES ($1, $2, $3) 
         RETURNING id, email, google_id, email_verified, created_at, updated_at`,
        [tokenInfo.email, tokenInfo.sub, true]
      );

      user = userResult.rows[0];
    }

    // Generate tokens
    const tokens = generateTokenPair(user.id, user.email);

    // Cache user session with Google info
    await RedisManager.cacheUserSession(user.id, {
      userId: user.id,
      email: user.email,
      googleId: tokenInfo.sub,
      loginMethod: 'google',
      loginAt: new Date().toISOString()
    });

    return { user, tokens };
  }

  /**
   * Link Google account to existing user
   */
  static async linkGoogleAccount(userId: string, googleToken: string): Promise<void> {
    // Verify the Google token
    const tokenInfo = await this.verifyGoogleToken(googleToken);

    if (!tokenInfo.email_verified) {
      throw new Error('Google email is not verified');
    }

    // Get current user
    const userResult = await query(
      'SELECT id, email, google_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    // Check if Google account is already linked to another user
    const existingGoogleUser = await query(
      'SELECT id FROM users WHERE google_id = $1 AND id != $2',
      [tokenInfo.sub, userId]
    );

    if (existingGoogleUser.rows.length > 0) {
      throw new Error('Google account is already linked to another user');
    }

    // Check if the email matches
    if (user.email !== tokenInfo.email) {
      throw new Error('Google account email does not match user email');
    }

    // Link the Google account
    await query(
      'UPDATE users SET google_id = $1, email_verified = true, updated_at = NOW() WHERE id = $2',
      [tokenInfo.sub, userId]
    );
  }

  /**
   * Unlink Google account from user
   */
  static async unlinkGoogleAccount(userId: string): Promise<void> {
    // Get current user
    const userResult = await query(
      'SELECT id, password_hash, google_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    if (!user.google_id) {
      throw new Error('Google account is not linked');
    }

    // Check if user has a password set (so they can still login)
    if (!user.password_hash) {
      throw new Error('Cannot unlink Google account: no password set. Please set a password first.');
    }

    // Unlink the Google account
    await query(
      'UPDATE users SET google_id = NULL, updated_at = NOW() WHERE id = $1',
      [userId]
    );
  }

  /**
   * Generate Google OAuth URL for frontend
   */
  static generateGoogleAuthUrl(redirectUri: string, state?: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('Google Client ID not configured');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent'
    });

    if (state) {
      params.append('state', state);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  static async exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
    access_token: string;
    id_token: string;
    refresh_token?: string;
  }> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to exchange code for tokens: ${error.response?.data?.error_description || error.message}`);
      }
      throw error;
    }
  }
}