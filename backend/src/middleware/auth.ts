import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractTokenFromHeader } from '@/utils/jwt';
import { query } from '@/utils/database';
import { User } from '@/types/auth';

/**
 * Authentication middleware - verifies JWT token and attaches user to request
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const token = extractTokenFromHeader(req.headers.authorization);

        if (!token) {
            res.status(401).json({
                error: {
                    code: 'MISSING_TOKEN',
                    message: 'Access token is required',
                    timestamp: new Date().toISOString()
                }
            });
            return;
        }

        // Verify the token
        const payload = verifyAccessToken(token);

        // Get user from database
        const userResult = await query(
            'SELECT id, email, google_id, email_verified, created_at, updated_at FROM users WHERE id = $1',
            [payload.userId]
        );

        if (userResult.rows.length === 0) {
            res.status(401).json({
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found',
                    timestamp: new Date().toISOString()
                }
            });
            return;
        }

        const user: Omit<User, 'password_hash'> = userResult.rows[0];

        // Attach user to request
        req.user = user;
        req.userId = user.id;

        next();
    } catch (error) {
        let errorCode = 'TOKEN_VERIFICATION_FAILED';
        let errorMessage = 'Token verification failed';

        if (error instanceof Error) {
            if (error.message === 'Access token expired') {
                errorCode = 'TOKEN_EXPIRED';
                errorMessage = 'Access token expired';
            } else if (error.message === 'Invalid access token') {
                errorCode = 'INVALID_TOKEN';
                errorMessage = 'Invalid access token';
            }
        }

        res.status(401).json({
            error: {
                code: errorCode,
                message: errorMessage,
                timestamp: new Date().toISOString()
            }
        });
    }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const token = extractTokenFromHeader(req.headers.authorization);

        if (!token) {
            // No token provided, continue without authentication
            next();
            return;
        }

        // Verify the token
        const payload = verifyAccessToken(token);

        // Get user from database
        const userResult = await query(
            'SELECT id, email, google_id, email_verified, created_at, updated_at FROM users WHERE id = $1',
            [payload.userId]
        );

        if (userResult.rows.length > 0) {
            const user: Omit<User, 'password_hash'> = userResult.rows[0];
            req.user = user;
            req.userId = user.id;
        }

        next();
    } catch (error) {
        // For optional auth, we don't fail on token errors
        next();
    }
};

/**
 * Email verification middleware - ensures user has verified their email
 */
export const requireEmailVerification = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
        res.status(401).json({
            error: {
                code: 'AUTHENTICATION_REQUIRED',
                message: 'Authentication required',
                timestamp: new Date().toISOString()
            }
        });
        return;
    }

    if (!req.user.email_verified) {
        res.status(403).json({
            error: {
                code: 'EMAIL_NOT_VERIFIED',
                message: 'Email verification required',
                timestamp: new Date().toISOString()
            }
        });
        return;
    }

    next();
};

/**
 * Admin role middleware (placeholder for future role-based access)
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
        res.status(401).json({
            error: {
                code: 'AUTHENTICATION_REQUIRED',
                message: 'Authentication required',
                timestamp: new Date().toISOString()
            }
        });
        return;
    }

    // For now, check if user email contains 'admin' (simple implementation)
    // In production, you'd have a proper roles system
    if (!req.user.email.includes('admin')) {
        res.status(403).json({
            error: {
                code: 'INSUFFICIENT_PERMISSIONS',
                message: 'Admin access required',
                timestamp: new Date().toISOString()
            }
        });
        return;
    }

    next();
};