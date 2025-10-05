/**
 * AI Response Generation Service - Main Export
 * 
 * This module provides comprehensive AI-powered response generation capabilities including:
 * - OpenAI integration for intelligent response drafting
 * - Multi-tone response generation (professional, empathetic, apologetic, grateful, informative)
 * - Platform-specific formatting and optimization
 * - Automated approval workflows and quality control
 * - Response pipeline management with queue processing
 * - Template-based fallback system
 * - Performance analytics and metrics tracking
 */

// Core Services
export { ResponseGenerationService } from './ResponseGenerationService';
export { ResponsePipelineService, ResponsePipelineConfig, ResponseJobData, PipelineMetrics } from './ResponsePipelineService';
export { ResponseManagementService, ResponseManagementConfig } from './ResponseManagementService';
export { ResponseFormattingService, PlatformConstraints, FormattingOptions, FormattedResponse } from './ResponseFormattingService';

// Providers
export { OpenAIProvider, OpenAIConfig, PromptTemplate } from './providers/OpenAIProvider';

// Types (re-export from types/response.ts for convenience)
export type {
  ResponseTone,
  ResponseStatus,
  ResponseChannel,
  ResponseTemplate,
  ResponseDraft,
  ResponseGenerationRequest,
  ResponseGenerationResult,
  ResponseConfig,
  ResponseApproval,
  ResponseMetrics,
  ResponseFeedback,
  ResponseAnalytics,
  ResponseWorkflow,
  ResponseQueue,
  ResponseBatch,
  CreateResponseRequest,
  UpdateResponseRequest,
  ApproveResponseRequest,
  SendResponseRequest,
  ResponseSearchFilters,
  ResponseStats
} from '@/types/response';

import { ResponseGenerationService } from './ResponseGenerationService';
import { ResponsePipelineService } from './ResponsePipelineService';
import { ResponseManagementService } from './ResponseManagementService';
import { ResponseFormattingService } from './ResponseFormattingService';
import { OpenAIProvider, OpenAIConfig } from './providers/OpenAIProvider';
import { ResponseConfig } from '@/types/response';
import { ResponsePipelineConfig } from './ResponsePipelineService';
import { ResponseManagementConfig } from './ResponseManagementService';
import { ResponseRepository } from '@/repositories/ResponseRepository';
import { FeedbackRepository } from '@/repositories/FeedbackRepository';
import { AnalysisRepository } from '@/repositories/AnalysisRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { AlertRepository } from '@/repositories/AlertRepository';
import { NLPAnalysisService } from '../nlp/NLPAnalysisService';

/**
 * Factory function to create a fully configured response generation system
 */
export function createResponseSystem(
  openaiConfig: OpenAIConfig,
  responseConfig: ResponseConfig,
  pipelineConfig: ResponsePipelineConfig,
  managementConfig: ResponseManagementConfig
): {
  generationService: ResponseGenerationService;
  pipelineService: ResponsePipelineService;
  managementService: ResponseManagementService;
  formattingService: ResponseFormattingService;
} {
  // Initialize repositories
  const responseRepo = new ResponseRepository();
  const feedbackRepo = new FeedbackRepository();
  const analysisRepo = new AnalysisRepository();
  const userRepo = new UserRepository();
  const alertRepo = new AlertRepository();

  // Initialize services
  const generationService = new ResponseGenerationService(
    openaiConfig,
    responseConfig,
    responseRepo,
    feedbackRepo,
    analysisRepo
  );

  const formattingService = new ResponseFormattingService();

  const pipelineService = new ResponsePipelineService(
    generationService,
    responseRepo,
    feedbackRepo,
    alertRepo,
    userRepo,
    pipelineConfig
  );

  const managementService = new ResponseManagementService(
    responseRepo,
    feedbackRepo,
    userRepo,
    pipelineService,
    managementConfig
  );

  return {
    generationService,
    pipelineService,
    managementService,
    formattingService
  };
}

/**
 * Default OpenAI configuration
 */
export const DEFAULT_OPENAI_CONFIG: OpenAIConfig = {
  apiKey: process.env.OPENAI_API_KEY || '',
  model: 'gpt-4',
  maxTokens: 500,
  temperature: 0.7,
  timeout: 30000
};

/**
 * Default response configuration
 */
export const DEFAULT_RESPONSE_CONFIG: ResponseConfig = {
  defaultTone: 'professional',
  maxLength: 280,
  generateVariations: true,
  variationCount: 2,
  autoApproveThreshold: 0.8,
  requireHumanReview: true,
  companyContext: 'We are a customer-focused technology company committed to providing excellent service.',
  brandGuidelines: 'Always be helpful, professional, and empathetic. Acknowledge concerns and provide clear next steps.',
  platformSettings: {
    twitter: {
      maxLength: 280,
      preferredTone: 'professional',
      autoReply: false
    },
    reddit: {
      maxLength: 1000,
      preferredTone: 'informative',
      autoReply: false
    },
    trustpilot: {
      maxLength: 500,
      preferredTone: 'apologetic',
      autoReply: false
    },
    appstore: {
      maxLength: 350,
      preferredTone: 'informative',
      autoReply: false
    }
  }
};

/**
 * Default pipeline configuration
 */
export const DEFAULT_PIPELINE_CONFIG: ResponsePipelineConfig = {
  queueName: 'response-generation',
  concurrency: 5,
  maxRetries: 3,
  retryDelay: 5000,
  autoApproveThreshold: 0.85,
  requireHumanReview: true,
  notificationSettings: {
    email: true,
    slack: false,
    webhooks: []
  }
};

/**
 * Default management configuration
 */
export const DEFAULT_MANAGEMENT_CONFIG: ResponseManagementConfig = {
  approvalWorkflow: {
    requireApproval: true,
    autoApproveThreshold: 0.9,
    approverRoles: ['admin', 'manager', 'senior_support'],
    escalationRules: [
      {
        condition: 'high_risk',
        action: 'escalate_to_manager',
        assignTo: 'manager'
      }
    ]
  },
  qualityControl: {
    enableSpellCheck: true,
    enableToneAnalysis: true,
    enableContentFiltering: true,
    minimumConfidence: 0.6
  },
  analytics: {
    trackEngagement: true,
    trackSatisfaction: true,
    enableABTesting: false
  }
};

/**
 * Response tone recommendations based on sentiment and risk
 */
export const TONE_RECOMMENDATIONS = {
  sentiment: {
    positive: 'grateful',
    neutral: 'professional',
    negative: 'empathetic'
  },
  risk: {
    low: 'professional',
    medium: 'empathetic',
    high: 'apologetic',
    'viral-threat': 'apologetic'
  },
  emotion: {
    anger: 'apologetic',
    frustration: 'empathetic',
    confusion: 'informative',
    joy: 'grateful',
    satisfaction: 'grateful'
  }
} as const;

/**
 * Platform-specific best practices
 */
export const PLATFORM_BEST_PRACTICES = {
  twitter: {
    maxLength: 280,
    useHashtags: true,
    useEmojis: true,
    beConversational: true,
    respondQuickly: true
  },
  reddit: {
    maxLength: 1000,
    beDetailed: true,
    useMarkdown: true,
    beTransparent: true,
    provideContext: true
  },
  trustpilot: {
    maxLength: 500,
    beProfessional: true,
    acknowledgeSpecifics: true,
    offerSolution: true,
    followUp: true
  },
  appstore: {
    maxLength: 350,
    mentionUpdates: true,
    provideSupport: true,
    beHelpful: true,
    encourageContact: true
  }
} as const;