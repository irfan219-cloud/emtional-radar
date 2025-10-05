import Bull, { Queue, Job, JobOptions } from 'bull';
import { IngestionJob, IngestionResult, Platform } from '@/types/ingestion';
import { IngestionManager } from './IngestionManager';
import { FeedbackRepository } from '@/repositories/FeedbackRepository';
import { RedisManager } from '@/utils/redis-manager';
import { REDIS_KEYS } from '@/utils/redis-keys';

export interface QueueJobData {
  ingestionJob: IngestionJob;
  retryCount?: number;
}

export interface QueueOptions {
  concurrency?: number;
  maxRetries?: number;
  retryDelay?: number;
  removeOnComplete?: number;
  removeOnFail?: number;
}

export class IngestionQueue {
  private queue: Queue<QueueJobData>;
  private ingestionManager: IngestionManager;
  private feedbackRepository: FeedbackRepository;
  private isProcessing: boolean = false;

  constructor(
    ingestionManager: IngestionManager,
    redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379',
    options: QueueOptions = {}
  ) {
    this.ingestionManager = ingestionManager;
    this.feedbackRepository = new FeedbackRepository();
    
    // Create Bull queue
    this.queue = new Bull('ingestion-queue', redisUrl, {
      defaultJobOptions: {
        removeOnComplete: options.removeOnComplete || 100,
        removeOnFail: options.removeOnFail || 50,
        attempts: options.maxRetries || 3,
        backoff: {
          type: 'exponential',
          delay: options.retryDelay || 5000
        }
      }
    });

    this.setupQueueProcessors(options.concurrency || 5);
    this.setupQueueEventHandlers();
  }

  /**
   * Add an ingestion job to the queue
   */
  async addJob(
    ingestionJob: IngestionJob, 
    options: JobOptions = {}
  ): Promise<Job<QueueJobData>> {
    console.log(`📥 Adding ingestion job to queue: ${ingestionJob.id} (${ingestionJob.platform})`);
    
    const jobData: QueueJobData = {
      ingestionJob,
      retryCount: 0
    };

    const job = await this.queue.add(jobData, {
      jobId: ingestionJob.id,
      priority: this.getJobPriority(ingestionJob),
      delay: options.delay || 0,
      ...options
    });

    // Store job reference in Redis
    await RedisManager.cacheUserSession(`queue_job:${ingestionJob.id}`, {
      jobId: job.id,
      queueId: ingestionJob.id,
      status: 'queued',
      createdAt: new Date().toISOString()
    });

    return job;
  }

  /**
   * Add multiple jobs to the queue
   */
  async addBulkJobs(
    ingestionJobs: IngestionJob[], 
    options: JobOptions = {}
  ): Promise<Job<QueueJobData>[]> {
    console.log(`📥 Adding ${ingestionJobs.length} ingestion jobs to queue`);
    
    const jobsData = ingestionJobs.map(ingestionJob => ({
      data: { ingestionJob, retryCount: 0 } as QueueJobData,
      opts: {
        jobId: ingestionJob.id,
        priority: this.getJobPriority(ingestionJob),
        ...options
      }
    }));

    const jobs = await this.queue.addBulk(jobsData);

    // Store job references in Redis
    const cachePromises = jobs.map(job => 
      RedisManager.cacheUserSession(`queue_job:${job.data.ingestionJob.id}`, {
        jobId: job.id,
        queueId: job.data.ingestionJob.id,
        status: 'queued',
        createdAt: new Date().toISOString()
      })
    );

    await Promise.all(cachePromises);

    return jobs;
  }

  /**
   * Setup queue processors
   */
  private setupQueueProcessors(concurrency: number): void {
    this.queue.process(concurrency, async (job: Job<QueueJobData>) => {
      return await this.processIngestionJob(job);
    });

    console.log(`⚙️ Ingestion queue processors setup with concurrency: ${concurrency}`);
  }

  /**
   * Process an individual ingestion job
   */
  private async processIngestionJob(job: Job<QueueJobData>): Promise<IngestionResult> {
    const { ingestionJob, retryCount = 0 } = job.data;
    
    console.log(`🔄 Processing ingestion job: ${ingestionJob.id} (attempt ${retryCount + 1})`);
    
    try {
      // Update job status
      ingestionJob.status = 'running';
      ingestionJob.startedAt = new Date();
      
      // Update progress
      await job.progress(10);
      
      // Get the appropriate adapter and execute the job
      const jobId = await this.ingestionManager.startJob(ingestionJob);
      const result = await this.ingestionManager.getJobStatus(jobId);
      
      // Update progress
      await job.progress(50);
      
      // Store the feedback data in database
      if (result && result.status === 'completed') {
        await this.storeFeedbackData(ingestionJob, { 
          success: true, 
          itemsProcessed: result.progress.processed,
          itemsSkipped: 0,
          errors: [],
          platform: ingestionJob.platform
        });
      }
      
      // Update progress
      await job.progress(90);
      
      // Update job status
      ingestionJob.status = result && result.status === 'completed' ? 'completed' : 'failed';
      ingestionJob.completedAt = new Date();
      
      if (result && result.error) {
        ingestionJob.error = result.error;
      }
      
      // Final progress update
      await job.progress(100);
      
      // Store updated job
      await RedisManager.cacheUserSession(`ingestion_job:${ingestionJob.id}`, ingestionJob);
      
      console.log(`✅ Ingestion job completed: ${ingestionJob.id} (${result?.progress.processed || 0} items)`);
      
      return {
        success: result?.status === 'completed' || false,
        platform: ingestionJob.platform,
        itemsProcessed: result?.progress.processed || 0,
        itemsSkipped: 0,
        errors: result?.error ? [{ 
          type: 'api_error' as const, 
          message: result.error, 
          code: 'unknown', 
          retryable: true, 
          timestamp: new Date() 
        }] : []
      };
      
    } catch (error) {
      console.error(`❌ Ingestion job failed: ${ingestionJob.id}`, error);
      
      // Update job status
      ingestionJob.status = 'failed';
      ingestionJob.error = error instanceof Error ? error.message : 'Unknown error';
      ingestionJob.completedAt = new Date();
      
      // Store failed job
      await RedisManager.cacheUserSession(`ingestion_job:${ingestionJob.id}`, ingestionJob);
      
      throw error;
    }
  }

  /**
   * Store feedback data in database
   */
  private async storeFeedbackData(ingestionJob: IngestionJob, result: any): Promise<void> {
    // This is a simplified version - in a real implementation,
    // you would get the actual feedback items from the result
    // and store them in the database
    
    console.log(`💾 Storing ${result.itemsProcessed || 0} feedback items for job ${ingestionJob.id}`);
    
    // Add to Redis for real-time processing
    await RedisManager.addToLiveFeed({
      jobId: ingestionJob.id,
      platform: ingestionJob.platform,
      itemsProcessed: result.itemsProcessed || 0,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Setup queue event handlers
   */
  private setupQueueEventHandlers(): void {
    this.queue.on('completed', async (job: Job<QueueJobData>, result: IngestionResult) => {
      console.log(`✅ Queue job completed: ${job.id}`);
      
      // Update queue job status
      await RedisManager.cacheUserSession(`queue_job:${job.data.ingestionJob.id}`, {
        jobId: job.id,
        queueId: job.data.ingestionJob.id,
        status: 'completed',
        completedAt: new Date().toISOString(),
        result
      });
    });

    this.queue.on('failed', async (job: Job<QueueJobData>, error: Error) => {
      console.error(`❌ Queue job failed: ${job.id}`, error);
      
      // Update queue job status
      await RedisManager.cacheUserSession(`queue_job:${job.data.ingestionJob.id}`, {
        jobId: job.id,
        queueId: job.data.ingestionJob.id,
        status: 'failed',
        failedAt: new Date().toISOString(),
        error: error.message
      });
    });

    this.queue.on('stalled', async (job: Job<QueueJobData>) => {
      console.warn(`⚠️ Queue job stalled: ${job.id}`);
    });

    this.queue.on('progress', (job: Job<QueueJobData>, progress: number) => {
      console.log(`📊 Job progress: ${job.id} - ${progress}%`);
    });

    this.queue.on('active', (job: Job<QueueJobData>) => {
      console.log(`🔄 Job started: ${job.id}`);
    });

    this.queue.on('waiting', (jobId: string) => {
      console.log(`⏳ Job waiting: ${jobId}`);
    });
  }

  /**
   * Get job priority based on platform and type
   */
  private getJobPriority(ingestionJob: IngestionJob): number {
    // Higher numbers = higher priority
    let priority = 0;
    
    // Platform priority
    switch (ingestionJob.platform) {
      case 'twitter':
        priority += 100;
        break;
      case 'reddit':
        priority += 80;
        break;
      case 'trustpilot':
        priority += 60;
        break;
      case 'appstore':
        priority += 40;
        break;
    }
    
    // Job type priority
    switch (ingestionJob.type) {
      case 'search':
        priority += 20;
        break;
      case 'mentions':
        priority += 30;
        break;
      case 'user_timeline':
        priority += 10;
        break;
    }
    
    return priority;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaiting(),
      this.queue.getActive(),
      this.queue.getCompleted(),
      this.queue.getFailed(),
      this.queue.getDelayed()
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length
    };
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'): Promise<Job<QueueJobData>[]> {
    switch (status) {
      case 'waiting':
        return await this.queue.getWaiting();
      case 'active':
        return await this.queue.getActive();
      case 'completed':
        return await this.queue.getCompleted();
      case 'failed':
        return await this.queue.getFailed();
      case 'delayed':
        return await this.queue.getDelayed();
      default:
        return [];
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.queue.getJob(jobId);
      if (job) {
        await job.remove();
        console.log(`🛑 Cancelled job: ${jobId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.queue.getJob(jobId);
      if (job && job.opts.attempts && job.attemptsMade < job.opts.attempts) {
        await job.retry();
        console.log(`🔄 Retrying job: ${jobId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Failed to retry job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Clean old jobs from the queue
   */
  async cleanQueue(grace: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      await this.queue.clean(grace, 'completed');
      await this.queue.clean(grace, 'failed');
      console.log(`🧹 Cleaned old jobs from queue (grace period: ${grace}ms)`);
    } catch (error) {
      console.error('❌ Failed to clean queue:', error);
    }
  }

  /**
   * Pause the queue
   */
  async pauseQueue(): Promise<void> {
    await this.queue.pause();
    this.isProcessing = false;
    console.log('⏸️ Ingestion queue paused');
  }

  /**
   * Resume the queue
   */
  async resumeQueue(): Promise<void> {
    await this.queue.resume();
    this.isProcessing = true;
    console.log('▶️ Ingestion queue resumed');
  }

  /**
   * Get queue health status
   */
  async getHealthStatus(): Promise<{
    isHealthy: boolean;
    isProcessing: boolean;
    stats: any;
    errors: string[];
  }> {
    const errors: string[] = [];
    let isHealthy = true;

    try {
      const stats = await this.getQueueStats();
      
      // Check if queue is processing
      if (!this.isProcessing) {
        errors.push('Queue is not processing jobs');
        isHealthy = false;
      }

      // Check for too many failed jobs
      if (stats.failed > 100) {
        errors.push(`Too many failed jobs: ${stats.failed}`);
        isHealthy = false;
      }

      return {
        isHealthy,
        isProcessing: this.isProcessing,
        stats,
        errors
      };
    } catch (error) {
      return {
        isHealthy: false,
        isProcessing: false,
        stats: null,
        errors: [`Queue health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Shutdown the queue
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down ingestion queue...');
    
    await this.queue.close();
    this.isProcessing = false;
    
    console.log('✅ Ingestion queue shut down');
  }
}