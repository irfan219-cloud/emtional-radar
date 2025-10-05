import { ViralityPredictionService, ViralityPrediction } from './ViralityPredictionService';
import { NLPAnalysisService } from '../nlp/NLPAnalysisService';
import { FeedbackData, AnalysisResult, ViralityFactors, EmotionType } from '@/types/feedback';
import { AnalysisRepository } from '@/repositories/AnalysisRepository';
import { FeedbackRepository } from '@/repositories/FeedbackRepository';
import { AlertRepository } from '@/repositories/AlertRepository';

export interface ViralityAnalysisResult {
  feedbackId: string;
  prediction: ViralityPrediction;
  analysisId?: string;
  alertCreated: boolean;
  processingTime: number;
}

export interface ViralityBatchResult {
  processed: number;
  successful: number;
  failed: number;
  results: ViralityAnalysisResult[];
  errors: Array<{ feedbackId: string; error: string }>;
}

export class ViralityAnalysisService {
  private viralityService: ViralityPredictionService;
  private nlpService: NLPAnalysisService;
  private analysisRepo: AnalysisRepository;
  private feedbackRepo: FeedbackRepository;
  private alertRepo: AlertRepository;

  constructor(
    viralityService: ViralityPredictionService,
    nlpService: NLPAnalysisService,
    analysisRepo: AnalysisRepository,
    feedbackRepo: FeedbackRepository,
    alertRepo: AlertRepository
  ) {
    this.viralityService = viralityService;
    this.nlpService = nlpService;
    this.analysisRepo = analysisRepo;
    this.feedbackRepo = feedbackRepo;
    this.alertRepo = alertRepo;
  }

  /**
   * Analyze virality for a single feedback item
   */
  async analyzeFeedbackVirality(feedbackId: string): Promise<ViralityAnalysisResult> {
    const startTime = Date.now();
    
    try {
      // Get feedback data
      const feedback = await this.feedbackRepo.findById(feedbackId);
      if (!feedback) {
        throw new Error(`Feedback not found: ${feedbackId}`);
      }

      // Check if analysis already exists
      let analysis = await this.analysisRepo.findByFeedbackId(feedbackId);
      
      // If no analysis exists, run NLP analysis first
      if (!analysis) {
        const nlpResult = await this.nlpService.analyzeFeedback({
          id: feedbackId,
          text: feedback.content,
          platform: feedback.platform
        });

        // Store NLP analysis results
        analysis = await this.analysisRepo.create({
          feedback_id: feedbackId,
          sentiment: nlpResult.sentiment.sentiment,
          emotions: nlpResult.emotions.emotions,
          virality_score: 0, // Will be updated below
          virality_factors: {
            toneSeverity: 0,
            engagementVelocity: 0,
            userInfluence: 0
          },
          risk_level: 'low',
          processed_at: new Date()
        });
      }

      // Run virality prediction
      const prediction = await this.viralityService.predictVirality(
        feedback,
        {
          sentiment: analysis.sentiment,
          confidence: analysis.sentiment.confidence,
          scores: { positive: 0, neutral: 0, negative: 0 },
          processingTime: 0,
          modelUsed: 'stored'
        },
        {
          emotions: analysis.emotions,
          primaryEmotion: analysis.emotions[0]?.emotion || 'neutral' as EmotionType,
          confidence: analysis.emotions[0]?.confidence || 0,
          scores: {} as Record<EmotionType, number>,
          processingTime: 0,
          modelUsed: 'stored'
        }
      );

      // Update analysis with virality results
      const updatedAnalysis = await this.analysisRepo.update(analysis.id, {
        virality_score: prediction.score,
        virality_factors: prediction.factors,
        risk_level: prediction.riskLevel
      });

      // Create alert if high risk
      let alertCreated = false;
      if (prediction.riskLevel === 'high' || prediction.riskLevel === 'viral-threat') {
        alertCreated = await this.createViralityAlert(feedback, prediction);
      }

      const processingTime = Date.now() - startTime;

      return {
        feedbackId,
        prediction,
        analysisId: updatedAnalysis?.id,
        alertCreated,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`Virality analysis failed for feedback ${feedbackId}:`, error);
      
      return {
        feedbackId,
        prediction: {
          score: 0,
          riskLevel: 'low',
          factors: { toneSeverity: 0, engagementVelocity: 0, userInfluence: 0 },
          features: {
            toneSeverity: 0,
            engagementVelocity: 0,
            userInfluence: 0,
            contentLength: 0,
            platformMultiplier: 0,
            timeDecay: 0
          },
          confidence: 0,
          reasoning: [`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
        },
        alertCreated: false,
        processingTime
      };
    }
  }

  /**
   * Analyze virality for multiple feedback items
   */
  async analyzeBatchVirality(feedbackIds: string[]): Promise<ViralityBatchResult> {
    const results: ViralityAnalysisResult[] = [];
    const errors: Array<{ feedbackId: string; error: string }> = [];
    let successful = 0;

    for (const feedbackId of feedbackIds) {
      try {
        const result = await this.analyzeFeedbackVirality(feedbackId);
        results.push(result);
        
        if (result.prediction.score > 0) {
          successful++;
        }
      } catch (error) {
        errors.push({
          feedbackId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      processed: feedbackIds.length,
      successful,
      failed: errors.length,
      results,
      errors
    };
  }

  /**
   * Analyze virality for recent feedback
   */
  async analyzeRecentFeedback(hours: number = 24, limit: number = 100): Promise<ViralityBatchResult> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // Get recent feedback without virality analysis
    // Using findMany as a fallback since findRecentWithoutAnalysis doesn't exist yet
    const recentFeedback = await this.feedbackRepo.findMany({
      where: [{ field: 'ingested_at', operator: '>=' as const, value: since }],
      orderBy: [{ field: 'ingested_at', direction: 'DESC' }]
    }).then(results => results.slice(0, limit));
    const feedbackIds = recentFeedback.map((f: any) => f.id);

    if (feedbackIds.length === 0) {
      return {
        processed: 0,
        successful: 0,
        failed: 0,
        results: [],
        errors: []
      };
    }

    return await this.analyzeBatchVirality(feedbackIds);
  }

  /**
   * Re-analyze feedback with updated engagement data
   */
  async reanalyzeWithUpdatedEngagement(feedbackId: string): Promise<ViralityAnalysisResult> {
    // Refresh feedback data to get latest engagement metrics
    const feedback = await this.feedbackRepo.findById(feedbackId);
    if (!feedback) {
      throw new Error(`Feedback not found: ${feedbackId}`);
    }

    // Get existing analysis
    const analysis = await this.analysisRepo.findByFeedbackId(feedbackId);
    if (!analysis) {
      // If no analysis exists, run full analysis
      return await this.analyzeFeedbackVirality(feedbackId);
    }

    const startTime = Date.now();

    try {
      // Run virality prediction with updated data
      const prediction = await this.viralityService.predictVirality(
        feedback,
        {
          sentiment: analysis.sentiment,
          confidence: analysis.sentiment.confidence,
          scores: { positive: 0, neutral: 0, negative: 0 },
          processingTime: 0,
          modelUsed: 'stored'
        },
        {
          emotions: analysis.emotions,
          primaryEmotion: analysis.emotions[0]?.emotion || 'neutral' as EmotionType,
          confidence: analysis.emotions[0]?.confidence || 0,
          scores: {} as Record<EmotionType, number>,
          processingTime: 0,
          modelUsed: 'stored'
        }
      );

      // Update analysis with new virality results
      const updatedAnalysis = await this.analysisRepo.update(analysis.id, {
        virality_score: prediction.score,
        virality_factors: prediction.factors,
        risk_level: prediction.riskLevel
      });

      // Check if we need to create/update alerts
      let alertCreated = false;
      const existingAlert = await this.alertRepo.findByFeedbackId(feedbackId);
      
      if (prediction.riskLevel === 'high' || prediction.riskLevel === 'viral-threat') {
        if (!existingAlert) {
          alertCreated = await this.createViralityAlert(feedback, prediction);
        } else if (existingAlert.severity !== this.mapRiskToSeverity(prediction.riskLevel)) {
          // Update existing alert severity
          await this.alertRepo.update(existingAlert.id, {
            severity: this.mapRiskToSeverity(prediction.riskLevel),
            message: this.generateAlertMessage(feedback, prediction)
          } as any);
          alertCreated = true;
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        feedbackId,
        prediction,
        analysisId: updatedAnalysis?.id,
        alertCreated,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`Virality re-analysis failed for feedback ${feedbackId}:`, error);
      throw error;
    }
  }

  /**
   * Get virality statistics for a time period
   */
  async getViralityStats(dateFrom: Date, dateTo: Date): Promise<{
    totalAnalyzed: number;
    riskDistribution: Record<string, number>;
    averageScore: number;
    topFactors: Array<{ factor: string; avgValue: number }>;
    alertsGenerated: number;
  }> {
    const analyses = await this.analysisRepo.findMany({
      where: [
        { field: 'processed_at', operator: '>=' as const, value: dateFrom },
        { field: 'processed_at', operator: '<=' as const, value: dateTo }
      ],
      orderBy: [{ field: 'processed_at', direction: 'DESC' }]
    });
    
    if (analyses.length === 0) {
      return {
        totalAnalyzed: 0,
        riskDistribution: {},
        averageScore: 0,
        topFactors: [],
        alertsGenerated: 0
      };
    }

    // Calculate risk distribution
    const riskDistribution: Record<string, number> = {};
    let totalScore = 0;
    let toneSeveritySum = 0;
    let engagementVelocitySum = 0;
    let userInfluenceSum = 0;

    for (const analysis of analyses) {
      riskDistribution[analysis.risk_level] = (riskDistribution[analysis.risk_level] || 0) + 1;
      totalScore += analysis.virality_score;
      toneSeveritySum += analysis.virality_factors.toneSeverity;
      engagementVelocitySum += analysis.virality_factors.engagementVelocity;
      userInfluenceSum += analysis.virality_factors.userInfluence;
    }

    const averageScore = totalScore / analyses.length;
    
    const topFactors = [
      { factor: 'toneSeverity', avgValue: toneSeveritySum / analyses.length },
      { factor: 'engagementVelocity', avgValue: engagementVelocitySum / analyses.length },
      { factor: 'userInfluence', avgValue: userInfluenceSum / analyses.length }
    ].sort((a, b) => b.avgValue - a.avgValue);

    // Count alerts generated in the period
    const alerts = await this.alertRepo.getAlertsInDateRange(dateFrom, dateTo);
    const alertsGenerated = alerts.length;

    return {
      totalAnalyzed: analyses.length,
      riskDistribution,
      averageScore,
      topFactors,
      alertsGenerated
    };
  }

  /**
   * Create virality alert
   */
  private async createViralityAlert(
    feedback: FeedbackData,
    prediction: ViralityPrediction
  ): Promise<boolean> {
    try {
      const severity = this.mapRiskToSeverity(prediction.riskLevel);
      const message = this.generateAlertMessage(feedback, prediction);

      await this.alertRepo.create({
        feedback_id: feedback.id,
        severity,
        message,
        sent_slack: false,
        sent_email: false,
        resolved: false
      });

      return true;
    } catch (error) {
      console.error('Failed to create virality alert:', error);
      return false;
    }
  }

  /**
   * Map risk level to alert severity
   */
  private mapRiskToSeverity(riskLevel: string): 'mild' | 'risky' | 'viral-threat' {
    switch (riskLevel) {
      case 'viral-threat':
        return 'viral-threat';
      case 'high':
        return 'risky';
      default:
        return 'mild';
    }
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(feedback: FeedbackData, prediction: ViralityPrediction): string {
    const platform = feedback.platform.toUpperCase();
    const score = (prediction.score * 100).toFixed(1);
    const author = feedback.author.username;
    
    let message = `${platform} content by @${author} has ${prediction.riskLevel} virality risk (${score}% score). `;
    
    // Add key factors
    const keyFactors = [];
    if (prediction.factors.toneSeverity > 0.6) {
      keyFactors.push('severe tone');
    }
    if (prediction.factors.engagementVelocity > 0.6) {
      keyFactors.push('high engagement velocity');
    }
    if (prediction.factors.userInfluence > 0.6) {
      keyFactors.push('influential user');
    }
    
    if (keyFactors.length > 0) {
      message += `Key factors: ${keyFactors.join(', ')}.`;
    }

    return message;
  }
}