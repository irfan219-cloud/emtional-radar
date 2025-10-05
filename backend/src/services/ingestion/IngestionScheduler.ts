import cron from 'node-cron';
import { IngestionSchedule, IngestionJob, Platform } from '@/types/ingestion';
import { IngestionManager } from './IngestionManager';
import { IngestionQueue } from './IngestionQueue';
import { RedisManager } from '@/utils/redis-manager';

export interface SchedulerConfig {
    enabled: boolean;
    timezone?: string;
    maxConcurrentJobs?: number;
}

export class IngestionScheduler {
    private ingestionManager: IngestionManager;
    private ingestionQueue: IngestionQueue;
    private schedules: Map<string, IngestionSchedule> = new Map();
    private cronJobs: Map<string, cron.ScheduledTask> = new Map();
    private config: SchedulerConfig;
    private isRunning: boolean = false;

    constructor(
        ingestionManager: IngestionManager,
        ingestionQueue: IngestionQueue,
        config: SchedulerConfig = { enabled: true }
    ) {
        this.ingestionManager = ingestionManager;
        this.ingestionQueue = ingestionQueue;
        this.config = config;
    }

    /**
     * Initialize the scheduler
     */
    async initialize(): Promise<void> {
        if (!this.config.enabled) {
            console.log('📅 Ingestion scheduler is disabled');
            return;
        }

        console.log('📅 Initializing ingestion scheduler...');

        // Load existing schedules from Redis
        await this.loadSchedules();

        // Start all active schedules
        await this.startAllSchedules();

        this.isRunning = true;
        console.log('✅ Ingestion scheduler initialized');
    }

    /**
     * Create a new schedule
     */
    async createSchedule(schedule: Omit<IngestionSchedule, 'id' | 'createdAt' | 'updatedAt' | 'nextRun'>): Promise<IngestionSchedule> {
        const newSchedule: IngestionSchedule = {
            ...schedule,
            id: this.generateScheduleId(),
            createdAt: new Date(),
            updatedAt: new Date(),
            nextRun: this.calculateNextRun(schedule.cronExpression)
        };

        // Validate cron expression
        if (!cron.validate(newSchedule.cronExpression)) {
            throw new Error(`Invalid cron expression: ${newSchedule.cronExpression}`);
        }

        // Store schedule
        this.schedules.set(newSchedule.id, newSchedule);
        await this.saveSchedule(newSchedule);

        // Start the schedule if enabled
        if (newSchedule.enabled && this.isRunning) {
            await this.startSchedule(newSchedule.id);
        }

        console.log(`📅 Created schedule: ${newSchedule.id} (${newSchedule.platform})`);
        return newSchedule;
    }

    /**
     * Update an existing schedule
     */
    async updateSchedule(scheduleId: string, updates: Partial<IngestionSchedule>): Promise<IngestionSchedule | null> {
        const existingSchedule = this.schedules.get(scheduleId);
        if (!existingSchedule) {
            return null;
        }

        // Stop existing cron job if it exists
        await this.stopSchedule(scheduleId);

        // Update schedule
        const updatedSchedule: IngestionSchedule = {
            ...existingSchedule,
            ...updates,
            id: scheduleId, // Ensure ID doesn't change
            updatedAt: new Date()
        };

        // Recalculate next run if cron expression changed
        if (updates.cronExpression) {
            if (!cron.validate(updates.cronExpression)) {
                throw new Error(`Invalid cron expression: ${updates.cronExpression}`);
            }
            updatedSchedule.nextRun = this.calculateNextRun(updates.cronExpression);
        }

        // Store updated schedule
        this.schedules.set(scheduleId, updatedSchedule);
        await this.saveSchedule(updatedSchedule);

        // Restart the schedule if enabled
        if (updatedSchedule.enabled && this.isRunning) {
            await this.startSchedule(scheduleId);
        }

        console.log(`📅 Updated schedule: ${scheduleId}`);
        return updatedSchedule;
    }

    /**
     * Delete a schedule
     */
    async deleteSchedule(scheduleId: string): Promise<boolean> {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            return false;
        }

        // Stop the cron job
        await this.stopSchedule(scheduleId);

        // Remove from memory and Redis
        this.schedules.delete(scheduleId);
        await RedisManager.getUserSession(`ingestion_schedule:${scheduleId}`);

        console.log(`📅 Deleted schedule: ${scheduleId}`);
        return true;
    }

    /**
     * Get a schedule by ID
     */
    getSchedule(scheduleId: string): IngestionSchedule | null {
        return this.schedules.get(scheduleId) || null;
    }

    /**
     * Get all schedules
     */
    getAllSchedules(): IngestionSchedule[] {
        return Array.from(this.schedules.values());
    }

    /**
     * Get schedules by platform
     */
    getSchedulesByPlatform(platform: Platform): IngestionSchedule[] {
        return Array.from(this.schedules.values()).filter(schedule =>
            schedule.platform === platform
        );
    }

    /**
     * Start a specific schedule
     */
    async startSchedule(scheduleId: string): Promise<boolean> {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule || !schedule.enabled) {
            return false;
        }

        // Stop existing cron job if it exists
        await this.stopSchedule(scheduleId);

        try {
            const cronJob = cron.schedule(
                schedule.cronExpression,
                async () => {
                    await this.executeScheduledJob(schedule);
                },
                {
                    scheduled: true,
                    timezone: this.config.timezone || 'UTC'
                }
            );

            this.cronJobs.set(scheduleId, cronJob);
            console.log(`▶️ Started schedule: ${scheduleId} (${schedule.cronExpression})`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to start schedule ${scheduleId}:`, error);
            return false;
        }
    }

    /**
     * Stop a specific schedule
     */
    async stopSchedule(scheduleId: string): Promise<boolean> {
        const cronJob = this.cronJobs.get(scheduleId);
        if (cronJob) {
            cronJob.stop();
            // Note: destroy() method may not be available in all versions of node-cron
            if (typeof (cronJob as any).destroy === 'function') {
                (cronJob as any).destroy();
            }
            this.cronJobs.delete(scheduleId);
            console.log(`⏹️ Stopped schedule: ${scheduleId}`);
            return true;
        }
        return false;
    }

    /**
     * Start all enabled schedules
     */
    async startAllSchedules(): Promise<void> {
        const enabledSchedules = Array.from(this.schedules.values()).filter(s => s.enabled);

        for (const schedule of enabledSchedules) {
            await this.startSchedule(schedule.id);
        }

        console.log(`▶️ Started ${enabledSchedules.length} schedules`);
    }

    /**
     * Stop all schedules
     */
    async stopAllSchedules(): Promise<void> {
        const scheduleIds = Array.from(this.cronJobs.keys());

        for (const scheduleId of scheduleIds) {
            await this.stopSchedule(scheduleId);
        }

        console.log(`⏹️ Stopped ${scheduleIds.length} schedules`);
    }

    /**
     * Execute a scheduled job
     */
    private async executeScheduledJob(schedule: IngestionSchedule): Promise<void> {
        console.log(`🔄 Executing scheduled job: ${schedule.id} (${schedule.platform})`);

        try {
            // Create ingestion job based on schedule
            const ingestionJob: IngestionJob = {
                id: `scheduled_${schedule.id}_${Date.now()}`,
                platform: schedule.platform,
                type: schedule.type,
                query: schedule.query,
                userId: schedule.userId,
                maxResults: schedule.maxResults,
                status: 'pending',
                createdAt: new Date(),
                progress: {
                    processed: 0
                }
            };

            // Add job to queue
            await this.ingestionQueue.addJob(ingestionJob);

            // Update schedule's last run time
            schedule.lastRun = new Date();
            schedule.nextRun = this.calculateNextRun(schedule.cronExpression);
            schedule.updatedAt = new Date();

            // Save updated schedule
            this.schedules.set(schedule.id, schedule);
            await this.saveSchedule(schedule);

            console.log(`✅ Scheduled job queued: ${ingestionJob.id}`);
        } catch (error) {
            console.error(`❌ Failed to execute scheduled job ${schedule.id}:`, error);
        }
    }

    /**
     * Calculate next run time for a cron expression
     */
    private calculateNextRun(cronExpression: string): Date {
        try {
            // This is a simplified calculation - in production you might want to use a more robust library
            const now = new Date();
            const nextRun = new Date(now.getTime() + 60 * 60 * 1000); // Default to 1 hour from now
            return nextRun;
        } catch (error) {
            console.error('Failed to calculate next run time:', error);
            return new Date(Date.now() + 60 * 60 * 1000); // Fallback to 1 hour
        }
    }

    /**
     * Load schedules from Redis
     */
    private async loadSchedules(): Promise<void> {
        try {
            // In a real implementation, you would load all schedules from Redis
            // For now, we'll just log that we're loading
            console.log('📥 Loading schedules from Redis...');

            // This would be implemented with a Redis scan or similar operation
            // to load all keys matching the pattern "ingestion_schedule:*"

        } catch (error) {
            console.error('❌ Failed to load schedules:', error);
        }
    }

    /**
     * Save schedule to Redis
     */
    private async saveSchedule(schedule: IngestionSchedule): Promise<void> {
        await RedisManager.cacheUserSession(`ingestion_schedule:${schedule.id}`, schedule);
    }

    /**
     * Generate unique schedule ID
     */
    private generateScheduleId(): string {
        return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get scheduler statistics
     */
    getStats(): {
        totalSchedules: number;
        activeSchedules: number;
        runningJobs: number;
        platformBreakdown: Record<Platform, number>;
    } {
        const schedules = Array.from(this.schedules.values());
        const activeSchedules = schedules.filter(s => s.enabled);
        const runningJobs = this.cronJobs.size;

        const platformBreakdown: Record<Platform, number> = {
            twitter: 0,
            reddit: 0,
            trustpilot: 0,
            appstore: 0
        };

        schedules.forEach(schedule => {
            platformBreakdown[schedule.platform]++;
        });

        return {
            totalSchedules: schedules.length,
            activeSchedules: activeSchedules.length,
            runningJobs,
            platformBreakdown
        };
    }

    /**
     * Create common schedule presets
     */
    async createPresetSchedules(): Promise<IngestionSchedule[]> {
        const presets = [
            {
                platform: 'twitter' as Platform,
                type: 'search' as const,
                query: 'customer service OR support OR help',
                enabled: true,
                cronExpression: '0 */2 * * *', // Every 2 hours
                maxResults: 100
            },
            {
                platform: 'reddit' as Platform,
                type: 'search' as const,
                query: 'customer service',
                enabled: true,
                cronExpression: '0 */4 * * *', // Every 4 hours
                maxResults: 50
            },
            {
                platform: 'trustpilot' as Platform,
                type: 'search' as const,
                query: 'review',
                enabled: true,
                cronExpression: '0 */6 * * *', // Every 6 hours
                maxResults: 25
            },
            {
                platform: 'appstore' as Platform,
                type: 'search' as const,
                query: 'app review',
                enabled: true,
                cronExpression: '0 */8 * * *', // Every 8 hours
                maxResults: 30
            }
        ];

        const createdSchedules: IngestionSchedule[] = [];

        for (const preset of presets) {
            try {
                const schedule = await this.createSchedule(preset);
                createdSchedules.push(schedule);
            } catch (error) {
                console.error(`❌ Failed to create preset schedule for ${preset.platform}:`, error);
            }
        }

        console.log(`📅 Created ${createdSchedules.length} preset schedules`);
        return createdSchedules;
    }

    /**
     * Shutdown the scheduler
     */
    async shutdown(): Promise<void> {
        console.log('🛑 Shutting down ingestion scheduler...');

        await this.stopAllSchedules();
        this.isRunning = false;

        console.log('✅ Ingestion scheduler shut down');
    }
}