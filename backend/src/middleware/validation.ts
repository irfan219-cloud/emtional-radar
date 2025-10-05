import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

/**
 * Validation middleware factory
 */
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

/**
 * Email validation schema
 */
export const emailSchema = Joi.string()
  .email({ tlds: { allow: false } })
  .lowercase()
  .trim()
  .max(255)
  .required()
  .messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required',
    'string.max': 'Email must be less than 255 characters'
  });

/**
 * Password validation schema
 */
export const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password must be less than 128 characters long',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    'string.empty': 'Password is required'
  });

/**
 * Login validation schema
 */
export const loginSchema = Joi.object({
  email: emailSchema,
  password: Joi.string().required().messages({
    'string.empty': 'Password is required'
  })
});

/**
 * Registration validation schema
 */
export const registerSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema
});

/**
 * Google OAuth validation schema
 */
export const googleAuthSchema = Joi.object({
  googleToken: Joi.string().required().messages({
    'string.empty': 'Google token is required'
  })
});

/**
 * Refresh token validation schema
 */
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'string.empty': 'Refresh token is required'
  })
});

/**
 * Email verification validation schema
 */
export const emailVerificationSchema = Joi.object({
  token: Joi.string().required().messages({
    'string.empty': 'Verification token is required'
  })
});

/**
 * Password reset request validation schema
 */
export const passwordResetRequestSchema = Joi.object({
  email: emailSchema
});

/**
 * Password reset validation schema
 */
export const passwordResetSchema = Joi.object({
  token: Joi.string().required().messages({
    'string.empty': 'Reset token is required'
  }),
  password: passwordSchema
});

/**
 * Query parameter validation middleware
 */
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      res.status(400).json({
        error: {
          code: 'QUERY_VALIDATION_ERROR',
          message: 'Query parameter validation failed',
          details: errors,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    req.query = value;
    next();
  };
};

/**
 * Params validation middleware
 */
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      res.status(400).json({
        error: {
          code: 'PARAMS_VALIDATION_ERROR',
          message: 'URL parameter validation failed',
          details: errors,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    req.params = value;
    next();
  };
};