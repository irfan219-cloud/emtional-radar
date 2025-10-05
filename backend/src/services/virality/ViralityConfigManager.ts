import { ViralityConfig } from './ViralityPredictionService';
import { cache } from '@/utils/database';
import { REDIS_KEYS } from '@/utils/redis-keys';

export interface ConfigVersion {
  version: string;
  config: ViralityConfig;
  createdAt: Date;
  createdBy: string;
  description: string;
  performance?: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  isActive: boolean;
}

export interface ConfigUpdateRequest {
  config: Partial<ViralityConfig>;
  description: string;
  updatedBy: string;
}

export class ViralityConfigManager {
  private currentVersion: string = '1.0.0';

  constructor() {
    // No constructor parameters needed since we use the global cache
  }

  /**
   * Get current active configuration
   */
  async getCurrentConfig(): Promise<ViralityConfig> {
    const configKey = REDIS_KEYS.VIRALITY_CONFIG('current');
    const configData = await cache.get(configKey);

    if (configData) {
      return JSON.parse(configData);
    }

    // Return default configuration if none exists
    return this.getDefaultConfig();
  }

  /**
   * Get configuration by version
   */
  async getConfigByVersion(version: string): Promise<ViralityConfig | null> {
    const configKey = REDIS_KEYS.VIRALITY_CONFIG(version);
    const configData = await cache.get(configKey);

    if (configData) {
      const versionData: ConfigVersion = JSON.parse(configData);
      return versionData.config;
    }

    return null;
  }

  /**
   * Update configuration
   */
  async updateConfig(request: ConfigUpdateRequest): Promise<string> {
    const currentConfig = await this.getCurrentConfig();
    const newConfig: ViralityConfig = {
      ...currentConfig,
      ...request.config
    };

    // Validate configuration
    this.validateConfig(newConfig);

    // Generate new version
    const newVersion = this.generateVersion();

    // Create version record
    const versionRecord: ConfigVersion = {
      version: newVersion,
      config: newConfig,
      createdAt: new Date(),
      createdBy: request.updatedBy,
      description: request.description,
      isActive: true
    };

    // Deactivate current version
    await this.deactivateCurrentVersion();

    // Store new version
    const versionKey = REDIS_KEYS.VIRALITY_CONFIG(newVersion);
    await cache.set(versionKey, versionRecord);

    // Update current config pointer
    const currentKey = REDIS_KEYS.VIRALITY_CONFIG('current');
    await cache.set(currentKey, newConfig);

    // Add to version history
    await this.addToVersionHistory(newVersion);

    console.log(`✅ Virality configuration updated to version ${newVersion}`);
    return newVersion;
  }

  /**
   * Rollback to previous version
   */
  async rollbackToVersion(version: string, rollbackBy: string): Promise<void> {
    const config = await this.getConfigByVersion(version);
    if (!config) {
      throw new Error(`Configuration version ${version} not found`);
    }

    // Update current config
    const currentKey = REDIS_KEYS.VIRALITY_CONFIG('current');
    await cache.set(currentKey, config);

    // Mark version as active
    const versionKey = REDIS_KEYS.VIRALITY_CONFIG(version);
    const versionData = await cache.get(versionKey);
    if (versionData) {
      const versionRecord: ConfigVersion = versionData;
      versionRecord.isActive = true;
      await cache.set(versionKey, versionRecord);
    }

    // Deactivate other versions
    const versions = await this.getVersionHistory();
    for (const v of versions) {
      if (v !== version) {
        await this.deactivateVersion(v);
      }
    }

    console.log(`✅ Virality configuration rolled back to version ${version} by ${rollbackBy}`);
  }

  /**
   * Get version history
   */
  async getVersionHistory(): Promise<string[]> {
    const historyKey = REDIS_KEYS.VIRALITY_CONFIG_HISTORY;
    const history = await cache.listRange(historyKey, 0, -1);
    return history;
  }

  /**
   * Get all configuration versions with metadata
   */
  async getAllVersions(): Promise<ConfigVersion[]> {
    const versions = await this.getVersionHistory();
    const configVersions: ConfigVersion[] = [];

    for (const version of versions) {
      const versionKey = REDIS_KEYS.VIRALITY_CONFIG(version);
      const versionData = await cache.get(versionKey);

      if (versionData) {
        configVersions.push(versionData);
      }
    }

    return configVersions.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Update performance metrics for a version
   */
  async updateVersionPerformance(
    version: string,
    performance: {
      accuracy: number;
      precision: number;
      recall: number;
      f1Score: number;
    }
  ): Promise<void> {
    const versionKey = REDIS_KEYS.VIRALITY_CONFIG(version);
    const versionData = await cache.get(versionKey);

    if (versionData) {
      const versionRecord: ConfigVersion = versionData;
      versionRecord.performance = performance;
      await cache.set(versionKey, versionRecord);
    }
  }

  /**
   * A/B test configurations
   */
  async startABTest(
    configA: ViralityConfig,
    configB: ViralityConfig,
    testName: string,
    trafficSplit: number = 0.5
  ): Promise<string> {
    const testId = `ab_test_${Date.now()}`;

    const testConfig = {
      testId,
      testName,
      configA,
      configB,
      trafficSplit,
      startedAt: new Date(),
      isActive: true,
      results: {
        configA: { requests: 0, accuracy: 0 },
        configB: { requests: 0, accuracy: 0 }
      }
    };

    const testKey = REDIS_KEYS.VIRALITY_AB_TEST(testId);
    await cache.set(testKey, testConfig);

    console.log(`🧪 A/B test started: ${testName} (${testId})`);
    return testId;
  }

  /**
   * Get configuration for A/B test
   */
  async getABTestConfig(testId: string, userId?: string): Promise<ViralityConfig | null> {
    const testKey = REDIS_KEYS.VIRALITY_AB_TEST(testId);
    const testData = await cache.get(testKey);

    if (!testData) {
      return null;
    }

    const test = testData;
    if (!test.isActive) {
      return null;
    }

    // Determine which config to use based on user ID or random
    const useConfigA = userId
      ? this.hashUserId(userId) < test.trafficSplit
      : Math.random() < test.trafficSplit;

    return useConfigA ? test.configA : test.configB;
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: ViralityConfig): void {
    // Validate weights sum to reasonable total
    const totalWeight = Object.values(config.weights).reduce((sum, weight) => sum + weight, 0);
    if (totalWeight < 0.8 || totalWeight > 1.2) {
      throw new Error(`Invalid weight configuration: total weight is ${totalWeight}, should be close to 1.0`);
    }

    // Validate thresholds are in order
    const { low, medium, high, viralThreat } = config.thresholds;
    if (low >= medium || medium >= high || high >= viralThreat) {
      throw new Error('Thresholds must be in ascending order: low < medium < high < viralThreat');
    }

    // Validate threshold ranges
    if (low < 0 || viralThreat > 1) {
      throw new Error('Thresholds must be between 0 and 1');
    }

    // Validate platform multipliers
    for (const [platform, multiplier] of Object.entries(config.platformMultipliers)) {
      if (multiplier < 0.1 || multiplier > 5.0) {
        throw new Error(`Invalid platform multiplier for ${platform}: ${multiplier}`);
      }
    }

    // Validate emotion weights
    for (const [emotion, weight] of Object.entries(config.emotionWeights)) {
      if (weight < 0 || weight > 1) {
        throw new Error(`Invalid emotion weight for ${emotion}: ${weight}`);
      }
    }
  }

  /**
   * Generate new version number
   */
  private generateVersion(): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `${this.currentVersion}-${timestamp}`;
  }

  /**
   * Deactivate current version
   */
  private async deactivateCurrentVersion(): Promise<void> {
    const versions = await this.getVersionHistory();
    for (const version of versions) {
      await this.deactivateVersion(version);
    }
  }

  /**
   * Deactivate specific version
   */
  private async deactivateVersion(version: string): Promise<void> {
    const versionKey = REDIS_KEYS.VIRALITY_CONFIG(version);
    const versionData = await cache.get(versionKey);

    if (versionData) {
      const versionRecord: ConfigVersion = versionData;
      versionRecord.isActive = false;
      await cache.set(versionKey, versionRecord);
    }
  }

  /**
   * Add version to history
   */
  private async addToVersionHistory(version: string): Promise<void> {
    const historyKey = REDIS_KEYS.VIRALITY_CONFIG_HISTORY;
    await cache.listPush(historyKey, version);

    // Keep only last 50 versions - we'll implement this with a simple check
    const history = await cache.listRange(historyKey, 0, -1);
    if (history.length > 50) {
      // For now, we'll just log this - implementing ltrim would require direct Redis access
      console.warn('Version history exceeds 50 items, consider cleanup');
    }
  }

  /**
   * Hash user ID for consistent A/B test assignment
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) / 2147483647; // Normalize to 0-1
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): ViralityConfig {
    return {
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
  }
}