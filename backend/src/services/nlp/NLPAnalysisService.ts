import Bull, { Queue, Job, JobOptions } from 'bull';
import { 
  NLPConfig, 
  NLPAnalysisRequest, 
  NLPAnalysisResult, 
  BatchNLPRequest, 
  BatchNLPResult,
  NLPQueueJob,
  NLPMetrics
} from '@/types/nlp';
import { AnalysisResult } from '@/types/feedback';
import { SentimentAnalysisService } from './SentimentAnalysisService';
import { EmotionAnalysisService } from './EmotionAnalysisService';
import { TextPreprocessor } from './TextPreprocessor';
import { HuggingFaceProvider } from './providers/HuggingFaceProvider';
import { FeedbackRepository } from '@/repositories/FeedbackRepository';
import { AnalysisRepository } from '@/repositories/AnalysisRepository';
import { RedisManager } from '@/utils/redis-manager';

export interface NLPQueueOptions {
  concurrency?: number;
  maxRetries?: number;
  retryDelay?: number;
  removeOnComplete?: number;
  removeOnFail?: number;
}

export class NLPAnalysisService {
  private config: NLPConfig;
  private queue: Queue<NLPQueueJob>;
  private sentimentService: SentimentAnalysisService;
  private emotionService: EmotionAnalysisService;
  private feedbackRepository: FeedbackRepository;
  private analysisRepository: AnalysisRepository;
  private providers: Map<string, any> = new Map();
  private isProcessing: boolean = false;

  constructor(
    config: NLPConfig,
    redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379',
    options: NLPQueueOptions = {}
  ) {
    this.config = config;
    this.feedbackRepository = new FeedbackRepository();
    this.analysisRepository = new AnalysisRepository();

    // Initialize providers
    this.initializeProviders();

    // Initialize services
    this.sentimentService = new SentimentAnalysisService(config);
    this.emotionService = new EmotionAnalysisService(config, this.providers);

    // Create Bull queue
    this.queue = new Bull('nlp-analysis-queue', redisUrl, {
      defaultJobOptions: {
        removeOnComplete: options.removeOnComplete || 100,
        removeOnFail: options.removeOnFail || 50,
        attempts: options.maxRetries || 3,
        backoff: {
          type: 'exponential',
          delay: options.retryDelay || 2000
        }
      }
    });

    this.setupQueueProcessors(options.concurrency || 3);
    this.setupQueueEventHandlers();
  }

  /**
   * Initialize NLP providers
   */
  private initializeProviders(): void {
    // Initialize Hugging Face provider if configured
    if (this.config.sentimentModel.provider === 'huggingface' && this.config.sentimentModel.apiKey) {
      const hfProvider = new HuggingFaceProvider({
        apiKey: this.config.sentimentModel.apiKey,
        sentimentModel: this.config.sentimentModel.modelName,
        emotionModel: this.config.emotionModel.modelName
      });

      this.providers.set('huggingface', hfProvider);
      console.log('✅ HuggingFace provider initialized for NLP analysis');
    }
  }

  /**
   * Analyze single feedback text
   */
  async analyzeFeedback(request: NLPAnalysisRequest): Promise<NLPAnalysisResult> {
    const startTime = Date.now();
    const id = request.id || this.generateAnalysisId();

    try {
      // Assess text quality
      const quality = TextPreprocessor.assessTextQuality(request.text);
      if (!quality.isValid) {
        throw new Error(`Text quality insufficient: ${quality.issues.join(', ')}`);
      }

      // Preprocess text
      const processedText = TextPreprocessor.preprocess(
        request.text,
        request.preprocessingOptions
      );

      // Run sentiment and emotion analysis in parallel
      const [sentimentResult, emotionResult] = await Promise.all([
        this.sentimentService.analyzeSentiment({ ...request, text: processedText }),
        this.emotionService.analyzeEmotions({ ...request, text: processedText })
      ]);

      const result: NLPAnalysisResult = {
        id,
        text: request.text,
        processedText,
        sentiment: sentimentResult,
        emotions: emotionResult,
        language: request.language,
        processingTime: Date.now() - startTime,
        timestamp: new Date(),
        cached: false
      };

      return result;
    } catch (error) {
      console.error(`NLP analysis failed for request ${id}:`, error);
      throw error;
    }
  }

  /**
   * Queue single analysis job
   */
  async queueAnalysis(
    request: NLPAnalysisRequest,
    options: JobOptions = {}
  ): Promise<Job<NLPQueueJob>> {
    const jobData: NLPQueueJob = {
      id: this.generateJobId(),
      type: 'single',
      data: request,
      priority: options.priority as any || 'normal',
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: this.config.sentimentModel.threshold || 3
    };

    const job = await this.queue.add(jobData, {
      jobId: jobData.id,
      priority: this.getJobPriority(jobData.priority),
      delay: options.delay || 0,
      ...options
    });

    console.log(`📥 Queued NLP analysis job: ${jobData.id}`);
    return job;
  }

  /**
   * Queue batch analysis job
   */
  async queueBatchAnalysis(
    request: BatchNLPRequest,
    options: JobOptions = {}
  ): Promise<Job<NLPQueueJob>> {
    const jobData: NLPQueueJob = {
      id: request.batchId || this.generateJobId(),
      type: 'batch',
      data: request,
      priority: request.priority || 'normal',
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 2 // Fewer retries for batch jobs
    };

    const job = await this.queue.add(jobData, {
      jobId: jobData.id,
      priority: this.getJobPriority(jobData.priority),
      delay: options.delay || 0,
      ...options
    });

    console.log(`📥 Queued batch NLP analysis job: ${jobData.id} (${request.items.length} items)`);
    return job;
  }

  /**
   * Process feedback from database
   */
  async processPendingFeedback(limit: number = 50): Promise<void> {
    try {
      // Get unanalyzed feedback from database
      const unanalyzedFeedback = await this.feedbackRepository.findUnanalyzed(limit);
      
      if (unanalyzedFeedback.length === 0) {
        console.log('📊 No pending feedback to analyze');
        return;
      }

      console.log(`📊 Processing ${unanalyzedFeedback.length} pending feedback items`);

      // Create batch analysis request
      const batchRequest: BatchNLPRequest = {
        batchId: `pending_${Date.now()}`,
        items: unanalyzedFeedback.map(feedback => ({
          id: feedback.id,
          text: feedback.content,
          platform: feedback.platform
        })),
        priority: 'normal'
      };

      // Queue batch analysis
      await this.queueBatchAnalysis(batchRequest);
    } catch (error) {
      console.error('Failed to process pending feedback:', error);
    }
  }

  /**
   * Setup queue processors
   */
  private setupQueueProcessors(concurrency: number): void {
    this.queue.process(concurrency, async (job: Job<NLPQueueJob>) => {
      return await this.processNLPJob(job);
    });

    console.log(`⚙️ NLP analysis queue processors setup with concurrency: ${concurrency}`);
  }

  /**
   * Process individual NLP job
   */
  private async processNLPJob(job: Job<NLPQueueJob>): Promise<NLPAnalysisResult | BatchNLPResult> {
    const jobData = job.data;
    
    try {
      jobData.status = 'processing';
      jobData.startedAt = new Date();
      
      await job.progress(10);

      if (jobData.type === 'single') {
        // Process single analysis
        const request = jobData.data as NLPAnalysisRequest;
        const result = await this.analyzeFeedback(request);
        
        await job.progress(70);

        // Store result in database if it's linked to feedback
        if (request.id) {
          await this.storeAnalysisResult(request.id, result);
        }

        await job.progress(100);
        
        jobData.status = 'completed';
        jobData.completedAt = new Date();
        jobData.result = result;

        return result;
      } else {
        // Process batch analysis
        const batchRequest = jobData.data as BatchNLPRequest;
        const result = await this.processBatchAnalysis(batchRequest, job);
        
        jobData.status = 'completed';
        jobData.completedAt = new Date();
        jobData.result = result;

        return result;
      }
    } catch (error) {
      jobData.status = 'failed';
      jobData.error = error instanceof Error ? error.message : 'Unknown error';
      jobData.completedAt = new Date();
      
      console.error(`❌ NLP job failed: ${jobData.id}`, error);
      throw error;
    }
  }

  /**
   * Process batch analysis
   */
  private async processBatchAnalysis(
    batchRequest: BatchNLPRequest,
    job: Job<NLPQueueJob>
  ): Promise<BatchNLPResult> {
    const startTime = Date.now();
    const results: NLPAnalysisResult[] = [];
    const errors: Array<{ index: number; error: string; item: NLPAnalysisRequest }> = [];

    const totalItems = batchRequest.items.length;
    let processedItems = 0;

    // Process items in smaller batches to avoid overwhelming the system
    const batchSize = Math.min(this.config.batchSize || 10, 20);
    
    for (let i = 0; i < totalItems; i += batchSize) {
      const batch = batchRequest.items.slice(i, i + batchSize);
      
      try {
        // Process batch items in parallel
        const batchPromises = batch.map(async (item, batchIndex) => {
          try {
            const result = await this.analyzeFeedback(item);
            
            // Store result in database if it's linked to feedback
            if (item.id) {
              await this.storeAnalysisResult(item.id, result);
            }
            
            return { success: true, result, index: i + batchIndex };
          } catch (error) {
            return { 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown error',
              item,
              index: i + batchIndex
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        // Process batch results
        batchResults.forEach(batchResult => {
          if (batchResult.success) {
            results.push(batchResult.result);
          } else {
            errors.push({
              index: batchResult.index,
              error: batchResult.error,
              item: batchResult.item
            });
          }
        });

        processedItems += batch.length;
        
        // Update progress
        const progress = Math.floor((processedItems / totalItems) * 90) + 10;
        await job.progress(progress);
        
      } catch (error) {
        console.error(`Batch processing failed for items ${i}-${i + batchSize - 1}:`, error);
        
        // Add errors for all items in failed batch
        batch.forEach((item, batchIndex) => {
          errors.push({
            index: i + batchIndex,
            error: error instanceof Error ? error.message : 'Batch processing failed',
            item
          });
        });
      }

      // Add small delay between batches to prevent overwhelming
      if (i + batchSize < totalItems) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    await job.progress(100);

    const batchResult: BatchNLPResult = {
      batchId: batchRequest.batchId || 'unknown',
      results,
      errors,
      totalProcessed: results.length,
      totalErrors: errors.length,
      processingTime: Date.now() - startTime,
      timestamp: new Date()
    };

    console.log(`✅ Batch analysis completed: ${results.length} processed, ${errors.length} errors`);
    
    return batchResult;
  }

  /**
   * Store analysis result in database
   */
  private async storeAnalysisResult(feedbackId: string, nlpResult: NLPAnalysisResult): Promise<void> {
    try {
      const analysisData: Omit<AnalysisResult, 'id' | 'processed_at'> = {
        feedback_id: feedbackId,
        sentiment: nlpResult.sentiment.sentiment,
        emotions: nlpResult.emotions.emotions,
        virality_score: 0, // Will be calculated by virality service
        virality_factors: {
          toneSeverity: 0,
          engagementVelocity: 0,
          userInfluence: 0
        },
        risk_level: 'low' // Will be determined by virality service
      };

      await this.analysisRepository.create(analysisData);
      
      // Add to Redis for real-time processing
      await RedisManager.addToPendingAnalysis(feedbackId);
      
    } catch (error) {
      console.error(`Failed to store analysis result for feedback ${feedbackId}:`, error);
    }
  }

  /**
   * Setup queue event handlers
   */
  private setupQueueEventHandlers(): void {
    this.queue.on('completed', (job: Job<NLPQueueJob>) => {
      console.log(`✅ NLP job completed: ${job.id}`);
    });

    this.queue.on('failed', (job: Job<NLPQueueJob>, error: Error) => {
      console.error(`❌ NLP job failed: ${job.id}`, error);
    });

    this.queue.on('stalled', (job: Job<NLPQueueJob>) => {
      console.warn(`⚠️ NLP job stalled: ${job.id}`);
    });

    this.queue.on('progress', (job: Job<NLPQueueJob>, progress: number) => {
      if (progress % 25 === 0) { // Log every 25% progress
        console.log(`📊 NLP job progress: ${job.id} - ${progress}%`);
      }
    });
  }

  /**
   * Get job priority number
   */
  private getJobPriority(priority: 'low' | 'normal' | 'high'): number {
    switch (priority) {
      case 'high': return 100;
      case 'normal': return 50;
      case 'low': return 10;
      default: return 50;
    }
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `nlp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique analysis ID
   */
  private generateAnalysisId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
   * Get NLP metrics
   */
  async getMetrics(): Promise<NLPMetrics> {
    const [sentimentMetrics, emotionMetrics] = await Promise.all([
      RedisManager.getUserSession('nlp_metrics_sentiment'),
      RedisManager.getUserSession('nlp_metrics_emotion')
    ]);

    return {
      totalAnalyzed: (sentimentMetrics?.totalAnalyzed || 0) + (emotionMetrics?.totalAnalyzed || 0),
      sentimentDistribution: sentimentMetrics?.sentimentDistribution || {},
      emotionDistribution: emotionMetrics?.emotionDistribution || {},
      averageConfidence: {
        sentiment: sentimentMetrics?.averageConfidence || 0,
        emotion: emotionMetrics?.averageConfidence || 0
      },
      averageProcessingTime: Math.max(
        sentimentMetrics?.averageProcessingTime || 0,
        emotionMetrics?.averageProcessingTime || 0
      ),
      cacheHitRate: 0, // Would need to track this separately
      errorRate: 0, // Would need to track this separately
      modelsUsed: {
        ...sentimentMetrics?.modelsUsed,
        ...emotionMetrics?.modelsUsed
      },
      lastAnalyzedAt: sentimentMetrics?.lastAnalyzedAt || emotionMetrics?.lastAnalyzedAt
    };
  }

  /**
   * Pause the queue
   */
  async pauseQueue(): Promise<void> {
    await this.queue.pause();
    this.isProcessing = false;
    console.log('⏸️ NLP analysis queue paused');
  }

  /**
   * Resume the queue
   */
  async resumeQueue(): Promise<void> {
    await this.queue.resume();
    this.isProcessing = true;
    console.log('▶️ NLP analysis queue resumed');
  }

  /**
   * Clean old jobs from queue
   */
  async cleanQueue(grace: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      await this.queue.clean(grace, 'completed');
      await this.queue.clean(grace, 'failed');
      console.log(`🧹 Cleaned old NLP jobs from queue (grace period: ${grace}ms)`);
    } catch (error) {
      console.error('Failed to clean NLP queue:', error);
    }
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down NLP analysis service...');
    
    await this.queue.close();
    this.isProcessing = false;
    
    console.log('✅ NLP analysis service shut down');
  }
}