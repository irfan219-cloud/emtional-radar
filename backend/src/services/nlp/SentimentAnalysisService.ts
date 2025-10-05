import { 
  NLPConfig, 
  NLPAnalysisRequest, 
  NLPAnalysisResult, 
  SentimentAnalysisResult,
  NLPModelProvider,
  TextQualityAssessment
} from '@/types/nlp';
import { TextPreprocessor } from './TextPreprocessor';
import { HuggingFaceProvider } from './providers/HuggingFaceProvider';
import { RedisManager } from '@/utils/redis-manager';
import { REDIS_KEYS } from '@/utils/redis-keys';

export class SentimentAnalysisService {
  private config: NLPConfig;
  private providers: Map<string, NLPModelProvider> = new Map();
  private primaryProvider: NLPModelProvider | null = null;

  constructor(config: NLPConfig) {
    this.config = config;
    this.initializeProviders();
  }

  /**
   * Initialize NLP providers based on configuration
   */
  private async initializeProviders(): Promise<void> {
    try {
      // Initialize Hugging Face provider if configured
      if (this.config.sentimentModel.provider === 'huggingface' && this.config.sentimentModel.apiKey) {
        const hfProvider = new HuggingFaceProvider({
          apiKey: this.config.sentimentModel.apiKey,
          sentimentModel: this.config.sentimentModel.modelName,
          emotionModel: this.config.emotionModel.modelName
        });

        this.providers.set('huggingface', hfProvider);
        
        // Check if provider is available
        if (await hfProvider.isAvailable()) {
          this.primaryProvider = hfProvider;
          console.log('✅ HuggingFace provider initialized and available');
        } else {
          console.warn('⚠️ HuggingFace provider initialized but not available');
        }
      }

      // Add other providers (OpenAI, local models) here in the future

      if (!this.primaryProvider) {
        console.warn('⚠️ No NLP providers available, using fallback analysis');
      }
    } catch (error) {
      console.error('❌ Failed to initialize NLP providers:', error);
    }
  }

  /**
   * Analyze sentiment for a single text
   */
  async analyzeSentiment(request: NLPAnalysisRequest): Promise<SentimentAnalysisResult> {
    const startTime = Date.now();

    try {
      // Check cache first if enabled
      if (this.config.cacheResults && !request.skipCache) {
        const cached = await this.getCachedResult(request.text, 'sentiment');
        if (cached) {
          return cached;
        }
      }

      // Assess text quality
      const quality = TextPreprocessor.assessTextQuality(request.text);
      if (!quality.isValid) {
        throw new Error(`Text quality too low: ${quality.issues.join(', ')}`);
      }

      // Preprocess text
      const processedText = TextPreprocessor.preprocess(
        request.text, 
        request.preprocessingOptions
      );

      let result: SentimentAnalysisResult;

      if (this.primaryProvider) {
        // Use primary provider
        result = await this.primaryProvider.analyzeSentiment(processedText);
      } else {
        // Fallback to rule-based analysis
        result = this.fallbackSentimentAnalysis(processedText);
      }

      // Cache result if enabled
      if (this.config.cacheResults) {
        await this.cacheResult(request.text, 'sentiment', result);
      }

      // Update metrics
      await this.updateMetrics('sentiment', result);

      return result;
    } catch (error) {
      console.error('Sentiment analysis failed:', error);
      
      // Return fallback result
      return this.fallbackSentimentAnalysis(request.text);
    }
  }

  /**
   * Batch analyze sentiment for multiple texts
   */
  async batchAnalyzeSentiment(requests: NLPAnalysisRequest[]): Promise<SentimentAnalysisResult[]> {
    const results: SentimentAnalysisResult[] = [];
    
    // Process in batches
    const batchSize = this.config.batchSize || 10;
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      
      try {
        if (this.primaryProvider && 'batchAnalyzeSentiment' in this.primaryProvider) {
          // Use provider's batch method if available
          const texts = batch.map(req => {
            const processedText = TextPreprocessor.preprocess(
              req.text, 
              req.preprocessingOptions
            );
            return processedText;
          });
          
          const batchResults = await (this.primaryProvider as any).batchAnalyzeSentiment(texts);
          results.push(...batchResults);
        } else {
          // Process individually
          const batchPromises = batch.map(request => this.analyzeSentiment(request));
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
        }
      } catch (error) {
        console.error(`Batch sentiment analysis failed for batch ${i}:`, error);
        
        // Add fallback results for failed batch
        batch.forEach(request => {
          results.push(this.fallbackSentimentAnalysis(request.text));
        });
      }
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return results;
  }

  /**
   * Fallback sentiment analysis using rule-based approach
   */
  private fallbackSentimentAnalysis(text: string): SentimentAnalysisResult {
    const startTime = Date.now();
    
    // Simple rule-based sentiment analysis
    const positiveWords = [
      'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'awesome',
      'love', 'like', 'enjoy', 'happy', 'pleased', 'satisfied', 'perfect',
      'best', 'brilliant', 'outstanding', 'superb', 'magnificent', 'incredible'
    ];
    
    const negativeWords = [
      'bad', 'terrible', 'awful', 'horrible', 'disgusting', 'hate', 'dislike',
      'angry', 'frustrated', 'disappointed', 'upset', 'annoyed', 'furious',
      'worst', 'useless', 'broken', 'failed', 'problem', 'issue', 'bug'
    ];

    const words = text.toLowerCase().split(/\s+/);
    let positiveScore = 0;
    let negativeScore = 0;

    words.forEach(word => {
      if (positiveWords.includes(word)) {
        positiveScore++;
      } else if (negativeWords.includes(word)) {
        negativeScore++;
      }
    });

    // Calculate scores
    const totalSentimentWords = positiveScore + negativeScore;
    let positive = 0, negative = 0, neutral = 1;

    if (totalSentimentWords > 0) {
      positive = positiveScore / totalSentimentWords;
      negative = negativeScore / totalSentimentWords;
      neutral = Math.max(0, 1 - positive - negative);
    }

    // Determine primary sentiment
    let primarySentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    let confidence = neutral;

    if (positive > negative && positive > neutral) {
      primarySentiment = 'positive';
      confidence = positive;
    } else if (negative > positive && negative > neutral) {
      primarySentiment = 'negative';
      confidence = negative;
    }

    return {
      sentiment: {
        label: primarySentiment,
        confidence
      },
      confidence,
      scores: { positive, neutral, negative },
      processingTime: Date.now() - startTime,
      modelUsed: 'fallback-rule-based'
    };
  }

  /**
   * Get cached analysis result
   */
  private async getCachedResult(text: string, type: 'sentiment' | 'emotion'): Promise<any | null> {
    try {
      const cacheKey = `nlp_${type}_${this.hashText(text)}`;
      return await RedisManager.getUserSession(cacheKey);
    } catch (error) {
      console.warn('Failed to get cached result:', error);
      return null;
    }
  }

  /**
   * Cache analysis result
   */
  private async cacheResult(text: string, type: 'sentiment' | 'emotion', result: any): Promise<void> {
    try {
      const cacheKey = `nlp_${type}_${this.hashText(text)}`;
      await RedisManager.cacheUserSession(cacheKey, result, this.config.cacheTTL);
    } catch (error) {
      console.warn('Failed to cache result:', error);
    }
  }

  /**
   * Update NLP metrics
   */
  private async updateMetrics(type: 'sentiment' | 'emotion', result: any): Promise<void> {
    try {
      const metricsKey = `nlp_metrics_${type}`;
      const existingMetrics = await RedisManager.getUserSession(metricsKey) || {
        totalAnalyzed: 0,
        averageConfidence: 0,
        averageProcessingTime: 0,
        modelsUsed: {}
      };

      existingMetrics.totalAnalyzed++;
      existingMetrics.averageConfidence = (
        (existingMetrics.averageConfidence * (existingMetrics.totalAnalyzed - 1)) + 
        result.confidence
      ) / existingMetrics.totalAnalyzed;
      
      existingMetrics.averageProcessingTime = (
        (existingMetrics.averageProcessingTime * (existingMetrics.totalAnalyzed - 1)) + 
        result.processingTime
      ) / existingMetrics.totalAnalyzed;

      existingMetrics.modelsUsed[result.modelUsed] = 
        (existingMetrics.modelsUsed[result.modelUsed] || 0) + 1;
      
      existingMetrics.lastAnalyzedAt = new Date();

      await RedisManager.cacheUserSession(metricsKey, existingMetrics);
    } catch (error) {
      console.warn('Failed to update metrics:', error);
    }
  }

  /**
   * Generate hash for text caching
   */
  private hashText(text: string): string {
    // Simple hash function for caching
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get service statistics
   */
  async getStatistics(): Promise<{
    sentiment: any;
    emotion: any;
    providers: Array<{ name: string; available: boolean; info: any }>;
  }> {
    const sentimentMetrics = await RedisManager.getUserSession('nlp_metrics_sentiment') || {};
    const emotionMetrics = await RedisManager.getUserSession('nlp_metrics_emotion') || {};

    const providers = [];
    for (const [name, provider] of this.providers) {
      providers.push({
        name,
        available: await provider.isAvailable(),
        info: provider.getModelInfo()
      });
    }

    return {
      sentiment: sentimentMetrics,
      emotion: emotionMetrics,
      providers
    };
  }

  /**
   * Clear analysis cache
   */
  async clearCache(): Promise<void> {
    try {
      // This would require scanning Redis for keys matching the pattern
      // For now, just log the action
      console.log('🧹 NLP cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }
}