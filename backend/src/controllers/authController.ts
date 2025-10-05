import { Request, Response } from 'express';
import { AuthService } from '@/services/authService';
import { GoogleAuthService } from '@/services/googleAuthService';
import { LoginRequest, RegisterRequest, RefreshTokenRequest, VerifyEmailRequest, GoogleAuthRequest } from '@/types/auth';

export class AuthController {
  /**
   * Register a new user
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password }: RegisterRequest = req.body;

      const result = await AuthService.register(email, password);

      // Send verification email
      await AuthService.sendEmailVerification(result.user.id);

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email for verification.',
        data: {
          user: result.user,
          tokens: result.tokens
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      let statusCode = 400;
      let errorCode = 'REGISTRATION_FAILED';
      
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          statusCode = 409;
          errorCode = 'USER_ALREADY_EXISTS';
        } else if (error.message.includes('Password validation failed')) {
          statusCode = 400;
          errorCode = 'INVALID_PASSWORD';
        }
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : 'Registration failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Login user
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password }: LoginRequest = req.body;

      const result = await AuthService.login(email, password);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          tokens: result.tokens
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      let statusCode = 401;
      let errorCode = 'LOGIN_FAILED';
      
      if (error instanceof Error) {
        if (error.message.includes('Invalid email or password')) {
          errorCode = 'INVALID_CREDENTIALS';
        } else if (error.message.includes('Google')) {
          errorCode = 'GOOGLE_LOGIN_REQUIRED';
        }
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : 'Login failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken }: RefreshTokenRequest = req.body;

      const tokens = await AuthService.refreshToken(refreshToken);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: { tokens },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(401).json({
        error: {
          code: 'TOKEN_REFRESH_FAILED',
          message: error instanceof Error ? error.message : 'Token refresh failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Logout user
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      await AuthService.logout(userId);

      res.status(200).json({
        success: true,
        message: 'Logout successful',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'LOGOUT_FAILED',
          message: error instanceof Error ? error.message : 'Logout failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Send email verification
   */
  static async sendEmailVerification(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      await AuthService.sendEmailVerification(userId);

      res.status(200).json({
        success: true,
        message: 'Verification email sent successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      let statusCode = 400;
      let errorCode = 'EMAIL_VERIFICATION_FAILED';
      
      if (error instanceof Error) {
        if (error.message.includes('already verified')) {
          statusCode = 409;
          errorCode = 'EMAIL_ALREADY_VERIFIED';
        } else if (error.message.includes('not found')) {
          statusCode = 404;
          errorCode = 'USER_NOT_FOUND';
        }
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : 'Email verification failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Verify email with token
   */
  static async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      const result = await AuthService.verifyEmail(token);

      res.status(200).json({
        success: result.success,
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(400).json({
        error: {
          code: 'EMAIL_VERIFICATION_FAILED',
          message: error instanceof Error ? error.message : 'Email verification failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const user = await AuthService.getUserProfile(userId);

      res.status(200).json({
        success: true,
        data: { user },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: error instanceof Error ? error.message : 'User not found',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const updates = req.body;
      const user = await AuthService.updateUserProfile(userId, updates);

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: { user },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      let statusCode = 400;
      let errorCode = 'PROFILE_UPDATE_FAILED';
      
      if (error instanceof Error) {
        if (error.message.includes('already taken')) {
          statusCode = 409;
          errorCode = 'EMAIL_ALREADY_TAKEN';
        } else if (error.message.includes('not found')) {
          statusCode = 404;
          errorCode = 'USER_NOT_FOUND';
        }
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : 'Profile update failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Change password
   */
  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const { currentPassword, newPassword } = req.body;
      await AuthService.changePassword(userId, currentPassword, newPassword);

      res.status(200).json({
        success: true,
        message: 'Password changed successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      let statusCode = 400;
      let errorCode = 'PASSWORD_CHANGE_FAILED';
      
      if (error instanceof Error) {
        if (error.message.includes('incorrect')) {
          statusCode = 401;
          errorCode = 'INVALID_CURRENT_PASSWORD';
        } else if (error.message.includes('validation failed')) {
          errorCode = 'INVALID_NEW_PASSWORD';
        }
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : 'Password change failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Google OAuth authentication
   */
  static async googleAuth(req: Request, res: Response): Promise<void> {
    try {
      const { googleToken }: GoogleAuthRequest = req.body;

      const result = await GoogleAuthService.authenticateWithGoogle(googleToken);

      res.status(200).json({
        success: true,
        message: 'Google authentication successful',
        data: {
          user: result.user,
          tokens: result.tokens
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      let statusCode = 401;
      let errorCode = 'GOOGLE_AUTH_FAILED';
      
      if (error instanceof Error) {
        if (error.message.includes('Invalid Google token')) {
          errorCode = 'INVALID_GOOGLE_TOKEN';
        } else if (error.message.includes('not verified')) {
          errorCode = 'GOOGLE_EMAIL_NOT_VERIFIED';
        } else if (error.message.includes('expired')) {
          errorCode = 'GOOGLE_TOKEN_EXPIRED';
        }
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : 'Google authentication failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get Google OAuth URL
   */
  static async getGoogleAuthUrl(req: Request, res: Response): Promise<void> {
    try {
      const { redirectUri, state } = req.query;
      
      if (!redirectUri || typeof redirectUri !== 'string') {
        res.status(400).json({
          error: {
            code: 'MISSING_REDIRECT_URI',
            message: 'Redirect URI is required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const authUrl = GoogleAuthService.generateGoogleAuthUrl(
        redirectUri,
        state as string
      );

      res.status(200).json({
        success: true,
        data: { authUrl },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'GOOGLE_AUTH_URL_FAILED',
          message: error instanceof Error ? error.message : 'Failed to generate Google auth URL',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Handle Google OAuth callback
   */
  static async googleCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, redirectUri } = req.body;

      if (!code || !redirectUri) {
        res.status(400).json({
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Authorization code and redirect URI are required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Exchange code for tokens
      const tokens = await GoogleAuthService.exchangeCodeForTokens(code, redirectUri);
      
      // Authenticate with the ID token
      const result = await GoogleAuthService.authenticateWithGoogle(tokens.id_token);

      res.status(200).json({
        success: true,
        message: 'Google authentication successful',
        data: {
          user: result.user,
          tokens: result.tokens
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(401).json({
        error: {
          code: 'GOOGLE_CALLBACK_FAILED',
          message: error instanceof Error ? error.message : 'Google callback failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Link Google account to existing user
   */
  static async linkGoogle(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const { googleToken } = req.body;
      await GoogleAuthService.linkGoogleAccount(userId, googleToken);

      res.status(200).json({
        success: true,
        message: 'Google account linked successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      let statusCode = 400;
      let errorCode = 'GOOGLE_LINK_FAILED';
      
      if (error instanceof Error) {
        if (error.message.includes('already linked')) {
          statusCode = 409;
          errorCode = 'GOOGLE_ACCOUNT_ALREADY_LINKED';
        } else if (error.message.includes('does not match')) {
          errorCode = 'EMAIL_MISMATCH';
        }
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : 'Failed to link Google account',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Unlink Google account from user
   */
  static async unlinkGoogle(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      await GoogleAuthService.unlinkGoogleAccount(userId);

      res.status(200).json({
        success: true,
        message: 'Google account unlinked successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      let statusCode = 400;
      let errorCode = 'GOOGLE_UNLINK_FAILED';
      
      if (error instanceof Error) {
        if (error.message.includes('not linked')) {
          statusCode = 404;
          errorCode = 'GOOGLE_ACCOUNT_NOT_LINKED';
        } else if (error.message.includes('no password')) {
          statusCode = 409;
          errorCode = 'PASSWORD_REQUIRED';
        }
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : 'Failed to unlink Google account',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
}