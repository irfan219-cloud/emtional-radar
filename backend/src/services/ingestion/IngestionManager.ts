import { 
  PlatformAdapter, 
  IngestionJob, 
  IngestionResult, 
  IngestionConfig, 
  IngestionMetrics,
  IngestionSchedule
} from '@/types/ingestion';
import { Platform } from '@/types/feedback';
import { FeedbackRepository } from '@/repositories/FeedbackRepository';
import { RedisManager } from '@/utils/redis-manager';
import { REDIS_KEYS } from '@/utils/redis-keys';

export class IngestionManager {
  private adapters: Map<Platform, PlatformAdapter> = new Map();
  private activeJobs: Map<string, IngestionJob> = new Map();
  private feedbackRepository: FeedbackRepository;
  private isRunning: boolean = false;

  constructor() {
    this.feedbackRepository = new FeedbackRepository();
  }

  /**
   * Register a platform adapter
   */
  registerAdapter(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.platform, adapter);
    console.log(`📝 Registered ${adapter.platform} adapter`);
  }

  /**
   * Initialize all registered adapters
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing ingestion manager...');
    
    const initPromises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        await adapter.initialize();
        console.log(`✅ ${adapter.platform} adapter initialized`);
      } catch (error) {
        console.error(`❌ Failed to initialize ${adapter.platform} adapter:`, error);
      }
    });

    await Promise.allSettled(initPromises);
    this.isRunning = true;
    console.log('✅ Ingestion manager initialized');
  }

  /**
   * Start an ingestion job
   */
  async startJob(job: IngestionJob): Promise<string> {
    if (!this.isRunning) {
      throw new Error('Ingestion manager is not running');
    }

    const adapter = this.adapters.get(job.platform);
    if (!adapter) {
      throw new Error(`No adapter registered for platform: ${job.platform}`);
    }

    // Update job status
    job.status = 'running';
    job.startedAt = new Date();
    this.activeJobs.set(job.id, job);

    // Store job in Redis for persistence
    await RedisManager.cacheUserSession(`ingestion_job:${job.id}`, job);

    console.log(`🔄 Starting ingestion job ${job.id} for ${job.platform}`);

    // Run job asynchronously
    this.executeJob(job, adapter).catch(error => {
      console.error(`❌ Job ${job.id} failed:`, error);
    });

    return job.id;
  }

  /**
   * Execute an ingestion job
   */
  private async executeJob(job: IngestionJob, adapter: PlatformAdapter): Promise<void> {
    try {
      const result = await adapter.fetchFeedback(job);
      
      // Update job progress
      job.progress.processed = result.itemsProcessed;
      job.status = result.success ? 'completed' : 'failed';
      job.completedAt = new Date();

      if (!result.success && result.errors.length > 0) {
        job.error = result.errors.map(e => e.message).join('; ');
      }

      // Update metrics
      await this.updateMetrics(job.platform, result);

      console.log(`✅ Job ${job.id} completed: ${result.itemsProcessed} items processed`);

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date();
      
      console.error(`❌ Job ${job.id} failed:`, error);
    } finally {
      // Clean up
      this.activeJobs.delete(job.id);
      
      // Update job in Redis
      await RedisManager.cacheUserSession(`ingestion_job:${job.id}`, job);
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<IngestionJob | null> {
    // Check active jobs first
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      return activeJob;
    }

    // Check Redis for completed jobs
    return await RedisManager.getUserSession(`ingestion_job:${jobId}`);
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return false;
    }

    job.status = 'cancelled';
    job.completedAt = new Date();
    this.activeJobs.delete(jobId);

    await RedisManager.cacheUserSession(`ingestion_job:${jobId}`, job);
    
    console.log(`🛑 Job ${jobId} cancelled`);
    return true;
  }

  /**
   * Get active jobs
   */
  getActiveJobs(): IngestionJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Test connection for a platform
   */
  async testPlatformConnection(platform: Platform): Promise<boolean> {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new Error(`No adapter registered for platform: ${platform}`);
    }

    return await adapter.testConnection();
  }

  /**
   * Get metrics for a platform
   */
  async getMetrics(platform: Platform): Promise<IngestionMetrics | null> {
    return await RedisManager.getUserSession(`ingestion_metrics:${platform}`);
  }

  /**
   * Get metrics for all platforms
   */
  async getAllMetrics(): Promise<IngestionMetrics[]> {
    const metrics: IngestionMetrics[] = [];
    
    for (const platform of this.adapters.keys()) {
      const platformMetrics = await this.getMetrics(platform);
      if (platformMetrics) {
        metrics.push(platformMetrics);
      }
    }

    return metrics;
  }

  /**
   * Update metrics for a platform
   */
  private async updateMetrics(platform: Platform, result: IngestionResult): Promise<void> {
    const existingMetrics = await this.getMetrics(platform) || this.createDefaultMetrics(platform);
    
    // Update metrics
    existingMetrics.totalProcessed += result.itemsProcessed;
    existingMetrics.totalErrors += result.errors.length;
    existingMetrics.successRate = existingMetrics.totalProcessed / 
      (existingMetrics.totalProcessed + existingMetrics.totalErrors);
    existingMetrics.lastIngestionAt = new Date();

    // Update rate limit info
    if (result.rateLimit) {
      existingMetrics.rateLimit = {
        current: result.rateLimit.remaining,
        limit: existingMetrics.rateLimit.limit, // Keep existing limit
        resetAt: result.rateLimit.resetAt
      };
    }

    // Update error counts
    result.errors.forEach(error => {
      switch (error.type) {
        case 'api_error':
          existingMetrics.errors.apiErrors++;
          break;
        case 'rate_limit':
          existingMetrics.errors.rateLimitErrors++;
          break;
        case 'validation_error':
          existingMetrics.errors.validationErrors++;
          break;
        case 'network_error':
          existingMetrics.errors.networkErrors++;
          break;
        case 'auth_error':
          existingMetrics.errors.authErrors++;
          break;
      }
    });

    // Store updated metrics
    await RedisManager.cacheUserSession(`ingestion_metrics:${platform}`, existingMetrics);
  }

  /**
   * Create default metrics for a platform
   */
  private createDefaultMetrics(platform: Platform): IngestionMetrics {
    return {
      platform,
      totalProcessed: 0,
      totalErrors: 0,
      successRate: 0,
      averageProcessingTime: 0,
      rateLimit: {
        current: 0,
        limit: 1000, // Default limit
        resetAt: new Date()
      },
      errors: {
        apiErrors: 0,
        rateLimitErrors: 0,
        validationErrors: 0,
        networkErrors: 0,
        authErrors: 0
      }
    };
  }

  /**
   * Create a search job
   */
  createSearchJob(
    platform: Platform, 
    query: string, 
    options: {
      maxResults?: number;
      since?: Date;
      until?: Date;
    } = {}
  ): IngestionJob {
    return {
      id: this.generateJobId(),
      platform,
      type: 'search',
      query,
      maxResults: options.maxResults || 100,
      since: options.since,
      until: options.until,
      status: 'pending',
      createdAt: new Date(),
      progress: {
        processed: 0
      }
    };
  }

  /**
   * Create a user timeline job
   */
  createUserTimelineJob(
    platform: Platform,
    userId: string,
    options: {
      maxResults?: number;
      since?: Date;
      until?: Date;
    } = {}
  ): IngestionJob {
    return {
      id: this.generateJobId(),
      platform,
      type: 'user_timeline',
      userId,
      maxResults: options.maxResults || 100,
      since: options.since,
      until: options.until,
      status: 'pending',
      createdAt: new Date(),
      progress: {
        processed: 0
      }
    };
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown the ingestion manager
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down ingestion manager...');
    
    this.isRunning = false;

    // Cancel all active jobs
    for (const jobId of this.activeJobs.keys()) {
      await this.cancelJob(jobId);
    }

    // Cleanup all adapters
    const cleanupPromises = Array.from(this.adapters.values()).map(adapter => 
      adapter.cleanup().catch(error => 
        console.error(`❌ Error cleaning up ${adapter.platform} adapter:`, error)
      )
    );

    await Promise.allSettled(cleanupPromises);
    
    console.log('✅ Ingestion manager shut down');
  }

  /**
   * Get registered platforms
   */
  getRegisteredPlatforms(): Platform[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if platform is registered
   */
  isPlatformRegistered(platform: Platform): boolean {
    return this.adapters.has(platform);
  }
}