import { OpenAIProvider, OpenAIConfig } from './providers/OpenAIProvider';
import { 
  ResponseGenerationRequest, 
  ResponseGenerationResult, 
  ResponseDraft, 
  ResponseTone, 
  ResponseConfig,
  ResponseTemplate,
  ResponseWorkflow
} from '@/types/response';
import { FeedbackData, AnalysisResult, Platform } from '@/types/feedback';
import { ResponseRepository } from '@/repositories/ResponseRepository';
import { FeedbackRepository } from '@/repositories/FeedbackRepository';
import { AnalysisRepository } from '@/repositories/AnalysisRepository';

export interface ResponseGenerationOptions {
  useCache?: boolean;
  cacheTTL?: number;
  fallbackToTemplate?: boolean;
  validateResponse?: boolean;
  maxRetries?: number;
}

export class ResponseGenerationService {
  private openaiProvider: OpenAIProvider;
  private config: ResponseConfig;
  private responseRepo: ResponseRepository;
  private feedbackRepo: FeedbackRepository;
  private analysisRepo: AnalysisRepository;
  private templates: Map<string, ResponseTemplate> = new Map();
  private workflows: Map<string, ResponseWorkflow> = new Map();

  constructor(
    openaiConfig: OpenAIConfig,
    responseConfig: ResponseConfig,
    responseRepo: ResponseRepository,
    feedbackRepo: FeedbackRepository,
    analysisRepo: AnalysisRepository
  ) {
    this.openaiProvider = new OpenAIProvider(openaiConfig);
    this.config = responseConfig;
    this.responseRepo = responseRepo;
    this.feedbackRepo = feedbackRepo;
    this.analysisRepo = analysisRepo;
    
    this.loadTemplates();
    this.loadWorkflows();
  }

  /**
   * Generate response for feedback
   */
  async generateResponse(
    feedbackId: string, 
    tone?: ResponseTone,
    options: ResponseGenerationOptions = {}
  ): Promise<ResponseGenerationResult> {
    try {
      // Get feedback and analysis data
      const feedback = await this.feedbackRepo.findById(feedbackId);
      if (!feedback) {
        throw new Error(`Feedback not found: ${feedbackId}`);
      }

      const analysis = await this.analysisRepo.findByFeedbackId(feedbackId);
      
      // Determine appropriate tone if not specified
      const selectedTone = tone || this.determineTone(feedback, analysis || undefined);
      
      // Build generation request
      const request: ResponseGenerationRequest = {
        feedback,
        analysis: analysis || undefined,
        tone: selectedTone,
        maxLength: this.getPlatformMaxLength(feedback.platform),
        variations: this.config.generateVariations ? this.config.variationCount : 1,
        companyContext: this.config.companyContext,
        brandGuidelines: this.config.brandGuidelines
      };

      // Check cache if enabled
      if (options.useCache) {
        const cached = await this.getCachedResponse(feedbackId, selectedTone);
        if (cached) {
          return cached;
        }
      }

      // Generate response using OpenAI
      let result = await this.openaiProvider.generateResponse(request);

      // Validate responses if enabled
      if (options.validateResponse) {
        result = await this.validateResponses(result, request);
      }

      // Store responses in database
      await this.storeResponses(feedbackId, result.responses, selectedTone);

      // Cache result if enabled
      if (options.useCache) {
        await this.cacheResponse(feedbackId, selectedTone, result, options.cacheTTL);
      }

      return result;

    } catch (error) {
      console.error(`Response generation failed for feedback ${feedbackId}:`, error);
      
      // Fallback to template if enabled
      if (options.fallbackToTemplate) {
        return await this.generateFromTemplate(feedbackId, tone);
      }
      
      throw error;
    }
  }

  /**
   * Generate responses for multiple feedback items
   */
  async generateBatchResponses(
    feedbackIds: string[],
    tone?: ResponseTone,
    options: ResponseGenerationOptions = {}
  ): Promise<Array<{ feedbackId: string; result: ResponseGenerationResult; error?: string }>> {
    const results: Array<{ feedbackId: string; result: ResponseGenerationResult; error?: string }> = [];
    
    for (const feedbackId of feedbackIds) {
      try {
        const result = await this.generateResponse(feedbackId, tone, options);
        results.push({ feedbackId, result });
      } catch (error) {
        results.push({ 
          feedbackId, 
          result: { responses: [], metadata: { model: '', processingTime: 0, tokensUsed: 0, cost: 0 } },
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return results;
  }

  /**
   * Generate response using template
   */
  async generateFromTemplate(
    feedbackId: string,
    tone?: ResponseTone
  ): Promise<ResponseGenerationResult> {
    const feedback = await this.feedbackRepo.findById(feedbackId);
    if (!feedback) {
      throw new Error(`Feedback not found: ${feedbackId}`);
    }

    const analysis = await this.analysisRepo.findByFeedbackId(feedbackId);
    const selectedTone = tone || this.determineTone(feedback, analysis || undefined);
    
    // Find appropriate template
    const template = this.findBestTemplate(feedback.platform, selectedTone);
    if (!template) {
      throw new Error(`No template found for platform ${feedback.platform} and tone ${selectedTone}`);
    }

    // Generate response from template
    const content = this.processTemplate(template, feedback, analysis || undefined);
    
    const response: ResponseDraft = {
      content,
      tone: selectedTone,
      confidence: 0.8, // Template-based responses have good confidence
      reasoning: [`Generated from template: ${template.name}`, `Applied ${selectedTone} tone`],
      metadata: {
        templateUsed: template.id,
        processingTime: 50 // Templates are fast
      }
    };

    // Store response
    await this.storeResponses(feedbackId, [response], selectedTone);

    return {
      responses: [response],
      metadata: {
        model: 'template',
        processingTime: 50,
        tokensUsed: 0,
        cost: 0
      }
    };
  }

  /**
   * Determine appropriate tone based on feedback and analysis
   */
  private determineTone(feedback: FeedbackData, analysis?: AnalysisResult): ResponseTone {
    // Check if there's a workflow that matches this feedback
    const workflow = this.findMatchingWorkflow(feedback, analysis);
    if (workflow) {
      return workflow.actions.tone;
    }

    // Use platform-specific default
    const platformSettings = this.config.platformSettings[feedback.platform];
    if (platformSettings) {
      return platformSettings.preferredTone;
    }

    // Determine based on sentiment and emotions
    if (analysis) {
      const sentiment = analysis.sentiment.label;
      const emotions = analysis.emotions.map(e => e.emotion);
      
      // Negative sentiment - use apologetic or empathetic
      if (sentiment === 'negative') {
        if (emotions.includes('anger') || emotions.includes('frustration')) {
          return 'apologetic';
        }
        return 'empathetic';
      }
      
      // Positive sentiment - use grateful
      if (sentiment === 'positive') {
        return 'grateful';
      }
    }

    // Default to professional
    return this.config.defaultTone;
  }

  /**
   * Find matching workflow for feedback
   */
  private findMatchingWorkflow(feedback: FeedbackData, analysis?: AnalysisResult): ResponseWorkflow | null {
    for (const workflow of this.workflows.values()) {
      if (!workflow.isActive) continue;
      
      // Check platform match
      if (workflow.triggers.platforms.length > 0 && 
          !workflow.triggers.platforms.includes(feedback.platform)) {
        continue;
      }
      
      // Check sentiment match
      if (analysis && workflow.triggers.sentiments.length > 0 && 
          !workflow.triggers.sentiments.includes(analysis.sentiment.label)) {
        continue;
      }
      
      // Check risk level match
      if (analysis && workflow.triggers.riskLevels.length > 0 && 
          !workflow.triggers.riskLevels.includes(analysis.risk_level)) {
        continue;
      }
      
      // Check emotion match
      if (analysis && workflow.triggers.emotions.length > 0) {
        const hasMatchingEmotion = analysis.emotions.some(emotion => 
          workflow.triggers.emotions.includes(emotion.emotion)
        );
        if (!hasMatchingEmotion) {
          continue;
        }
      }
      
      return workflow;
    }
    
    return null;
  }

  /**
   * Find best template for platform and tone
   */
  private findBestTemplate(platform: Platform, tone: ResponseTone): ResponseTemplate | null {
    // First try to find platform-specific template
    for (const template of this.templates.values()) {
      if (template.isActive && template.platform === platform && template.tone === tone) {
        return template;
      }
    }
    
    // Fallback to generic template for tone
    for (const template of this.templates.values()) {
      if (template.isActive && !template.platform && template.tone === tone) {
        return template;
      }
    }
    
    return null;
  }

  /**
   * Process template with feedback data
   */
  private processTemplate(
    template: ResponseTemplate, 
    feedback: FeedbackData, 
    analysis?: AnalysisResult
  ): string {
    let content = template.template;
    
    // Replace variables
    const variables: Record<string, string> = {
      '{customer_name}': feedback.author.username || 'Customer',
      '{platform}': feedback.platform,
      '{feedback_content}': feedback.content,
      '{sentiment}': analysis?.sentiment.label || 'neutral',
      '{emotions}': analysis?.emotions.map(e => e.emotion).join(', ') || 'none',
      '{company_name}': 'Our Company', // This should come from config
      '{support_email}': 'support@company.com', // This should come from config
      '{current_date}': new Date().toLocaleDateString()
    };
    
    for (const [variable, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(variable, 'g'), value);
    }
    
    return content;
  }

  /**
   * Get platform-specific max length
   */
  private getPlatformMaxLength(platform: Platform): number {
    const platformSettings = this.config.platformSettings[platform];
    return platformSettings?.maxLength || this.config.maxLength;
  }

  /**
   * Validate generated responses
   */
  private async validateResponses(
    result: ResponseGenerationResult, 
    request: ResponseGenerationRequest
  ): Promise<ResponseGenerationResult> {
    const validatedResponses: ResponseDraft[] = [];
    
    for (const response of result.responses) {
      let isValid = true;
      const issues: string[] = [];
      
      // Check length
      if (response.content.length > (request.maxLength || this.config.maxLength)) {
        isValid = false;
        issues.push('Response exceeds maximum length');
      }
      
      // Check for inappropriate content (basic checks)
      const inappropriateWords = ['damn', 'hell', 'stupid']; // This should be more comprehensive
      const hasInappropriate = inappropriateWords.some(word => 
        response.content.toLowerCase().includes(word)
      );
      
      if (hasInappropriate) {
        isValid = false;
        issues.push('Response contains inappropriate language');
      }
      
      // Check tone consistency (basic heuristic)
      if (request.tone === 'apologetic' && !response.content.toLowerCase().includes('sorry')) {
        issues.push('Apologetic tone not clearly expressed');
        response.confidence *= 0.8; // Reduce confidence
      }
      
      if (isValid || response.confidence > 0.7) {
        if (issues.length > 0) {
          response.reasoning.push(...issues.map(issue => `Validation warning: ${issue}`));
        }
        validatedResponses.push(response);
      }
    }
    
    // If no responses pass validation, keep the best one with warnings
    if (validatedResponses.length === 0 && result.responses.length > 0) {
      const bestResponse = result.responses.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );
      bestResponse.reasoning.push('Response failed validation but kept as best available option');
      validatedResponses.push(bestResponse);
    }
    
    return {
      ...result,
      responses: validatedResponses
    };
  }

  /**
   * Store responses in database
   */
  private async storeResponses(
    feedbackId: string, 
    responses: ResponseDraft[], 
    tone: ResponseTone
  ): Promise<void> {
    try {
      await this.responseRepo.create({
        feedback_id: feedbackId,
        drafts: responses,
        selected_draft: responses.length > 0 ? responses[0].content : undefined,
        status: 'draft'
      });
    } catch (error) {
      console.error('Failed to store responses:', error);
      // Don't throw - this is not critical for the generation process
    }
  }

  /**
   * Cache response result
   */
  private async cacheResponse(
    feedbackId: string, 
    tone: ResponseTone, 
    result: ResponseGenerationResult,
    ttl: number = 3600
  ): Promise<void> {
    // Implementation would depend on your caching strategy
    // For now, we'll skip caching implementation
  }

  /**
   * Get cached response
   */
  private async getCachedResponse(
    feedbackId: string, 
    tone: ResponseTone
  ): Promise<ResponseGenerationResult | null> {
    // Implementation would depend on your caching strategy
    // For now, we'll return null (no cache)
    return null;
  }

  /**
   * Load templates from database or configuration
   */
  private async loadTemplates(): Promise<void> {
    // For now, we'll create some default templates
    // In production, these would be loaded from database
    
    const defaultTemplates: ResponseTemplate[] = [
      {
        id: 'professional-generic',
        name: 'Professional Generic',
        tone: 'professional',
        template: 'Thank you for your feedback, {customer_name}. We appreciate you taking the time to share your experience with us. We will review your comments and follow up with you shortly.',
        variables: ['{customer_name}'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'apologetic-generic',
        name: 'Apologetic Generic',
        tone: 'apologetic',
        template: 'We sincerely apologize for the inconvenience you experienced, {customer_name}. This is not the level of service we strive to provide. We are investigating this issue and will work to resolve it promptly.',
        variables: ['{customer_name}'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'grateful-generic',
        name: 'Grateful Generic',
        tone: 'grateful',
        template: 'Thank you so much for your positive feedback, {customer_name}! We\'re delighted to hear about your great experience. Your support means a lot to our team.',
        variables: ['{customer_name}'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    for (const template of defaultTemplates) {
      this.templates.set(template.id, template);
    }
  }

  /**
   * Load workflows from database or configuration
   */
  private async loadWorkflows(): Promise<void> {
    // For now, we'll create some default workflows
    // In production, these would be loaded from database
    
    const defaultWorkflows: ResponseWorkflow[] = [
      {
        id: 'high-risk-escalation',
        name: 'High Risk Escalation',
        description: 'Handle high-risk viral content with apologetic tone',
        triggers: {
          platforms: [],
          sentiments: ['negative'],
          riskLevels: ['high', 'viral-threat'],
          emotions: ['anger', 'frustration']
        },
        actions: {
          generateResponse: true,
          tone: 'apologetic',
          requireApproval: true,
          autoSend: false,
          notifyTeam: true,
          escalate: true
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    for (const workflow of defaultWorkflows) {
      this.workflows.set(workflow.id, workflow);
    }
  }

  /**
   * Test OpenAI connection
   */
  async testConnection(): Promise<boolean> {
    return await this.openaiProvider.testConnection();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ResponseConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ResponseConfig {
    return { ...this.config };
  }
}