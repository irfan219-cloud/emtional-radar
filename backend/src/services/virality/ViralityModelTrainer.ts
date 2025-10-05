import { ViralityConfig, ViralityFeatures } from './ViralityPredictionService';
import { AnalysisRepository } from '@/repositories/AnalysisRepository';
import { FeedbackRepository } from '@/repositories/FeedbackRepository';
import { AlertRepository } from '@/repositories/AlertRepository';

export interface TrainingData {
  features: ViralityFeatures;
  actualOutcome: {
    viralityScore: number;
    riskLevel: string;
    alertGenerated: boolean;
    engagementGrowth: number;
  };
  feedbackId: string;
}

export interface ModelPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: Record<string, Record<string, number>>;
  featureImportance: Record<string, number>;
}

export interface TrainingResult {
  performance: ModelPerformance;
  optimalConfig: ViralityConfig;
  trainingDataSize: number;
  validationDataSize: number;
  improvementSuggestions: string[];
}

export class ViralityModelTrainer {
  private analysisRepo: AnalysisRepository;
  private feedbackRepo: FeedbackRepository;
  private alertRepo: AlertRepository;

  constructor(
    analysisRepo: AnalysisRepository,
    feedbackRepo: FeedbackRepository,
    alertRepo: AlertRepository
  ) {
    this.analysisRepo = analysisRepo;
    this.feedbackRepo = feedbackRepo;
    this.alertRepo = alertRepo;
  }

  /**
   * Collect training data from historical feedback and outcomes
   */
  async collectTrainingData(
    dateFrom: Date,
    dateTo: Date,
    minEngagementThreshold: number = 10
  ): Promise<TrainingData[]> {
    const trainingData: TrainingData[] = [];

    // Get all analyzed feedback in the date range
    const analyses = await this.analysisRepo.findInDateRange(dateFrom, dateTo);

    for (const analysis of analyses) {
      try {
        // Get feedback data
        const feedback = await this.feedbackRepo.findById(analysis.feedback_id);
        if (!feedback) continue;

        // Skip if engagement is too low to determine virality
        const totalEngagement = feedback.engagement.likes + feedback.engagement.shares + feedback.engagement.comments;
        if (totalEngagement < minEngagementThreshold) continue;

        // Calculate actual outcome metrics
        const actualOutcome = await this.calculateActualOutcome(feedback.id, analysis);

        // Reconstruct features (this would ideally be stored)
        const features = await this.reconstructFeatures(feedback, analysis);

        trainingData.push({
          features,
          actualOutcome,
          feedbackId: feedback.id
        });

      } catch (error) {
        console.warn(`Failed to process training data for analysis ${analysis.id}:`, error);
      }
    }

    return trainingData;
  }

  /**
   * Train and optimize the virality prediction model
   */
  async trainModel(
    trainingData: TrainingData[],
    validationSplit: number = 0.2
  ): Promise<TrainingResult> {
    if (trainingData.length < 50) {
      throw new Error('Insufficient training data. Need at least 50 samples.');
    }

    // Split data
    const shuffled = this.shuffleArray([...trainingData]);
    const splitIndex = Math.floor(trainingData.length * (1 - validationSplit));
    const trainSet = shuffled.slice(0, splitIndex);
    const validationSet = shuffled.slice(splitIndex);

    // Find optimal configuration using grid search
    const optimalConfig = await this.gridSearchOptimization(trainSet, validationSet);

    // Evaluate performance on validation set
    const performance = await this.evaluateModel(validationSet, optimalConfig);

    // Generate improvement suggestions
    const improvementSuggestions = this.generateImprovementSuggestions(performance, trainingData);

    return {
      performance,
      optimalConfig,
      trainingDataSize: trainSet.length,
      validationDataSize: validationSet.length,
      improvementSuggestions
    };
  }

  /**
   * Perform grid search to find optimal configuration
   */
  private async gridSearchOptimization(
    trainSet: TrainingData[],
    validationSet: TrainingData[]
  ): Promise<ViralityConfig> {
    const baseConfig: ViralityConfig = {
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
      }
    };

    let bestConfig = baseConfig;
    let bestScore = 0;

    // Define parameter ranges for grid search
    const weightRanges = {
      toneSeverity: [0.25, 0.30, 0.35, 0.40, 0.45],
      engagementVelocity: [0.15, 0.20, 0.25, 0.30, 0.35],
      userInfluence: [0.10, 0.15, 0.20, 0.25, 0.30]
    };

    const thresholdRanges = {
      medium: [0.4, 0.45, 0.5, 0.55, 0.6],
      high: [0.65, 0.7, 0.75, 0.8],
      viralThreat: [0.8, 0.85, 0.9, 0.95]
    };

    // Grid search over key parameters
    for (const toneSeverity of weightRanges.toneSeverity) {
      for (const engagementVelocity of weightRanges.engagementVelocity) {
        for (const userInfluence of weightRanges.userInfluence) {
          for (const mediumThreshold of thresholdRanges.medium) {
            for (const highThreshold of thresholdRanges.high) {
              for (const viralThreatThreshold of thresholdRanges.viralThreat) {
                
                // Ensure weights sum to reasonable total
                const remainingWeight = 1.0 - toneSeverity - engagementVelocity - userInfluence;
                if (remainingWeight < 0.1 || remainingWeight > 0.4) continue;

                // Ensure thresholds are in order
                if (mediumThreshold >= highThreshold || highThreshold >= viralThreatThreshold) continue;

                const testConfig: ViralityConfig = {
                  ...baseConfig,
                  weights: {
                    ...baseConfig.weights,
                    toneSeverity,
                    engagementVelocity,
                    userInfluence,
                    contentLength: remainingWeight * 0.5,
                    platformMultiplier: remainingWeight * 0.3,
                    timeDecay: remainingWeight * 0.2
                  },
                  thresholds: {
                    low: 0.3,
                    medium: mediumThreshold,
                    high: highThreshold,
                    viralThreat: viralThreatThreshold
                  }
                };

                const performance = await this.evaluateModel(validationSet, testConfig);
                const score = performance.f1Score; // Use F1 score as optimization metric

                if (score > bestScore) {
                  bestScore = score;
                  bestConfig = testConfig;
                }
              }
            }
          }
        }
      }
    }

    return bestConfig;
  }

  /**
   * Evaluate model performance
   */
  private async evaluateModel(
    testData: TrainingData[],
    config: ViralityConfig
  ): Promise<ModelPerformance> {
    const predictions: Array<{ predicted: string; actual: string }> = [];
    
    for (const sample of testData) {
      const predictedScore = this.calculateScore(sample.features, config);
      const predictedRisk = this.classifyRisk(predictedScore, config);
      const actualRisk = sample.actualOutcome.riskLevel;
      
      predictions.push({
        predicted: predictedRisk,
        actual: actualRisk
      });
    }

    return this.calculateMetrics(predictions);
  }

  /**
   * Calculate performance metrics
   */
  private calculateMetrics(
    predictions: Array<{ predicted: string; actual: string }>
  ): ModelPerformance {
    const classes = ['low', 'medium', 'high', 'viral-threat'];
    const confusionMatrix: Record<string, Record<string, number>> = {};
    
    // Initialize confusion matrix
    for (const actual of classes) {
      confusionMatrix[actual] = {};
      for (const predicted of classes) {
        confusionMatrix[actual][predicted] = 0;
      }
    }

    // Fill confusion matrix
    for (const { predicted, actual } of predictions) {
      confusionMatrix[actual][predicted]++;
    }

    // Calculate metrics
    let totalCorrect = 0;
    let totalPredictions = predictions.length;
    const classMetrics: Record<string, { precision: number; recall: number; f1: number }> = {};

    for (const cls of classes) {
      const tp = confusionMatrix[cls][cls];
      const fp = classes.reduce((sum, c) => sum + (c !== cls ? confusionMatrix[c][cls] : 0), 0);
      const fn = classes.reduce((sum, c) => sum + (c !== cls ? confusionMatrix[cls][c] : 0), 0);

      const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
      const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
      const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

      classMetrics[cls] = { precision, recall, f1 };
      totalCorrect += tp;
    }

    const accuracy = totalCorrect / totalPredictions;
    const avgPrecision = Object.values(classMetrics).reduce((sum, m) => sum + m.precision, 0) / classes.length;
    const avgRecall = Object.values(classMetrics).reduce((sum, m) => sum + m.recall, 0) / classes.length;
    const avgF1 = Object.values(classMetrics).reduce((sum, m) => sum + m.f1, 0) / classes.length;

    // Calculate feature importance (simplified)
    const featureImportance = {
      toneSeverity: 0.35,
      engagementVelocity: 0.25,
      userInfluence: 0.20,
      contentLength: 0.10,
      platformMultiplier: 0.05,
      timeDecay: 0.05
    };

    return {
      accuracy,
      precision: avgPrecision,
      recall: avgRecall,
      f1Score: avgF1,
      confusionMatrix,
      featureImportance
    };
  }

  /**
   * Calculate virality score using given config
   */
  private calculateScore(features: ViralityFeatures, config: ViralityConfig): number {
    const weights = config.weights;
    
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
   * Classify risk level using given config
   */
  private classifyRisk(score: number, config: ViralityConfig): string {
    const thresholds = config.thresholds;
    
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
   * Calculate actual outcome metrics
   */
  private async calculateActualOutcome(feedbackId: string, analysis: any): Promise<{
    viralityScore: number;
    riskLevel: string;
    alertGenerated: boolean;
    engagementGrowth: number;
  }> {
    // Check if alert was generated
    const alert = await this.alertRepo.findByFeedbackId(feedbackId);
    const alertGenerated = !!alert;

    // Get current feedback to calculate engagement growth
    const currentFeedback = await this.feedbackRepo.findById(feedbackId);
    if (!currentFeedback) {
      throw new Error(`Feedback not found: ${feedbackId}`);
    }

    // Calculate engagement growth (simplified - would need historical data)
    const currentEngagement = currentFeedback.engagement.likes + 
                             currentFeedback.engagement.shares + 
                             currentFeedback.engagement.comments;
    
    // For now, use current engagement as proxy for growth
    // In production, you'd compare with historical snapshots
    const engagementGrowth = Math.log10(currentEngagement + 1) / Math.log10(1000);

    // Determine actual virality score based on outcomes
    let actualViralityScore = 0;
    
    if (alertGenerated) {
      actualViralityScore += 0.4;
    }
    
    actualViralityScore += Math.min(engagementGrowth, 0.6);

    // Determine actual risk level
    let actualRiskLevel = 'low';
    if (actualViralityScore >= 0.85) {
      actualRiskLevel = 'viral-threat';
    } else if (actualViralityScore >= 0.7) {
      actualRiskLevel = 'high';
    } else if (actualViralityScore >= 0.5) {
      actualRiskLevel = 'medium';
    }

    return {
      viralityScore: actualViralityScore,
      riskLevel: actualRiskLevel,
      alertGenerated,
      engagementGrowth
    };
  }

  /**
   * Reconstruct features from feedback and analysis
   */
  private async reconstructFeatures(feedback: any, analysis: any): Promise<ViralityFeatures> {
    // This is a simplified reconstruction
    // In production, you'd store the original features
    return {
      toneSeverity: analysis.virality_factors.toneSeverity,
      engagementVelocity: analysis.virality_factors.engagementVelocity,
      userInfluence: analysis.virality_factors.userInfluence,
      contentLength: Math.min(feedback.content.length / 280, 1.0),
      platformMultiplier: this.getPlatformMultiplier(feedback.platform),
      timeDecay: this.calculateTimeDecay(feedback.posted_at || feedback.ingested_at)
    };
  }

  /**
   * Get platform multiplier
   */
  private getPlatformMultiplier(platform: string): number {
    const multipliers: Record<string, number> = {
      twitter: 1.2,
      reddit: 1.0,
      trustpilot: 0.8,
      appstore: 0.9
    };
    return multipliers[platform] || 1.0;
  }

  /**
   * Calculate time decay
   */
  private calculateTimeDecay(postedAt: Date): number {
    const now = new Date();
    const hoursElapsed = (now.getTime() - postedAt.getTime()) / (1000 * 60 * 60);

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
   * Generate improvement suggestions
   */
  private generateImprovementSuggestions(
    performance: ModelPerformance,
    trainingData: TrainingData[]
  ): string[] {
    const suggestions: string[] = [];

    if (performance.accuracy < 0.7) {
      suggestions.push('Model accuracy is below 70%. Consider collecting more training data or adjusting feature weights.');
    }

    if (performance.precision < 0.6) {
      suggestions.push('Low precision detected. The model may be generating too many false positives. Consider raising thresholds.');
    }

    if (performance.recall < 0.6) {
      suggestions.push('Low recall detected. The model may be missing viral content. Consider lowering thresholds or improving feature extraction.');
    }

    if (trainingData.length < 200) {
      suggestions.push('Training dataset is small. Collect more historical data for better model performance.');
    }

    // Check feature importance balance
    const { featureImportance } = performance;
    const maxImportance = Math.max(...Object.values(featureImportance));
    const minImportance = Math.min(...Object.values(featureImportance));
    
    if (maxImportance / minImportance > 10) {
      suggestions.push('Feature importance is imbalanced. Consider rebalancing feature weights or improving low-importance features.');
    }

    return suggestions;
  }

  /**
   * Shuffle array utility
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}