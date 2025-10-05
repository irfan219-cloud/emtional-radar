import { Router } from 'express';
import { AuthController } from '@/controllers/authController';
import { authenticate } from '@/middleware/auth';
import { validate, loginSchema, registerSchema, refreshTokenSchema, googleAuthSchema } from '@/middleware/validation';
import { authRateLimiter, emailVerificationRateLimiter } from '@/middleware/rateLimiter';

const router = Router();

/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', 
  authRateLimiter,
  validate(registerSchema),
  AuthController.register
);

/**
 * @route   POST /auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login',
  authRateLimiter,
  validate(loginSchema),
  AuthController.login
);

/**
 * @route   POST /auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh-token',
  validate(refreshTokenSchema),
  AuthController.refreshToken
);

/**
 * @route   POST /auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout',
  authenticate,
  AuthController.logout
);

/**
 * @route   POST /auth/send-verification
 * @desc    Send email verification
 * @access  Private
 */
router.post('/send-verification',
  authenticate,
  emailVerificationRateLimiter,
  AuthController.sendEmailVerification
);

/**
 * @route   GET /auth/verify-email/:token
 * @desc    Verify email with token
 * @access  Public
 */
router.get('/verify-email/:token',
  AuthController.verifyEmail
);

/**
 * @route   GET /auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile',
  authenticate,
  AuthController.getProfile
);

/**
 * @route   PUT /auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile',
  authenticate,
  // Add validation for profile updates
  AuthController.updateProfile
);

/**
 * @route   POST /auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password',
  authenticate,
  // Add validation for password change
  AuthController.changePassword
);

/**
 * @route   POST /auth/google
 * @desc    Authenticate with Google OAuth token
 * @access  Public
 */
router.post('/google',
  authRateLimiter,
  validate(googleAuthSchema),
  AuthController.googleAuth
);

/**
 * @route   GET /auth/google/url
 * @desc    Get Google OAuth authorization URL
 * @access  Public
 */
router.get('/google/url',
  AuthController.getGoogleAuthUrl
);

/**
 * @route   POST /auth/google/callback
 * @desc    Handle Google OAuth callback
 * @access  Public
 */
router.post('/google/callback',
  authRateLimiter,
  AuthController.googleCallback
);

/**
 * @route   POST /auth/google/link
 * @desc    Link Google account to existing user
 * @access  Private
 */
router.post('/google/link',
  authenticate,
  validate(googleAuthSchema),
  AuthController.linkGoogle
);

/**
 * @route   DELETE /auth/google/unlink
 * @desc    Unlink Google account from user
 * @access  Private
 */
router.delete('/google/unlink',
  authenticate,
  AuthController.unlinkGoogle
);

export default router;