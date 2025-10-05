import Bull, { Queue, Job, JobOptions } from 'bull';
import { ResponseGenerationService } from './ResponseGenerationService';
import { 
  ResponseQueue, 
  ResponseBatch, 
  ResponseWorkflow, 
  ResponseTone,
  ResponseChannel,
  ResponseStatus,
  CreateResponseRequest,
  ApproveResponseRequest,
  SendResponseRequest
} from '@/types/response';
import { FeedbackData, AnalysisResult } from '@/types/feedback';
import { ResponseRepository } from '@/repositories/ResponseRepository';
import { FeedbackRepository } from '@/repositories/FeedbackRepository';
import { AlertRepository } from '@/repositories/AlertRepository';
import { UserRepository } from '@/repositories/UserRepository';

export interface ResponsePipelineConfig {
  queueName: string;
  concurrency: number;
  maxRetries: number;
  retryDelay: number;
  autoApproveThreshold: number;
  requireHumanReview: boolean;
  notificationSettings: {
    email: boolean;
    slack: boolean;
    webhooks: string[];
  };
}

export interface ResponseJobData {
  type: 'generate' | 'approve' | 'send' | 'batch';
  feedbackId?: string;
  responseId?: string;
  batchId?: string;
  tone?: ResponseTone;
  channel?: ResponseChannel;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  metadata?: Record<string, any>;
}

export interface PipelineMetrics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  queueLength: number;
  activeJobs: number;
  throughput: number; // jobs per hour
}

export class ResponsePipelineService {
  private queue: Queue<ResponseJobData>;
  private generationService: ResponseGenerationService;
  private responseRepo: ResponseRepository;
  private feedbackRepo: FeedbackRepository;
  private alertRepo: AlertRepository;
  private userRepo: UserRepository;
  private config: ResponsePipelineConfig;
  private isProcessing: boolean = false;

  constructor(
    generationService: ResponseGenerationService,
    responseRepo: ResponseRepository,
    feedbackRepo: FeedbackRepository,
    alertRepo: AlertRepository,
    userRepo: UserRepository,
    config: ResponsePipelineConfig,
    redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379'
  ) {
    this.generationService = generationService;
    this.responseRepo = responseRepo;
    this.feedbackRepo = feedbackRepo;
    this.alertRepo = alertRepo;
    this.userRepo = userRepo;
    this.config = config;

    // Initialize Bull queue
    this.queue = new Bull(config.queueName, redisUrl, {
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: config.maxRetries,
        backoff: {
          type: 'exponential',
          delay: config.retryDelay
        }
      }
    });

    this.setupJobProcessors();
    this.setupEventHandlers();
  }

  /**
   * Queue response generation for feedback
   */
  async queueResponseGeneration(
    feedbackId: string,
    tone?: ResponseTone,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
  ): Promise<string> {
    const jobData: ResponseJobData = {
      type: 'generate',
      feedbackId,
      tone,
      priority
    };

    const jobOptions: JobOptions = {
      priority: this.getPriorityValue(priority),
      delay: priority === 'urgent' ? 0 : 1000 // Urgent jobs start immediately
    };

    const job = await this.queue.add('response-generation', jobData, jobOptions);
    
    console.log(`📝 Queued response generation for feedback ${feedbackId} (Job: ${job.id})`);
    return job.id?.toString() || '';
  }

  /**
   * Queue batch response generation
   */
  async queueBatchGeneration(
    feedbackIds: string[],
    tone?: ResponseTone,
    batchName?: string
  ): Promise<string> {
    // Create batch record
    const batch: Omit<ResponseBatch, 'id'> = {
      name: batchName || `Batch ${new Date().toISOString()}`,
      description: `Batch response generation for ${feedbackIds.length} feedback items`,
      feedbackIds,
      tone: tone || 'professional',
      status: 'pending',
      progress: {
        total: feedbackIds.length,
        processed: 0,
        successful: 0,
        failed: 0
      },
      createdBy: 'system', // This should come from the authenticated user
      createdAt: new Date()
    };

    // Store batch (assuming we have a batch repository)
    const batchId = `batch_${Date.now()}`;

    const jobData: ResponseJobData = {
      type: 'batch',
      batchId,
      tone,
      priority: 'medium',
      metadata: { feedbackIds, batchName }
    };

    const job = await this.queue.add('batch-generation', jobData);
    
    console.log(`📦 Queued batch response generation for ${feedbackIds.length} items (Job: ${job.id})`);
    return job.id?.toString() || '';
  }

  /**
   * Queue response approval
   */
  async queueResponseApproval(
    responseId: string,
    approvalData: ApproveResponseRequest
  ): Promise<string> {
    const jobData: ResponseJobData = {
      type: 'approve',
      responseId,
      priority: 'high',
      metadata: approvalData
    };

    const job = await this.queue.add('response-approval', jobData);
    
    console.log(`✅ Queued response approval for response ${responseId} (Job: ${job.id})`);
    return job.id?.toString() || '';
  }

  /**
   * Queue response sending
   */
  async queueResponseSending(
    responseId: string,
    sendData: SendResponseRequest
  ): Promise<string> {
    const jobData: ResponseJobData = {
      type: 'send',
      responseId,
      priority: 'high',
      metadata: sendData
    };

    const job = await this.queue.add('response-sending', jobData);
    
    console.log(`📤 Queued response sending for response ${responseId} (Job: ${job.id})`);
    return job.id?.toString() || '';
  }

  /**
   * Process pending feedback automatically
   */
  async processPendingFeedback(limit: number = 50): Promise<void> {
    try {
      // Get high-priority feedback (alerts, high virality)
      const alerts = await this.alertRepo.getPendingNotifications();
      const highPriorityIds = alerts.slice(0, Math.min(limit, 20)).map(alert => alert.feedback_id);

      // Queue high-priority responses
      for (const feedbackId of highPriorityIds) {
        await this.queueResponseGeneration(feedbackId, 'apologetic', 'urgent');
      }

      // Get recent feedback without responses
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
      const recentFeedback = await this.feedbackRepo.findMany({
        where: [{ field: 'ingested_at', operator: '>=' as const, value: since }],
        orderBy: [{ field: 'ingested_at', direction: 'DESC' }]
      }).then(results => results.slice(0, limit - highPriorityIds.length));

      // Queue normal priority responses
      for (const feedback of recentFeedback) {
        if (!highPriorityIds.includes(feedback.id)) {
          await this.queueResponseGeneration(feedback.id, undefined, 'medium');
        }
      }

      console.log(`🔄 Processed ${highPriorityIds.length + recentFeedback.length} pending feedback items`);

    } catch (error) {
      console.error('Failed to process pending feedback:', error);
      throw error;
    }
  }

  /**
   * Setup job processors
   */
  private setupJobProcessors(): void {
    // Response generation processor
    this.queue.process('response-generation', this.config.concurrency, async (job: Job<ResponseJobData>) => {
      return await this.processGenerationJob(job);
    });

    // Batch generation processor
    this.queue.process('batch-generation', 1, async (job: Job<ResponseJobData>) => {
      return await this.processBatchJob(job);
    });

    // Response approval processor
    this.queue.process('response-approval', this.config.concurrency, async (job: Job<ResponseJobData>) => {
      return await this.processApprovalJob(job);
    });

    // Response sending processor
    this.queue.process('response-sending', this.config.concurrency, async (job: Job<ResponseJobData>) => {
      return await this.processSendingJob(job);
    });
  }

  /**
   * Process response generation job
   */
  private async processGenerationJob(job: Job<ResponseJobData>): Promise<any> {
    const { feedbackId, tone } = job.data;
    
    if (!feedbackId) {
      throw new Error('Feedback ID is required for generation job');
    }

    job.progress(10);

    try {
      // Generate response
      const result = await this.generationService.generateResponse(feedbackId, tone, {
        useCache: true,
        fallbackToTemplate: true,
        validateResponse: true
      });

      job.progress(70);

      // Check if auto-approval is possible
      const bestResponse = result.responses[0];
      if (bestResponse && bestResponse.confidence >= this.config.autoApproveThreshold) {
        // Auto-approve high-confidence responses
        await this.autoApproveResponse(feedbackId, bestResponse.content);
        job.progress(90);
      } else if (this.config.requireHumanReview) {
        // Queue for human review
        await this.queueForHumanReview(feedbackId);
        job.progress(80);
      }

      job.progress(100);

      return {
        feedbackId,
        responsesGenerated: result.responses.length,
        bestConfidence: bestResponse?.confidence || 0,
        autoApproved: bestResponse?.confidence >= this.config.autoApproveThreshold
      };

    } catch (error) {
      console.error(`Response generation failed for feedback ${feedbackId}:`, error);
      throw error;
    }
  }

  /**
   * Process batch generation job
   */
  private async processBatchJob(job: Job<ResponseJobData>): Promise<any> {
    const { batchId, tone, metadata } = job.data;
    const feedbackIds = metadata?.feedbackIds || [];

    if (!feedbackIds.length) {
      throw new Error('No feedback IDs provided for batch job');
    }

    let processed = 0;
    let successful = 0;
    let failed = 0;

    for (const feedbackId of feedbackIds) {
      try {
        await this.generationService.generateResponse(feedbackId, tone);
        successful++;
      } catch (error) {
        console.error(`Batch generation failed for feedback ${feedbackId}:`, error);
        failed++;
      }
      
      processed++;
      job.progress((processed / feedbackIds.length) * 100);
    }

    return {
      batchId,
      total: feedbackIds.length,
      processed,
      successful,
      failed
    };
  }

  /**
   * Process approval job
   */
  private async processApprovalJob(job: Job<ResponseJobData>): Promise<any> {
    const { responseId, metadata } = job.data;
    
    if (!responseId) {
      throw new Error('Response ID is required for approval job');
    }

    try {
      // Update response status
      await this.responseRepo.update(responseId, {
        status: 'approved',
        // Add approval metadata
      } as any);

      // If auto-send is enabled, queue for sending
      if (metadata?.autoSend) {
        await this.queueResponseSending(responseId, metadata as SendResponseRequest);
      }

      return { responseId, approved: true, autoSend: metadata?.autoSend };

    } catch (error) {
      console.error(`Response approval failed for response ${responseId}:`, error);
      throw error;
    }
  }

  /**
   * Process sending job
   */
  private async processSendingJob(job: Job<ResponseJobData>): Promise<any> {
    const { responseId, metadata } = job.data;
    
    if (!responseId) {
      throw new Error('Response ID is required for sending job');
    }

    try {
      // Get response data
      const response = await this.responseRepo.findById(responseId);
      if (!response) {
        throw new Error(`Response not found: ${responseId}`);
      }

      // Send response via appropriate channel
      const sendResult = await this.sendResponse(response, metadata as SendResponseRequest);

      // Update response status
      await this.responseRepo.update(responseId, {
        status: sendResult.success ? 'sent' : 'failed',
        sent_at: sendResult.success ? new Date() : undefined,
        sent_to: metadata?.recipientEmail
      } as any);

      return { responseId, sent: sendResult.success, channel: metadata?.channel };

    } catch (error) {
      console.error(`Response sending failed for response ${responseId}:`, error);
      throw error;
    }
  }

  /**
   * Auto-approve high-confidence response
   */
  private async autoApproveResponse(feedbackId: string, content: string): Promise<void> {
    try {
      const response = await this.responseRepo.findByFeedbackId(feedbackId);
      if (response) {
        await this.responseRepo.update(response.id, {
          status: 'approved',
          selected_draft: content
        } as any);
      }
    } catch (error) {
      console.error(`Auto-approval failed for feedback ${feedbackId}:`, error);
    }
  }

  /**
   * Queue response for human review
   */
  private async queueForHumanReview(feedbackId: string): Promise<void> {
    // This would integrate with your notification system
    console.log(`👤 Response for feedback ${feedbackId} queued for human review`);
    
    // Send notification to review team
    if (this.config.notificationSettings.email) {
      // Send email notification
    }
    
    if (this.config.notificationSettings.slack) {
      // Send Slack notification
    }
  }

  /**
   * Send response via appropriate channel
   */
  private async sendResponse(response: any, sendData: SendResponseRequest): Promise<{ success: boolean; error?: string }> {
    try {
      switch (sendData.channel) {
        case 'email':
          return await this.sendEmailResponse(response, sendData);
        case 'social_media':
          return await this.sendSocialMediaResponse(response, sendData);
        case 'support_ticket':
          return await this.sendSupportTicketResponse(response, sendData);
        default:
          throw new Error(`Unsupported channel: ${sendData.channel}`);
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send email response
   */
  private async sendEmailResponse(response: any, sendData: SendResponseRequest): Promise<{ success: boolean; error?: string }> {
    // Implementation would integrate with your email service
    console.log(`📧 Sending email response to ${sendData.recipientEmail}`);
    return { success: true };
  }

  /**
   * Send social media response
   */
  private async sendSocialMediaResponse(response: any, sendData: SendResponseRequest): Promise<{ success: boolean; error?: string }> {
    // Implementation would integrate with social media APIs
    console.log(`📱 Sending social media response`);
    return { success: true };
  }

  /**
   * Send support ticket response
   */
  private async sendSupportTicketResponse(response: any, sendData: SendResponseRequest): Promise<{ success: boolean; error?: string }> {
    // Implementation would integrate with your support ticket system
    console.log(`🎫 Sending support ticket response`);
    return { success: true };
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.queue.on('completed', (job, result) => {
      console.log(`✅ Job ${job.id} completed:`, result);
    });

    this.queue.on('failed', (job, err) => {
      console.error(`❌ Job ${job.id} failed:`, err.message);
    });

    this.queue.on('stalled', (job) => {
      console.warn(`⏸️ Job ${job.id} stalled`);
    });
  }

  /**
   * Get priority value for Bull queue
   */
  private getPriorityValue(priority: string): number {
    const priorities = {
      low: 1,
      medium: 5,
      high: 10,
      urgent: 20
    };
    return priorities[priority as keyof typeof priorities] || 5;
  }

  /**
   * Get pipeline metrics
   */
  async getMetrics(): Promise<PipelineMetrics> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaiting(),
      this.queue.getActive(),
      this.queue.getCompleted(),
      this.queue.getFailed()
    ]);

    return {
      totalJobs: waiting.length + active.length + completed.length + failed.length,
      completedJobs: completed.length,
      failedJobs: failed.length,
      averageProcessingTime: 0, // Would need to calculate from job data
      queueLength: waiting.length,
      activeJobs: active.length,
      throughput: 0 // Would need to calculate from historical data
    };
  }

  /**
   * Pause the pipeline
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    this.isProcessing = false;
    console.log('⏸️ Response pipeline paused');
  }

  /**
   * Resume the pipeline
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    this.isProcessing = true;
    console.log('▶️ Response pipeline resumed');
  }

  /**
   * Clean old jobs
   */
  async cleanJobs(grace: number = 24 * 60 * 60 * 1000): Promise<void> {
    await this.queue.clean(grace, 'completed');
    await this.queue.clean(grace, 'failed');
    console.log('🧹 Cleaned old jobs from response pipeline');
  }

  /**
   * Shutdown the pipeline
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down response pipeline...');
    await this.queue.close();
    this.isProcessing = false;
  }
}