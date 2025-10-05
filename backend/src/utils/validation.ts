import Joi from 'joi';
import { 
  Platform, 
  SentimentLabel, 
  EmotionType, 
  RiskLevel, 
  ResponseStatus, 
  AlertSeverity 
} from '@/types/feedback';

// Base validation schemas
export const platformSchema = Joi.string().valid(...(['twitter', 'reddit', 'trustpilot', 'appstore'] as Platform[]));

export const sentimentLabelSchema = Joi.string().valid(...(['positive', 'neutral', 'negative'] as SentimentLabel[]));

export const emotionTypeSchema = Joi.string().valid(...([
  'anger', 'sarcasm', 'frustration', 'betrayal', 'confusion', 'joy', 
  'satisfaction', 'gratitude', 'appreciation', 'trust', 'disappointment'
] as EmotionType[]));

export const riskLevelSchema = Joi.string().valid(...(['low', 'medium', 'high', 'viral-threat'] as RiskLevel[]));

export const responseStatusSchema = Joi.string().valid(...(['draft', 'approved', 'sent', 'failed'] as ResponseStatus[]));

export const alertSeveritySchema = Joi.string().valid(...(['mild', 'risky', 'viral-threat'] as AlertSeverity[]));

// Complex object schemas
export const feedbackAuthorSchema = Joi.object({
  username: Joi.string().min(1).max(255).required(),
  followerCount: Joi.number().integer().min(0).optional(),
  verified: Joi.boolean().optional()
});

export const feedbackEngagementSchema = Joi.object({
  likes: Joi.number().integer().min(0).required(),
  shares: Joi.number().integer().min(0).required(),
  comments: Joi.number().integer().min(0).required()
});

export const feedbackMetadataSchema = Joi.object({
  location: Joi.string().max(100).optional(),
  hashtags: Joi.array().items(Joi.string().max(50)).optional(),
  subreddit: Joi.string().max(100).optional(),
  upvotes: Joi.number().integer().min(0).optional(),
  downvotes: Joi.number().integer().min(0).optional(),
  rating: Joi.number().min(1).max(5).optional(),
  verified_purchase: Joi.boolean().optional(),
  app_version: Joi.string().max(50).optional(),
  device: Joi.string().max(100).optional()
}).unknown(true); // Allow additional metadata fields

export const emotionSchema = Joi.object({
  emotion: emotionTypeSchema.required(),
  confidence: Joi.number().min(0).max(1).required()
});

export const sentimentSchema = Joi.object({
  label: sentimentLabelSchema.required(),
  confidence: Joi.number().min(0).max(1).required()
});

export const viralityFactorsSchema = Joi.object({
  toneSeverity: Joi.number().min(0).max(1).required(),
  engagementVelocity: Joi.number().min(0).max(1).required(),
  userInfluence: Joi.number().min(0).max(1).required()
});

export const responseDraftSchema = Joi.object({
  content: Joi.string().min(1).max(2000).required(),
  tone: Joi.string().min(1).max(100).required(),
  confidence: Joi.number().min(0).max(1).required()
});

// Main entity schemas
export const feedbackDataSchema = Joi.object({
  platform: platformSchema.required(),
  external_id: Joi.string().max(255).optional(),
  content: Joi.string().min(1).max(10000).required(),
  author: feedbackAuthorSchema.required(),
  engagement: feedbackEngagementSchema.required(),
  posted_at: Joi.date().optional(),
  metadata: feedbackMetadataSchema.optional()
});

export const analysisResultSchema = Joi.object({
  feedback_id: Joi.string().uuid().required(),
  sentiment: sentimentSchema.required(),
  emotions: Joi.array().items(emotionSchema).min(0).max(10).required(),
  virality_score: Joi.number().integer().min(0).max(100).required(),
  virality_factors: viralityFactorsSchema.required(),
  risk_level: riskLevelSchema.required()
});

export const responseDataSchema = Joi.object({
  feedback_id: Joi.string().uuid().required(),
  drafts: Joi.array().items(responseDraftSchema).min(1).max(5).required(),
  selected_draft: Joi.string().max(2000).optional(),
  sent_to: Joi.string().max(255).optional(),
  status: responseStatusSchema.optional().default('draft')
});

export const alertDataSchema = Joi.object({
  feedback_id: Joi.string().uuid().required(),
  severity: alertSeveritySchema.required(),
  message: Joi.string().min(1).max(1000).required()
});

// API request schemas
export const analysisRequestSchema = Joi.object({
  text: Joi.string().min(1).max(10000).required(),
  platform: platformSchema.optional(),
  metadata: feedbackMetadataSchema.optional()
});

export const feedbackFiltersSchema = Joi.object({
  platform: Joi.array().items(platformSchema).optional(),
  sentiment: Joi.array().items(sentimentLabelSchema).optional(),
  risk_level: Joi.array().items(riskLevelSchema).optional(),
  date_from: Joi.date().optional(),
  date_to: Joi.date().optional(),
  has_alert: Joi.boolean().optional(),
  emotions: Joi.array().items(emotionTypeSchema).optional(),
  min_virality_score: Joi.number().integer().min(0).max(100).optional(),
  max_virality_score: Joi.number().integer().min(0).max(100).optional()
}).custom((value, helpers) => {
  // Validate date range
  if (value.date_from && value.date_to && value.date_from > value.date_to) {
    return helpers.error('custom.dateRange');
  }
  
  // Validate virality score range
  if (value.min_virality_score !== undefined && 
      value.max_virality_score !== undefined && 
      value.min_virality_score > value.max_virality_score) {
    return helpers.error('custom.viralityRange');
  }
  
  return value;
}).messages({
  'custom.dateRange': 'date_from must be before date_to',
  'custom.viralityRange': 'min_virality_score must be less than or equal to max_virality_score'
});

export const alertFiltersSchema = Joi.object({
  severity: Joi.array().items(alertSeveritySchema).optional(),
  resolved: Joi.boolean().optional(),
  date_from: Joi.date().optional(),
  date_to: Joi.date().optional(),
  platform: Joi.array().items(platformSchema).optional()
}).custom((value, helpers) => {
  // Validate date range
  if (value.date_from && value.date_to && value.date_from > value.date_to) {
    return helpers.error('custom.dateRange');
  }
  return value;
}).messages({
  'custom.dateRange': 'date_from must be before date_to'
});

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  sort_by: Joi.string().max(50).optional(),
  sort_order: Joi.string().valid('asc', 'desc').default('desc')
});

// Utility validation functions
export const validateUUID = (value: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const sanitizeText = (text: string): string => {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 10000); // Limit length
};

export const sanitizeUsername = (username: string): string => {
  return username
    .trim()
    .replace(/[^a-zA-Z0-9_.-]/g, '') // Keep only alphanumeric and common username chars
    .substring(0, 255);
};

// Custom validation middleware for specific use cases
export const validateFeedbackContent = (content: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!content || content.trim().length === 0) {
    errors.push('Content cannot be empty');
  }
  
  if (content.length > 10000) {
    errors.push('Content exceeds maximum length of 10,000 characters');
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i
  ];
  
  if (suspiciousPatterns.some(pattern => pattern.test(content))) {
    errors.push('Content contains potentially malicious code');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateViralityScore = (score: number): { isValid: boolean; error?: string } => {
  if (typeof score !== 'number' || isNaN(score)) {
    return { isValid: false, error: 'Virality score must be a number' };
  }
  
  if (score < 0 || score > 100) {
    return { isValid: false, error: 'Virality score must be between 0 and 100' };
  }
  
  return { isValid: true };
};

export const validateConfidenceScore = (confidence: number): { isValid: boolean; error?: string } => {
  if (typeof confidence !== 'number' || isNaN(confidence)) {
    return { isValid: false, error: 'Confidence score must be a number' };
  }
  
  if (confidence < 0 || confidence > 1) {
    return { isValid: false, error: 'Confidence score must be between 0 and 1' };
  }
  
  return { isValid: true };
};