import { Request, Response, NextFunction } from 'express';
import { RedisManager } from '@/utils/redis-manager';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Rate limiting middleware using Redis
 */
export const createRateLimiter = (options: RateLimitOptions) => {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
    keyGenerator = (req: Request) => req.ip || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = keyGenerator(req);
      const windowSeconds = Math.floor(windowMs / 1000);
      
      const { allowed, remaining } = await RedisManager.checkRateLimit(
        key,
        maxRequests,
        windowSeconds
      );

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString()
      });

      if (!allowed) {
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message,
            timestamp: new Date().toISOString(),
            retryAfter: windowMs
          }
        });
        return;
      }

      // Store original end function to intercept response
      const originalEnd = res.end;
      let responseSent = false;

      res.end = function(chunk?: any, encoding?: any) {
        if (!responseSent) {
          responseSent = true;
          
          // Check if we should skip counting this request
          const shouldSkip = 
            (skipSuccessfulRequests && res.statusCode < 400) ||
            (skipFailedRequests && res.statusCode >= 400);

          if (shouldSkip) {
            // Decrement the counter since we're skipping this request
            // Note: This is a simplified approach, in production you might want
            // a more sophisticated method to handle this
          }
        }
        
        originalEnd.call(this, chunk, encoding);
      };

      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // If rate limiting fails, allow the request to proceed
      next();
    }
  };
};

/**
 * Strict rate limiter for authentication endpoints
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  message: 'Too many authentication attempts, please try again in 15 minutes',
  keyGenerator: (req: Request) => `auth:${req.ip}:${req.body.email || 'unknown'}`,
  skipSuccessfulRequests: true
});

/**
 * General API rate limiter
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
  message: 'API rate limit exceeded, please try again later',
  keyGenerator: (req: Request) => `api:${req.ip}`
});

/**
 * Strict rate limiter for password reset
 */
export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3, // 3 attempts per hour
  message: 'Too many password reset attempts, please try again in 1 hour',
  keyGenerator: (req: Request) => `password-reset:${req.ip}:${req.body.email || 'unknown'}`
});

/**
 * Email verification rate limiter
 */
export const emailVerificationRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 3, // 3 attempts per 5 minutes
  message: 'Too many email verification attempts, please try again in 5 minutes',
  keyGenerator: (req: Request) => `email-verify:${req.ip}`
});