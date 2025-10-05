import { 
  NLPConfig, 
  NLPAnalysisRequest, 
  EmotionAnalysisResult,
  NLPModelProvider
} from '@/types/nlp';
import { EmotionType } from '@/types/feedback';
import { TextPreprocessor } from './TextPreprocessor';
import { RedisManager } from '@/utils/redis-manager';

export class EmotionAnalysisService {
  private config: NLPConfig;
  private providers: Map<string, NLPModelProvider> = new Map();
  private primaryProvider: NLPModelProvider | null = null;

  constructor(config: NLPConfig, providers: Map<string, NLPModelProvider>) {
    this.config = config;
    this.providers = providers;
    this.initializePrimaryProvider();
  }

  /**
   * Initialize primary provider for emotion analysis
   */
  private initializePrimaryProvider(): void {
    // Use the same provider as sentiment analysis for consistency
    if (this.config.emotionModel.provider === 'huggingface') {
      this.primaryProvider = this.providers.get('huggingface') || null;
    }
    // Add other provider logic here
  }

  /**
   * Analyze emotions for a single text
   */
  async analyzeEmotions(request: NLPAnalysisRequest): Promise<EmotionAnalysisResult> {
    const startTime = Date.now();

    try {
      // Check cache first if enabled
      if (this.config.cacheResults && !request.skipCache) {
        const cached = await this.getCachedResult(request.text, 'emotion');
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

      let result: EmotionAnalysisResult;

      if (this.primaryProvider) {
        // Use primary provider
        result = await this.primaryProvider.analyzeEmotions(processedText);
      } else {
        // Fallback to rule-based analysis
        result = this.fallbackEmotionAnalysis(processedText);
      }

      // Cache result if enabled
      if (this.config.cacheResults) {
        await this.cacheResult(request.text, 'emotion', result);
      }

      // Update metrics
      await this.updateMetrics('emotion', result);

      return result;
    } catch (error) {
      console.error('Emotion analysis failed:', error);
      
      // Return fallback result
      return this.fallbackEmotionAnalysis(request.text);
    }
  }

  /**
   * Batch analyze emotions for multiple texts
   */
  async batchAnalyzeEmotions(requests: NLPAnalysisRequest[]): Promise<EmotionAnalysisResult[]> {
    const results: EmotionAnalysisResult[] = [];
    
    // Process in batches
    const batchSize = this.config.batchSize || 10;
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      
      try {
        if (this.primaryProvider && 'batchAnalyzeEmotions' in this.primaryProvider) {
          // Use provider's batch method if available
          const texts = batch.map(req => {
            const processedText = TextPreprocessor.preprocess(
              req.text, 
              req.preprocessingOptions
            );
            return processedText;
          });
          
          const batchResults = await (this.primaryProvider as any).batchAnalyzeEmotions(texts);
          results.push(...batchResults);
        } else {
          // Process individually
          const batchPromises = batch.map(request => this.analyzeEmotions(request));
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
        }
      } catch (error) {
        console.error(`Batch emotion analysis failed for batch ${i}:`, error);
        
        // Add fallback results for failed batch
        batch.forEach(request => {
          results.push(this.fallbackEmotionAnalysis(request.text));
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
   * Fallback emotion analysis using rule-based approach
   */
  private fallbackEmotionAnalysis(text: string): EmotionAnalysisResult {
    const startTime = Date.now();
    
    // Define emotion keywords and patterns
    const emotionPatterns = {
      anger: {
        keywords: ['angry', 'mad', 'furious', 'rage', 'hate', 'pissed', 'outraged', 'livid'],
        patterns: [/damn/gi, /wtf/gi, /bullsh\w*/gi, /stupid/gi, /ridiculous/gi],
        intensifiers: ['very', 'extremely', 'really', 'so', 'absolutely']
      },
      frustration: {
        keywords: ['frustrated', 'annoying', 'irritating', 'bothered', 'fed up', 'sick of'],
        patterns: [/can't believe/gi, /this is ridiculous/gi, /what the hell/gi],
        intensifiers: ['very', 'extremely', 'really', 'so']
      },
      joy: {
        keywords: ['happy', 'joy', 'excited', 'thrilled', 'delighted', 'cheerful', 'elated'],
        patterns: [/love it/gi, /amazing/gi, /fantastic/gi, /wonderful/gi],
        intensifiers: ['very', 'extremely', 'really', 'so', 'absolutely']
      },
      satisfaction: {
        keywords: ['satisfied', 'pleased', 'content', 'good', 'fine', 'okay', 'decent'],
        patterns: [/works well/gi, /does the job/gi, /as expected/gi],
        intensifiers: ['quite', 'fairly', 'reasonably']
      },
      disappointment: {
        keywords: ['disappointed', 'let down', 'expected more', 'underwhelmed', 'sad'],
        patterns: [/not what i expected/gi, /could be better/gi, /hoped for more/gi],
        intensifiers: ['very', 'really', 'quite']
      },
      confusion: {
        keywords: ['confused', 'don\'t understand', 'unclear', 'puzzled', 'lost'],
        patterns: [/how do i/gi, /what does this mean/gi, /i don't get it/gi],
        intensifiers: ['really', 'completely', 'totally']
      },
      gratitude: {
        keywords: ['thank', 'grateful', 'appreciate', 'thanks', 'thankful'],
        patterns: [/thank you/gi, /thanks so much/gi, /really appreciate/gi],
        intensifiers: ['really', 'so', 'very', 'truly']
      },
      appreciation: {
        keywords: ['appreciate', 'value', 'recognize', 'acknowledge', 'respect'],
        patterns: [/well done/gi, /good job/gi, /keep it up/gi],
        intensifiers: ['really', 'truly', 'deeply']
      },
      trust: {
        keywords: ['trust', 'reliable', 'dependable', 'confident', 'faith'],
        patterns: [/can count on/gi, /always works/gi, /never fails/gi],
        intensifiers: ['completely', 'fully', 'absolutely']
      },
      betrayal: {
        keywords: ['betrayed', 'lied', 'deceived', 'cheated', 'misled'],
        patterns: [/not as advertised/gi, /false promises/gi, /scammed/gi],
        intensifiers: ['completely', 'totally', 'absolutely']
      },
      sarcasm: {
        keywords: ['yeah right', 'sure', 'obviously', 'clearly'],
        patterns: [/oh great/gi, /just perfect/gi, /wonderful \(not\)/gi, /thanks for nothing/gi],
        intensifiers: ['oh', 'just', 'really']
      }
    };

    const text_lower = text.toLowerCase();
    const words = text_lower.split(/\s+/);
    const scores: Record<EmotionType, number> = {
      anger: 0,
      sarcasm: 0,
      frustration: 0,
      betrayal: 0,
      confusion: 0,
      joy: 0,
      satisfaction: 0,
      gratitude: 0,
      appreciation: 0,
      trust: 0,
      disappointment: 0
    };

    // Analyze each emotion
    Object.entries(emotionPatterns).forEach(([emotion, patterns]) => {
      let emotionScore = 0;
      
      // Check keywords
      patterns.keywords.forEach(keyword => {
        const keywordCount = (text_lower.match(new RegExp(keyword, 'g')) || []).length;
        emotionScore += keywordCount * 0.3;
      });

      // Check patterns
      patterns.patterns.forEach(pattern => {
        const patternMatches = (text.match(pattern) || []).length;
        emotionScore += patternMatches * 0.5;
      });

      // Check for intensifiers near emotion words
      patterns.intensifiers.forEach(intensifier => {
        if (text_lower.includes(intensifier)) {
          patterns.keywords.forEach(keyword => {
            if (text_lower.includes(`${intensifier} ${keyword}`) || 
                text_lower.includes(`${keyword} ${intensifier}`)) {
              emotionScore += 0.2;
            }
          });
        }
      });

      scores[emotion as EmotionType] = Math.min(emotionScore, 1.0);
    });

    // Handle special cases and adjustments
    this.adjustEmotionScores(scores, text_lower);

    // Create emotions array sorted by confidence
    const emotions = Object.entries(scores)
      .filter(([_, confidence]) => confidence > 0.1)
      .map(([emotion, confidence]) => ({
        emotion: emotion as EmotionType,
        confidence
      }))
      .sort((a, b) => b.confidence - a.confidence);

    // Determine primary emotion
    const primaryEmotion = emotions.length > 0 ? emotions[0].emotion : 'confusion';
    const confidence = emotions.length > 0 ? emotions[0].confidence : 0.1;

    return {
      emotions,
      primaryEmotion,
      confidence,
      scores,
      processingTime: Date.now() - startTime,
      modelUsed: 'fallback-rule-based'
    };
  }

  /**
   * Adjust emotion scores based on context and relationships
   */
  private adjustEmotionScores(scores: Record<EmotionType, number>, text: string): void {
    // Sarcasm detection adjustments
    if (this.detectSarcasm(text)) {
      scores.sarcasm = Math.max(scores.sarcasm, 0.6);
      // Reduce positive emotions if sarcasm is detected
      scores.joy *= 0.3;
      scores.satisfaction *= 0.3;
      scores.gratitude *= 0.3;
    }

    // Negation handling
    if (this.hasNegation(text)) {
      // Flip positive emotions to negative ones
      if (scores.joy > 0.3) {
        scores.disappointment = Math.max(scores.disappointment, scores.joy * 0.7);
        scores.joy *= 0.3;
      }
      if (scores.satisfaction > 0.3) {
        scores.frustration = Math.max(scores.frustration, scores.satisfaction * 0.7);
        scores.satisfaction *= 0.3;
      }
    }

    // Emotional intensity based on punctuation
    const exclamationCount = (text.match(/!/g) || []).length;
    const capsRatio = this.calculateCapsRatio(text);
    
    if (exclamationCount > 2 || capsRatio > 0.3) {
      // Intensify negative emotions
      scores.anger *= 1.5;
      scores.frustration *= 1.3;
      scores.betrayal *= 1.2;
      
      // Also intensify positive emotions if they exist
      scores.joy *= 1.2;
      scores.gratitude *= 1.2;
    }

    // Normalize scores to ensure they don't exceed 1.0
    Object.keys(scores).forEach(emotion => {
      scores[emotion as EmotionType] = Math.min(scores[emotion as EmotionType], 1.0);
    });
  }

  /**
   * Detect sarcasm in text
   */
  private detectSarcasm(text: string): boolean {
    const sarcasticPatterns = [
      /oh great/gi,
      /just perfect/gi,
      /wonderful \(not\)/gi,
      /thanks for nothing/gi,
      /yeah right/gi,
      /sure thing/gi,
      /obviously/gi,
      /clearly/gi
    ];

    // Check for sarcastic patterns
    const hasPattern = sarcasticPatterns.some(pattern => pattern.test(text));
    
    // Check for positive words with negative context
    const positiveWords = ['great', 'perfect', 'wonderful', 'amazing', 'fantastic'];
    const negativeContext = ['not', 'never', 'hardly', 'barely', 'definitely not'];
    
    let hasPositiveWithNegative = false;
    positiveWords.forEach(positive => {
      negativeContext.forEach(negative => {
        if (text.toLowerCase().includes(`${negative} ${positive}`) ||
            text.toLowerCase().includes(`${positive} ${negative}`)) {
          hasPositiveWithNegative = true;
        }
      });
    });

    return hasPattern || hasPositiveWithNegative;
  }

  /**
   * Check for negation in text
   */
  private hasNegation(text: string): boolean {
    const negationWords = ['not', 'no', 'never', 'nothing', 'nobody', 'nowhere', 'neither', 'nor'];
    const textLower = text.toLowerCase();
    
    return negationWords.some(negation => textLower.includes(negation));
  }

  /**
   * Calculate ratio of capital letters
   */
  private calculateCapsRatio(text: string): number {
    const totalLetters = (text.match(/[a-zA-Z]/g) || []).length;
    const capsLetters = (text.match(/[A-Z]/g) || []).length;
    
    return totalLetters > 0 ? capsLetters / totalLetters : 0;
  }

  /**
   * Get cached analysis result
   */
  private async getCachedResult(text: string, type: 'emotion'): Promise<EmotionAnalysisResult | null> {
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
  private async cacheResult(text: string, type: 'emotion', result: EmotionAnalysisResult): Promise<void> {
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
  private async updateMetrics(type: 'emotion', result: EmotionAnalysisResult): Promise<void> {
    try {
      const metricsKey = `nlp_metrics_${type}`;
      const existingMetrics = await RedisManager.getUserSession(metricsKey) || {
        totalAnalyzed: 0,
        emotionDistribution: {},
        averageConfidence: 0,
        averageProcessingTime: 0,
        modelsUsed: {}
      };

      existingMetrics.totalAnalyzed++;
      
      // Update emotion distribution
      if (!existingMetrics.emotionDistribution[result.primaryEmotion]) {
        existingMetrics.emotionDistribution[result.primaryEmotion] = 0;
      }
      existingMetrics.emotionDistribution[result.primaryEmotion]++;

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
   * Analyze emotional progression in text
   */
  analyzeEmotionalProgression(text: string): Array<{ 
    segment: string; 
    emotions: Array<{ emotion: EmotionType; confidence: number }> 
  }> {
    // Split text into sentences for progression analysis
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    return sentences.map(sentence => {
      const result = this.fallbackEmotionAnalysis(sentence.trim());
      return {
        segment: sentence.trim(),
        emotions: result.emotions
      };
    });
  }

  /**
   * Get dominant emotion themes from multiple emotions
   */
  getEmotionThemes(emotions: Array<{ emotion: EmotionType; confidence: number }>): {
    theme: 'positive' | 'negative' | 'neutral' | 'mixed';
    intensity: 'low' | 'medium' | 'high';
    dominantEmotions: EmotionType[];
  } {
    const positiveEmotions: EmotionType[] = ['joy', 'satisfaction', 'gratitude', 'appreciation', 'trust'];
    const negativeEmotions: EmotionType[] = ['anger', 'frustration', 'betrayal', 'disappointment', 'sarcasm'];
    const neutralEmotions: EmotionType[] = ['confusion'];

    let positiveScore = 0;
    let negativeScore = 0;
    let neutralScore = 0;
    let totalConfidence = 0;

    emotions.forEach(({ emotion, confidence }) => {
      totalConfidence += confidence;
      
      if (positiveEmotions.includes(emotion)) {
        positiveScore += confidence;
      } else if (negativeEmotions.includes(emotion)) {
        negativeScore += confidence;
      } else {
        neutralScore += confidence;
      }
    });

    // Determine theme
    let theme: 'positive' | 'negative' | 'neutral' | 'mixed';
    if (positiveScore > negativeScore && positiveScore > neutralScore) {
      theme = 'positive';
    } else if (negativeScore > positiveScore && negativeScore > neutralScore) {
      theme = 'negative';
    } else if (neutralScore > positiveScore && neutralScore > negativeScore) {
      theme = 'neutral';
    } else {
      theme = 'mixed';
    }

    // Determine intensity
    const avgConfidence = totalConfidence / emotions.length;
    let intensity: 'low' | 'medium' | 'high';
    if (avgConfidence < 0.3) {
      intensity = 'low';
    } else if (avgConfidence < 0.7) {
      intensity = 'medium';
    } else {
      intensity = 'high';
    }

    // Get dominant emotions (top 3)
    const dominantEmotions = emotions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .map(e => e.emotion);

    return {
      theme,
      intensity,
      dominantEmotions
    };
  }
}