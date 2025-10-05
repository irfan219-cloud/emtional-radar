import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { 
  PlatformAdapter, 
  IngestionConfig, 
  IngestionJob, 
  IngestionResult, 
  IngestionError, 
  RawFeedbackItem,
  SearchOptions,
  UserFeedbackOptions
} from '@/types/ingestion';
import { Platform, FeedbackData } from '@/types/feedback';

export abstract class BasePlatformAdapter implements PlatformAdapter {
  public readonly platform: Platform;
  public readonly config: IngestionConfig;
  protected httpClient: AxiosInstance;
  protected isInitialized: boolean = false;
  protected isAuthenticated: boolean = false;
  protected rateLimitInfo: { remaining: number; resetAt: Date } = {
    remaining: 0,
    resetAt: new Date()
  };

  constructor(platform: Platform, config: IngestionConfig) {
    this.platform = platform;
    this.config = config;
    this.httpClient = this.createHttpClient();
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.setupHttpClient();
      await this.authenticate();
      this.isInitialized = true;
      console.log(`✅ ${this.platform} adapter initialized successfully`);
    } catch (error) {
      console.error(`❌ Failed to initialize ${this.platform} adapter:`, error);
      throw error;
    }
  }

  /**
   * Test connection to the platform
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('GET', this.getHealthCheckEndpoint());
      return true;
    } catch (error) {
      console.error(`❌ Connection test failed for ${this.platform}:`, error);
      return false;
    }
  }

  /**
   * Fetch feedback based on ingestion job
   */
  async fetchFeedback(job: IngestionJob): Promise<IngestionResult> {
    const result: IngestionResult = {
      success: false,
      platform: this.platform,
      itemsProcessed: 0,
      itemsSkipped: 0,
      errors: []
    };

    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Check rate limits before proceeding
      const rateLimitCheck = await this.checkRateLimit();
      if (rateLimitCheck.remaining <= 0) {
        throw new Error(`Rate limit exceeded. Resets at ${rateLimitCheck.resetAt}`);
      }

      let rawItems: RawFeedbackItem[] = [];

      switch (job.type) {
        case 'search':
          if (!job.query) {
            throw new Error('Search query is required for search jobs');
          }
          rawItems = await this.searchFeedback(job.query, {
            maxResults: job.maxResults,
            since: job.since,
            until: job.until
          });
          break;

        case 'user_timeline':
          if (!job.userId) {
            throw new Error('User ID is required for user timeline jobs');
          }
          rawItems = await this.getUserFeedback(job.userId, {
            maxResults: job.maxResults,
            since: job.since,
            until: job.until
          });
          break;

        default:
          throw new Error(`Unsupported job type: ${job.type}`);
      }

      // Process each raw item
      for (const rawItem of rawItems) {
        try {
          if (this.validateRawItem(rawItem)) {
            const feedbackData = this.transformToFeedback(rawItem);
            // Here you would typically save to database
            result.itemsProcessed++;
          } else {
            result.itemsSkipped++;
          }
        } catch (error) {
          const ingestionError = this.handleError(error);
          result.errors.push(ingestionError);
        }
      }

      result.success = result.errors.length === 0 || result.itemsProcessed > 0;
      result.rateLimit = await this.checkRateLimit();

    } catch (error) {
      const ingestionError = this.handleError(error);
      result.errors.push(ingestionError);
      result.success = false;
    }

    return result;
  }

  /**
   * Check current rate limit status
   */
  async checkRateLimit(): Promise<{ remaining: number; resetAt: Date }> {
    return this.rateLimitInfo;
  }

  /**
   * Handle and categorize errors
   */
  handleError(error: any): IngestionError {
    let errorType: IngestionError['type'] = 'network_error';
    let retryable = true;
    let message = 'Unknown error occurred';
    let code: string | undefined;

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      message = error.message;
      code = status?.toString();

      switch (status) {
        case 401:
        case 403:
          errorType = 'auth_error';
          retryable = false;
          break;
        case 429:
          errorType = 'rate_limit';
          retryable = true;
          break;
        case 400:
        case 422:
          errorType = 'validation_error';
          retryable = false;
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          errorType = 'api_error';
          retryable = true;
          break;
        default:
          errorType = 'network_error';
          retryable = true;
      }
    } else if (error instanceof Error) {
      message = error.message;
    }

    return {
      type: errorType,
      message,
      code,
      retryable,
      timestamp: new Date(),
      context: error
    };
  }

  /**
   * Determine if an error should trigger a retry
   */
  shouldRetry(error: IngestionError): boolean {
    if (!error.retryable) {
      return false;
    }

    // Don't retry auth errors
    if (error.type === 'auth_error') {
      return false;
    }

    // Rate limit errors should be retried after delay
    if (error.type === 'rate_limit') {
      return true;
    }

    // Retry network and API errors
    return error.type === 'network_error' || error.type === 'api_error';
  }

  /**
   * Validate raw item before processing
   */
  validateRawItem(rawItem: any): boolean {
    if (!rawItem || typeof rawItem !== 'object') {
      return false;
    }

    // Check required fields
    if (!rawItem.id || !rawItem.content || !rawItem.author) {
      return false;
    }

    // Check content length
    if (typeof rawItem.content !== 'string' || rawItem.content.trim().length === 0) {
      return false;
    }

    // Check author information
    if (!rawItem.author.username) {
      return false;
    }

    return true;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.isInitialized = false;
    this.isAuthenticated = false;
    console.log(`🧹 ${this.platform} adapter cleaned up`);
  }

  /**
   * Make HTTP request with retry logic
   */
  protected async makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse> {
    const maxRetries = this.config.retryConfig.maxRetries;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.httpClient.request({
          method,
          url,
          ...config
        });

        // Update rate limit info from response headers
        this.updateRateLimitInfo(response);
        
        return response;
      } catch (error) {
        lastError = error;
        const ingestionError = this.handleError(error);

        // Don't retry on last attempt or non-retryable errors
        if (attempt === maxRetries || !this.shouldRetry(ingestionError)) {
          throw error;
        }

        // Calculate delay for retry
        const delay = this.calculateRetryDelay(attempt);
        console.log(`⏳ Retrying ${this.platform} request in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  protected calculateRetryDelay(attempt: number): number {
    const { baseDelay, maxDelay, backoffMultiplier } = this.config.retryConfig;
    const delay = baseDelay * Math.pow(backoffMultiplier, attempt);
    return Math.min(delay, maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update rate limit information from response headers
   */
  protected updateRateLimitInfo(response: AxiosResponse): void {
    // This will be overridden by platform-specific implementations
    // as each platform has different header names for rate limiting
  }

  /**
   * Create HTTP client with default configuration
   */
  protected createHttpClient(): AxiosInstance {
    return axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'Customer-Feedback-Analyzer/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
  }

  // Abstract methods that must be implemented by concrete adapters
  protected abstract setupHttpClient(): Promise<void>;
  public abstract authenticate(): Promise<boolean>;
  protected abstract getHealthCheckEndpoint(): string;
  public abstract searchFeedback(query: string, options?: SearchOptions): Promise<RawFeedbackItem[]>;
  public abstract getUserFeedback(userId: string, options?: UserFeedbackOptions): Promise<RawFeedbackItem[]>;
  public abstract transformToFeedback(rawItem: RawFeedbackItem): FeedbackData;
}