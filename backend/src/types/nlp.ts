import { SentimentLabel, EmotionType, Emotion, Sentiment } from './feedback';

export interface NLPConfig {
  sentimentModel: {
    provider: 'huggingface' | 'openai' | 'local';
    modelName: string;
    apiKey?: string;
    threshold: number;
  };
  emotionModel: {
    provider: 'huggingface' | 'openai' | 'local';
    modelName: string;
    apiKey?: string;
    threshold: number;
  };
  batchSize: number;
  maxTextLength: number;
  cacheResults: boolean;
  cacheTTL: number; // in seconds
}

export interface TextPreprocessingOptions {
  removeUrls: boolean;
  removeMentions: boolean;
  removeHashtags: boolean;
  removeEmojis: boolean;
  normalizeWhitespace: boolean;
  convertToLowercase: boolean;
  removeSpecialChars: boolean;
  maxLength: number;
}

export interface SentimentAnalysisResult {
  sentiment: Sentiment;
  confidence: number;
  scores: {
    positive: number;
    neutral: number;
    negative: number;
  };
  processingTime: number;
  modelUsed: string;
}

export interface EmotionAnalysisResult {
  emotions: Emotion[];
  primaryEmotion: EmotionType;
  confidence: number;
  scores: Record<EmotionType, number>;
  processingTime: number;
  modelUsed: string;
}

export interface NLPAnalysisRequest {
  text: string;
  id?: string;
  platform?: string;
  language?: string;
  preprocessingOptions?: Partial<TextPreprocessingOptions>;
  skipCache?: boolean;
}

export interface NLPAnalysisResult {
  id: string;
  text: string;
  processedText: string;
  sentiment: SentimentAnalysisResult;
  emotions: EmotionAnalysisResult;
  language?: string;
  processingTime: number;
  timestamp: Date;
  cached: boolean;
}

export interface BatchNLPRequest {
  items: NLPAnalysisRequest[];
  batchId?: string;
  priority?: 'low' | 'normal' | 'high';
}

export interface BatchNLPResult {
  batchId: string;
  results: NLPAnalysisResult[];
  errors: Array<{
    index: number;
    error: string;
    item: NLPAnalysisRequest;
  }>;
  totalProcessed: number;
  totalErrors: number;
  processingTime: number;
  timestamp: Date;
}

export interface NLPModelProvider {
  name: string;
  analyzeSentiment(text: string): Promise<SentimentAnalysisResult>;
  analyzeEmotions(text: string): Promise<EmotionAnalysisResult>;
  isAvailable(): Promise<boolean>;
  getModelInfo(): {
    sentimentModel: string;
    emotionModel: string;
    version: string;
    capabilities: string[];
  };
}

export interface NLPMetrics {
  totalAnalyzed: number;
  sentimentDistribution: Record<SentimentLabel, number>;
  emotionDistribution: Record<EmotionType, number>;
  averageConfidence: {
    sentiment: number;
    emotion: number;
  };
  averageProcessingTime: number;
  cacheHitRate: number;
  errorRate: number;
  modelsUsed: Record<string, number>;
  lastAnalyzedAt?: Date;
}

export interface NLPQueueJob {
  id: string;
  type: 'single' | 'batch';
  data: NLPAnalysisRequest | BatchNLPRequest;
  priority: 'low' | 'normal' | 'high';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: NLPAnalysisResult | BatchNLPResult;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

// Hugging Face specific types
export interface HuggingFaceResponse {
  label: string;
  score: number;
}

export interface HuggingFaceSentimentResponse extends Array<HuggingFaceResponse> {}

export interface HuggingFaceEmotionResponse extends Array<HuggingFaceResponse> {}

// OpenAI specific types
export interface OpenAIAnalysisRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user';
    content: string;
  }>;
  temperature: number;
  max_tokens: number;
}

export interface OpenAIAnalysisResponse {
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Language detection types
export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  supportedForAnalysis: boolean;
}

// Text quality assessment
export interface TextQualityAssessment {
  isValid: boolean;
  length: number;
  wordCount: number;
  hasEmojis: boolean;
  hasUrls: boolean;
  hasMentions: boolean;
  hasHashtags: boolean;
  language?: string;
  qualityScore: number; // 0-1
  issues: string[];
}