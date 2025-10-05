import { FeedbackData, AnalysisResult, ViralityFactors, RiskLevel, Sentiment, Emotion } from '@/types/feedback';
import { EmotionAnalysisResult, SentimentAnalysisResult } from '@/types/nlp';

export interface ViralityFeatures {
  toneSeverity: number;
  engagementVelocity: number;
  userInfluence: number;
  contentLength: number;
  platformMultiplier: number;
  timeDecay: number;
}

export interface ViralityPrediction {
  score: number;
  riskLevel: RiskLevel;
  factors: ViralityFactors;
  features: ViralityFeatures;
  confidence: number;
  reasoning: string[];
}

export interface ViralityConfig {
  weights: {
    toneSeverity: number;
    engagementVelocity: number;
    userInfluence: number;
    contentLength: number;
    platformMultiplier: number;
    timeDecay: number;
  };
  thresholds: {
    low: number;
    medium: number;
    high: number;
    viralThreat: number;
  };
  platformMultipliers: {
    twitter: number;
    reddit: number;
    trustpilot: number;
    appstore: number;
  };
  emotionWeights: {
    [key: string]: number;
  };
}

export class ViralityPredictionService {
  private config: ViralityConfig;

  constructor(config?: Partial<ViralityConfig>) {
    this.config = {
      weights: {
        toneSeverity: 0.35,
        engagementVelocity: 0.25,
        userInfluence: 0.20,
        contentLength: 0.10,
        platformMultiplier: 0.05,
        timeDecay: 0.05
      },
      thresholds: {
        low: 0.3,
        medium: 0.5,
        high: 0.7,
        viralThreat: 0.85
      },
      platformMultipliers: {
        twitter: 1.2,
        reddit: 1.0,
        trustpilot: 0.8,
        appstore: 0.9
      },
      emotionWeights: {
        anger: 0.9,
        frustration: 0.8,
        betrayal: 0.85,
        sarcasm: 0.7,
        confusion: 0.4,
        disappointment: 0.6,
        joy: 0.3,
        satisfaction: 0.2,
        gratitude: 0.1,
        appreciation: 0.1,
        trust: 0.1
      },
      ...config
    };
  }

  /**
   * Predict virality for feedback with analysis results
   */
  async predictVirality(
    feedback: FeedbackData,
    sentimentResult: SentimentAnalysisResult,
    emotionResult: EmotionAnalysisResult
  ): Promise<ViralityPrediction> {
    // Extract features
    const features = this.extractFeatures(feedback, sentimentResult, emotionResult);
    
    // Calculate weighted score
    const score = this.calculateViralityScore(features);
    
    // Determine risk level
    const riskLevel = this.classifyRiskLevel(score);
    
    // Create virality factors for storage
    const factors: ViralityFactors = {
      toneSeverity: features.toneSeverity,
      engagementVelocity: features.engagementVelocity,
      userInfluence: features.userInfluence
    };
    
    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(feedback, sentimentResult, emotionResult);
    
    // Generate reasoning
    const reasoning = this.generateReasoning(features, score, riskLevel);

    return {
      score,
      riskLevel,
      factors,
      features,
      confidence,
      reasoning
    };
  }

  /**
   * Extract all features for virality prediction
   */
  private extractFeatures(
    feedback: FeedbackData,
    sentimentResult: SentimentAnalysisResult,
    emotionResult: EmotionAnalysisResult
  ): ViralityFeatures {
    return {
      toneSeverity: this.calculateToneSeverity(sentimentResult, emotionResult),
      engagementVelocity: this.calculateEngagementVelocity(feedback),
      userInfluence: this.calculateUserInfluence(feedback),
      contentLength: this.calculateContentLengthFactor(feedback),
      platformMultiplier: this.getPlatformMultiplier(feedback.platform),
      timeDecay: this.calculateTimeDecay(feedback)
    };
  }

  /**
   * Calculate tone severity from sentiment and emotion analysis
   */
  private calculateToneSeverity(
    sentimentResult: SentimentAnalysisResult,
    emotionResult: EmotionAnalysisResult
  ): number {
    let severity = 0;

    // Base severity from sentiment
    if (sentimentResult.sentiment.label === 'negative') {
      severity += sentimentResult.confidence * 0.6;
    } else if (sentimentResult.sentiment.label === 'positive') {
      severity += (1 - sentimentResult.confidence) * 0.3;
    } else {
      severity += 0.2; // Neutral can still be concerning in context
    }

    // Add emotion-based severity
    let emotionSeverity = 0;
    let totalEmotionWeight = 0;

    for (const emotion of emotionResult.emotions) {
      const weight = this.config.emotionWeights[emotion.emotion] || 0.5;
      emotionSeverity += emotion.confidence * weight;
      totalEmotionWeight += emotion.confidence;
    }

    if (totalEmotionWeight > 0) {
      emotionSeverity = emotionSeverity / totalEmotionWeight;
      severity += emotionSeverity * 0.4;
    }

    return Math.min(severity, 1.0);
  }

  /**
   * Calculate engagement velocity (engagement per time unit)
   */
  private calculateEngagementVelocity(feedback: FeedbackData): number {
    const now = new Date();
    const postedAt = feedback.posted_at || feedback.ingested_at;
    const hoursElapsed = Math.max((now.getTime() - postedAt.getTime()) / (1000 * 60 * 60), 0.1);

    const totalEngagement = 
      feedback.engagement.likes + 
      feedback.engagement.shares * 2 + // Shares are more valuable
      feedback.engagement.comments * 1.5; // Comments show deeper engagement

    const velocity = totalEngagement / hoursElapsed;

    // Normalize velocity (log scale to handle wide ranges)
    const normalizedVelocity = Math.log10(velocity + 1) / Math.log10(1000); // Max expected ~1000 eng/hour
    
    return Math.min(normalizedVelocity, 1.0);
  }

  /**
   * Calculate user influence score
   */
  private calculateUserInfluence(feedback: FeedbackData): number {
    let influence = 0;

    // Follower count influence (log scale)
    const followerCount = feedback.author.followerCount || 0;
    if (followerCount > 0) {
      influence += Math.log10(followerCount + 1) / Math.log10(1000000); // Max ~1M followers
    }

    // Verification boost
    if (feedback.author.verified) {
      influence += 0.3;
    }

    // Platform-specific adjustments
    switch (feedback.platform) {
      case 'twitter':
        influence *= 1.2; // Twitter users can have more reach
        break;
      case 'reddit':
        influence *= 0.8; // Reddit is more anonymous
        break;
      case 'trustpilot':
        influence *= 0.9; // Reviews carry weight but less viral
        break;
      case 'appstore':
        influence *= 0.7; // App store reviews are more contained
        break;
    }

    return Math.min(influence, 1.0);
  }

  /**
   * Calculate content length factor
   */
  private calculateContentLengthFactor(feedback: FeedbackData): number {
    const length = feedback.content.length;
    
    // Optimal length for virality is typically 100-280 characters
    if (length >= 100 && length <= 280) {
      return 1.0;
    } else if (length < 50) {
      return 0.5; // Too short, might lack context
    } else if (length > 500) {
      return 0.6; // Too long, might lose attention
    } else {
      return 0.8; // Decent length
    }
  }

  /**
   * Get platform multiplier
   */
  private getPlatformMultiplier(platform: string): number {
    return this.config.platformMultipliers[platform as keyof typeof this.config.platformMultipliers] || 1.0;
  }

  /**
   * Calculate time decay factor
   */
  private calculateTimeDecay(feedback: FeedbackData): number {
    const now = new Date();
    const postedAt = feedback.posted_at || feedback.ingested_at;
    const hoursElapsed = (now.getTime() - postedAt.getTime()) / (1000 * 60 * 60);

    // Content loses virality potential over time
    // Peak virality window is first 6 hours, then decays
    if (hoursElapsed <= 6) {
      return 1.0;
    } else if (hoursElapsed <= 24) {
      return 0.8;
    } else if (hoursElapsed <= 72) {
      return 0.5;
    } else {
      return 0.2;
    }
  }

  /**
   * Calculate weighted virality score
   */
  private calculateViralityScore(features: ViralityFeatures): number {
    const weights = this.config.weights;
    
    const score = 
      features.toneSeverity * weights.toneSeverity +
      features.engagementVelocity * weights.engagementVelocity +
      features.userInfluence * weights.userInfluence +
      features.contentLength * weights.contentLength +
      features.platformMultiplier * weights.platformMultiplier +
      features.timeDecay * weights.timeDecay;

    return Math.min(Math.max(score, 0), 1.0);
  }

  /**
   * Classify risk level based on score
   */
  private classifyRiskLevel(score: number): RiskLevel {
    const thresholds = this.config.thresholds;
    
    if (score >= thresholds.viralThreat) {
      return 'viral-threat';
    } else if (score >= thresholds.high) {
      return 'high';
    } else if (score >= thresholds.medium) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Calculate prediction confidence
   */
  private calculateConfidence(
    feedback: FeedbackData,
    sentimentResult: SentimentAnalysisResult,
    emotionResult: EmotionAnalysisResult
  ): number {
    let confidence = 0.5; // Base confidence

    // Sentiment confidence contributes
    confidence += sentimentResult.confidence * 0.2;

    // Emotion confidence contributes
    const avgEmotionConfidence = emotionResult.emotions.reduce(
      (sum, emotion) => sum + emotion.confidence, 0
    ) / emotionResult.emotions.length;
    confidence += avgEmotionConfidence * 0.2;

    // Data completeness contributes
    let completeness = 0;
    if (feedback.author.followerCount !== undefined) completeness += 0.25;
    if (feedback.author.verified !== undefined) completeness += 0.25;
    if (feedback.posted_at) completeness += 0.25;
    if (feedback.engagement.likes > 0 || feedback.engagement.shares > 0 || feedback.engagement.comments > 0) {
      completeness += 0.25;
    }
    
    confidence += completeness * 0.1;

    return Math.min(Math.max(confidence, 0.1), 1.0);
  }

  /**
   * Generate human-readable reasoning for the prediction
   */
  private generateReasoning(
    features: ViralityFeatures,
    score: number,
    riskLevel: RiskLevel
  ): string[] {
    const reasoning: string[] = [];

    // Overall assessment
    reasoning.push(`Overall virality score: ${(score * 100).toFixed(1)}% (${riskLevel} risk)`);

    // Tone severity reasoning
    if (features.toneSeverity > 0.7) {
      reasoning.push('High tone severity detected - strong negative sentiment and emotions');
    } else if (features.toneSeverity > 0.4) {
      reasoning.push('Moderate tone severity - some concerning sentiment patterns');
    } else {
      reasoning.push('Low tone severity - relatively neutral or positive sentiment');
    }

    // Engagement velocity reasoning
    if (features.engagementVelocity > 0.6) {
      reasoning.push('High engagement velocity - content is gaining traction rapidly');
    } else if (features.engagementVelocity > 0.3) {
      reasoning.push('Moderate engagement velocity - steady interaction growth');
    } else {
      reasoning.push('Low engagement velocity - limited interaction so far');
    }

    // User influence reasoning
    if (features.userInfluence > 0.6) {
      reasoning.push('High user influence - author has significant reach and credibility');
    } else if (features.userInfluence > 0.3) {
      reasoning.push('Moderate user influence - author has some established presence');
    } else {
      reasoning.push('Low user influence - author has limited reach');
    }

    // Time factor
    if (features.timeDecay < 0.5) {
      reasoning.push('Content is aging - virality window is closing');
    } else if (features.timeDecay > 0.8) {
      reasoning.push('Fresh content - still within peak virality window');
    }

    return reasoning;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ViralityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ViralityConfig {
    return { ...this.config };
  }
}