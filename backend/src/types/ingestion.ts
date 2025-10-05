import { Platform, FeedbackData, FeedbackAuthor, FeedbackEngagement, FeedbackMetadata } from './feedback';

// Re-export Platform type for use in ingestion modules
export { Platform } from './feedback';

export interface IngestionConfig {
  platform: Platform;
  enabled: boolean;
  apiKey?: string;
  apiSecret?: string;
  bearerToken?: string;
  baseUrl?: string;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  retryConfig: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
  batchSize: number;
  pollInterval: number; // in milliseconds
}

export interface IngestionJob {
  id: string;
  platform: Platform;
  type: 'search' | 'stream' | 'user_timeline' | 'mentions';
  query?: string;
  userId?: string;
  hashtags?: string[];
  keywords?: string[];
  since?: Date;
  until?: Date;
  maxResults?: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  progress: {
    processed: number;
    total?: number;
    lastProcessedId?: string;
  };
}

export interface IngestionResult {
  success: boolean;
  platform: Platform;
  itemsProcessed: number;
  itemsSkipped: number;
  errors: IngestionError[];
  nextCursor?: string;
  rateLimit?: {
    remaining: number;
    resetAt: Date;
  };
}

export interface IngestionError {
  type: 'api_error' | 'rate_limit' | 'validation_error' | 'network_error' | 'auth_error';
  message: string;
  code?: string;
  retryable: boolean;
  timestamp: Date;
  context?: any;
}

export interface RawFeedbackItem {
  id: string;
  platform: Platform;
  content: string;
  author: {
    id: string;
    username: string;
    displayName?: string;
    followerCount?: number;
    verified?: boolean;
    profileUrl?: string;
    avatarUrl?: string;
  };
  engagement: {
    likes: number;
    shares: number;
    comments: number;
    views?: number;
  };
  timestamps: {
    created: Date;
    modified?: Date;
  };
  metadata: Record<string, any>;
  urls?: string[];
  mentions?: string[];
  hashtags?: string[];
  location?: {
    name: string;
    coordinates?: [number, number];
  };
}

export interface PlatformAdapter {
  readonly platform: Platform;
  readonly config: IngestionConfig;
  
  // Core methods
  initialize(): Promise<void>;
  authenticate(): Promise<boolean>;
  testConnection(): Promise<boolean>;
  
  // Data fetching methods
  fetchFeedback(job: IngestionJob): Promise<IngestionResult>;
  searchFeedback(query: string, options?: SearchOptions): Promise<RawFeedbackItem[]>;
  getUserFeedback(userId: string, options?: UserFeedbackOptions): Promise<RawFeedbackItem[]>;
  
  // Rate limiting and error handling
  checkRateLimit(): Promise<{ remaining: number; resetAt: Date }>;
  handleError(error: any): IngestionError;
  shouldRetry(error: IngestionError): boolean;
  
  // Data transformation
  transformToFeedback(rawItem: RawFeedbackItem): FeedbackData;
  validateRawItem(rawItem: any): boolean;
  
  // Cleanup and shutdown
  cleanup(): Promise<void>;
}

export interface SearchOptions {
  maxResults?: number;
  since?: Date;
  until?: Date;
  language?: string;
  location?: string;
  sortBy?: 'relevance' | 'recent' | 'popular';
  includeReplies?: boolean;
  includeRetweets?: boolean;
}

export interface UserFeedbackOptions {
  maxResults?: number;
  since?: Date;
  until?: Date;
  includeReplies?: boolean;
  includeRetweets?: boolean;
}

export interface IngestionMetrics {
  platform: Platform;
  totalProcessed: number;
  totalErrors: number;
  successRate: number;
  averageProcessingTime: number;
  lastIngestionAt?: Date;
  rateLimit: {
    current: number;
    limit: number;
    resetAt: Date;
  };
  errors: {
    apiErrors: number;
    rateLimitErrors: number;
    validationErrors: number;
    networkErrors: number;
    authErrors: number;
  };
}

export interface IngestionSchedule {
  id: string;
  platform: Platform;
  type: 'search' | 'user_timeline' | 'mentions';
  query?: string;
  userId?: string;
  enabled: boolean;
  cronExpression: string;
  lastRun?: Date;
  nextRun: Date;
  maxResults: number;
  createdAt: Date;
  updatedAt: Date;
}

// Platform-specific types
export interface TwitterConfig extends IngestionConfig {
  consumerKey: string;
  consumerSecret: string;
  accessToken?: string;
  accessTokenSecret?: string;
}

export interface RedditConfig extends IngestionConfig {
  clientId: string;
  clientSecret: string;
  userAgent: string;
  username?: string;
  password?: string;
}

export interface TrustPilotConfig extends IngestionConfig {
  businessUnitId: string;
}

export interface AppStoreConfig extends IngestionConfig {
  appId: string;
  country: string;
}