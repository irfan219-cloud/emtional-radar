/**
 * Virality Prediction Service - Main Export
 * 
 * This module provides comprehensive virality prediction capabilities including:
 * - Feature extraction from feedback and NLP analysis
 * - Weighted scoring algorithm with configurable parameters
 * - Risk level classification (low, medium, high, viral-threat)
 * - Model training and optimization
 * - Configuration management with versioning and A/B testing
 */

export { ViralityPredictionService, ViralityConfig, ViralityFeatures, ViralityPrediction } from './ViralityPredictionService';
export { ViralityAnalysisService, ViralityAnalysisResult, ViralityBatchResult } from './ViralityAnalysisService';
export { ViralityModelTrainer, TrainingData, ModelPerformance, TrainingResult } from './ViralityModelTrainer';
export { ViralityConfigManager, ConfigVersion, ConfigUpdateRequest } from './ViralityConfigManager';

import { ViralityPredictionService } from './ViralityPredictionService';
import { ViralityAnalysisService } from './ViralityAnalysisService';
import { ViralityModelTrainer } from './ViralityModelTrainer';
import { ViralityConfigManager } from './ViralityConfigManager';
import { NLPAnalysisService } from '../nlp/NLPAnalysisService';
import { AnalysisRepository } from '@/repositories/AnalysisRepository';
import { FeedbackRepository } from '@/repositories/FeedbackRepository';
import { AlertRepository } from '@/repositories/AlertRepository';

/**
 * Factory function to create a fully configured virality analysis service
 */
export function createViralityAnalysisService(
  nlpService: NLPAnalysisService
): ViralityAnalysisService {
  const configManager = new ViralityConfigManager();
  const predictionService = new ViralityPredictionService();
  const analysisRepo = new AnalysisRepository();
  const feedbackRepo = new FeedbackRepository();
  const alertRepo = new AlertRepository();

  return new ViralityAnalysisService(
    predictionService,
    nlpService,
    analysisRepo,
    feedbackRepo,
    alertRepo
  );
}

/**
 * Factory function to create a model trainer
 */
export function createViralityModelTrainer(): ViralityModelTrainer {
  const analysisRepo = new AnalysisRepository();
  const feedbackRepo = new FeedbackRepository();
  const alertRepo = new AlertRepository();

  return new ViralityModelTrainer(
    analysisRepo,
    feedbackRepo,
    alertRepo
  );
}

/**
 * Default virality configuration
 */
export const DEFAULT_VIRALITY_CONFIG = {
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
} as const;