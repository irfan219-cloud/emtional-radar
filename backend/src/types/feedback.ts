import { ResponseData, ResponseDraft } from "./response";

export type Platform = 'twitter' | 'reddit' | 'trustpilot' | 'appstore';

export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export type EmotionType = 'anger' | 'sarcasm' | 'frustration' | 'betrayal' | 'confusion' | 'joy' | 'satisfaction' | 'gratitude' | 'appreciation' | 'trust' | 'disappointment';

export type RiskLevel = 'low' | 'medium' | 'high' | 'viral-threat';

export type ResponseStatus = 'draft' | 'approved' | 'sent' | 'failed';

export type AlertSeverity = 'mild' | 'risky' | 'viral-threat';

export interface FeedbackAuthor {
  username: string;
  followerCount?: number;
  verified?: boolean;
}

export interface FeedbackEngagement {
  likes: number;
  shares: number;
  comments: number;
}

export interface FeedbackMetadata {
  location?: string;
  hashtags?: string[];
  subreddit?: string;
  upvotes?: number;
  downvotes?: number;
  rating?: number;
  verified_purchase?: boolean;
  app_version?: string;
  device?: string;
  [key: string]: any;
}

export interface FeedbackData {
  id: string;
  platform: Platform;
  external_id?: string;
  content: string;
  author: FeedbackAuthor;
  engagement: FeedbackEngagement;
  posted_at?: Date;
  ingested_at: Date;
  metadata?: FeedbackMetadata;
}

export interface Emotion {
  emotion: EmotionType;
  confidence: number;
}

export interface Sentiment {
  label: SentimentLabel;
  confidence: number;
}

export interface ViralityFactors {
  toneSeverity: number;
  engagementVelocity: number;
  userInfluence: number;
}

export interface AnalysisResult {
  id: string;
  feedback_id: string;
  sentiment: Sentiment;
  emotions: Emotion[];
  virality_score: number;
  virality_factors: ViralityFactors;
  risk_level: RiskLevel;
  processed_at: Date;
}

// ResponseDraft moved to @/types/response.ts to avoid conflicts

// ResponseData moved to @/types/response.ts to avoid conflicts

export interface AlertData {
  id: string;
  feedback_id: string;
  severity: AlertSeverity;
  message: string;
  sent_slack: boolean;
  sent_email: boolean;
  resolved: boolean;
  created_at: Date;
  resolved_at?: Date;
}

// Combined interfaces for API responses
export interface FeedbackWithAnalysis extends FeedbackData {
  analysis?: AnalysisResult;
  response?: ResponseData;
  alert?: AlertData;
}

export interface AnalysisRequest {
  text: string;
  platform?: Platform;
  metadata?: FeedbackMetadata;
}

export interface AnalysisResponse {
  sentiment: Sentiment;
  emotions: Emotion[];
  virality_score: number;
  virality_factors: ViralityFactors;
  risk_level: RiskLevel;
  response_draft?: ResponseDraft;
}

// Aggregation interfaces for dashboard
export interface SentimentStats {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}

export type EmotionStats = {
  [key in EmotionType]?: number;
}

export interface PlatformStats {
  platform: Platform;
  count: number;
  sentiment_breakdown: SentimentStats;
  avg_virality_score: number;
}

export interface TimeSeriesData {
  timestamp: Date;
  sentiment_stats: SentimentStats;
  emotion_stats: EmotionStats;
  virality_avg: number;
  alert_count: number;
}

export interface HeatmapData {
  platform?: string;
  region?: string;
  topic?: string;
  emotions: EmotionStats;
  sentiment_breakdown: SentimentStats;
  total_feedback: number;
}

// Filter interfaces
export interface FeedbackFilters {
  platform?: Platform[];
  sentiment?: SentimentLabel[];
  risk_level?: RiskLevel[];
  date_from?: Date;
  date_to?: Date;
  has_alert?: boolean;
  emotions?: EmotionType[];
  min_virality_score?: number;
  max_virality_score?: number;
}

export interface AlertFilters {
  severity?: AlertSeverity[];
  resolved?: boolean;
  date_from?: Date;
  date_to?: Date;
  platform?: Platform[];
}

// Pagination interface
export interface PaginationOptions {
  page: number;
  limit: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}