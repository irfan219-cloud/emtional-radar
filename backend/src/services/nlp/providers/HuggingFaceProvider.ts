import axios, { AxiosInstance } from 'axios';
import { 
  NLPModelProvider, 
  SentimentAnalysisResult, 
  EmotionAnalysisResult,
  HuggingFaceSentimentResponse,
  HuggingFaceEmotionResponse
} from '@/types/nlp';
import { SentimentLabel, EmotionType } from '@/types/feedback';

export interface HuggingFaceConfig {
  apiKey: string;
  sentimentModel: string;
  emotionModel: string;
  baseUrl?: string;
  timeout?: number;
}

export class HuggingFaceProvider implements NLPModelProvider {
  public readonly name = 'HuggingFace';
  private config: HuggingFaceConfig;
  private httpClient: AxiosInstance;

  constructor(config: HuggingFaceConfig) {
    this.config = {
      baseUrl: 'https://api-inference.huggingface.co',
      timeout: 30000,
      ...config
    };

    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Analyze sentiment using Hugging Face model
   */
  async analyzeSentiment(text: string): Promise<SentimentAnalysisResult> {
    const startTime = Date.now();

    try {
      const response = await this.httpClient.post(
        `/models/${this.config.sentimentModel}`,
        { inputs: text }
      );

      const results: HuggingFaceSentimentResponse = response.data;
      const processingTime = Date.now() - startTime;

      // Transform Hugging Face response to our format
      const scores = this.transformSentimentScores(results);
      const sentiment = this.determineSentiment(scores);

      return {
        sentiment: {
          label: sentiment,
          confidence: scores[sentiment]
        },
        confidence: scores[sentiment],
        scores,
        processingTime,
        modelUsed: this.config.sentimentModel
      };
    } catch (error) {
      console.error('HuggingFace sentiment analysis failed:', error);
      throw new Error(`Sentiment analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze emotions using Hugging Face model
   */
  async analyzeEmotions(text: string): Promise<EmotionAnalysisResult> {
    const startTime = Date.now();

    try {
      const response = await this.httpClient.post(
        `/models/${this.config.emotionModel}`,
        { inputs: text }
      );

      const results: HuggingFaceEmotionResponse = response.data;
      const processingTime = Date.now() - startTime;

      // Transform Hugging Face response to our format
      const { emotions, scores, primaryEmotion, confidence } = this.transformEmotionResults(results);

      return {
        emotions,
        primaryEmotion,
        confidence,
        scores,
        processingTime,
        modelUsed: this.config.emotionModel
      };
    } catch (error) {
      console.error('HuggingFace emotion analysis failed:', error);
      throw new Error(`Emotion analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if the provider is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Test with a simple sentiment analysis
      await this.httpClient.post(
        `/models/${this.config.sentimentModel}`,
        { inputs: 'test' }
      );
      return true;
    } catch (error) {
      console.warn('HuggingFace provider not available:', error);
      return false;
    }
  }

  /**
   * Get model information
   */
  getModelInfo() {
    return {
      sentimentModel: this.config.sentimentModel,
      emotionModel: this.config.emotionModel,
      version: '1.0.0',
      capabilities: ['sentiment_analysis', 'emotion_detection', 'batch_processing']
    };
  }

  /**
   * Transform Hugging Face sentiment scores to our format
   */
  private transformSentimentScores(results: HuggingFaceSentimentResponse): Record<SentimentLabel, number> {
    const scores: Record<SentimentLabel, number> = {
      positive: 0,
      neutral: 0,
      negative: 0
    };

    results.forEach(result => {
      const label = this.mapSentimentLabel(result.label);
      if (label) {
        scores[label] = result.score;
      }
    });

    // Ensure all scores sum to 1 and handle missing labels
    const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
    if (total === 0) {
      // If no valid scores, assume neutral
      scores.neutral = 1;
    } else if (total !== 1) {
      // Normalize scores
      Object.keys(scores).forEach(key => {
        scores[key as SentimentLabel] /= total;
      });
    }

    return scores;
  }

  /**
   * Transform Hugging Face emotion results to our format
   */
  private transformEmotionResults(results: HuggingFaceEmotionResponse): {
    emotions: Array<{ emotion: EmotionType; confidence: number }>;
    scores: Record<EmotionType, number>;
    primaryEmotion: EmotionType;
    confidence: number;
  } {
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

    // Map Hugging Face emotion labels to our emotion types
    results.forEach(result => {
      const emotion = this.mapEmotionLabel(result.label);
      if (emotion) {
        scores[emotion] = result.score;
      }
    });

    // Create emotions array sorted by confidence
    const emotions = Object.entries(scores)
      .filter(([_, confidence]) => confidence > 0.1) // Only include emotions with >10% confidence
      .map(([emotion, confidence]) => ({
        emotion: emotion as EmotionType,
        confidence
      }))
      .sort((a, b) => b.confidence - a.confidence);

    // Determine primary emotion
    const primaryEmotion = emotions.length > 0 ? emotions[0].emotion : 'confusion';
    const confidence = emotions.length > 0 ? emotions[0].confidence : 0;

    return {
      emotions,
      scores,
      primaryEmotion,
      confidence
    };
  }

  /**
   * Map Hugging Face sentiment labels to our format
   */
  private mapSentimentLabel(label: string): SentimentLabel | null {
    const normalizedLabel = label.toLowerCase();
    
    if (normalizedLabel.includes('positive') || normalizedLabel === 'pos') {
      return 'positive';
    } else if (normalizedLabel.includes('negative') || normalizedLabel === 'neg') {
      return 'negative';
    } else if (normalizedLabel.includes('neutral') || normalizedLabel === 'neu') {
      return 'neutral';
    }

    return null;
  }

  /**
   * Map Hugging Face emotion labels to our emotion types
   */
  private mapEmotionLabel(label: string): EmotionType | null {
    const normalizedLabel = label.toLowerCase();
    
    // Direct mappings
    const emotionMappings: Record<string, EmotionType> = {
      'anger': 'anger',
      'angry': 'anger',
      'rage': 'anger',
      'fury': 'anger',
      
      'joy': 'joy',
      'happiness': 'joy',
      'happy': 'joy',
      'delight': 'joy',
      
      'sadness': 'disappointment',
      'sad': 'disappointment',
      'sorrow': 'disappointment',
      
      'fear': 'confusion',
      'afraid': 'confusion',
      'scared': 'confusion',
      
      'surprise': 'confusion',
      'surprised': 'confusion',
      
      'disgust': 'frustration',
      'disgusted': 'frustration',
      
      'trust': 'trust',
      'confidence': 'trust',
      
      'anticipation': 'satisfaction',
      'excitement': 'satisfaction',
      
      'frustration': 'frustration',
      'frustrated': 'frustration',
      
      'gratitude': 'gratitude',
      'grateful': 'gratitude',
      'thankful': 'gratitude',
      
      'appreciation': 'appreciation',
      'appreciative': 'appreciation',
      
      'betrayal': 'betrayal',
      'betrayed': 'betrayal',
      
      'sarcasm': 'sarcasm',
      'sarcastic': 'sarcasm',
      
      'confusion': 'confusion',
      'confused': 'confusion',
      
      'satisfaction': 'satisfaction',
      'satisfied': 'satisfaction'
    };

    return emotionMappings[normalizedLabel] || null;
  }

  /**
   * Determine primary sentiment from scores
   */
  private determineSentiment(scores: Record<SentimentLabel, number>): SentimentLabel {
    let maxScore = 0;
    let primarySentiment: SentimentLabel = 'neutral';

    Object.entries(scores).forEach(([sentiment, score]) => {
      if (score > maxScore) {
        maxScore = score;
        primarySentiment = sentiment as SentimentLabel;
      }
    });

    return primarySentiment;
  }

  /**
   * Batch analyze multiple texts (if supported by the model)
   */
  async batchAnalyzeSentiment(texts: string[]): Promise<SentimentAnalysisResult[]> {
    const results: SentimentAnalysisResult[] = [];
    
    // Process in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => this.analyzeSentiment(text));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error(`Batch sentiment analysis failed for batch starting at index ${i}:`, error);
        // Add error results for failed batch
        batch.forEach(() => {
          results.push({
            sentiment: { label: 'neutral', confidence: 0 },
            confidence: 0,
            scores: { positive: 0, neutral: 1, negative: 0 },
            processingTime: 0,
            modelUsed: this.config.sentimentModel
          });
        });
      }
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  /**
   * Batch analyze emotions for multiple texts
   */
  async batchAnalyzeEmotions(texts: string[]): Promise<EmotionAnalysisResult[]> {
    const results: EmotionAnalysisResult[] = [];
    
    // Process in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => this.analyzeEmotions(text));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error(`Batch emotion analysis failed for batch starting at index ${i}:`, error);
        // Add error results for failed batch
        batch.forEach(() => {
          results.push({
            emotions: [],
            primaryEmotion: 'confusion',
            confidence: 0,
            scores: {
              anger: 0, sarcasm: 0, frustration: 0, betrayal: 0, confusion: 1,
              joy: 0, satisfaction: 0, gratitude: 0, appreciation: 0, trust: 0, disappointment: 0
            },
            processingTime: 0,
            modelUsed: this.config.emotionModel
          });
        });
      }
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
}