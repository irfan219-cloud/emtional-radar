import {
    ResponseData,
    ResponseStatus,
    ResponseTone,
    ResponseApproval,
    ResponseFeedback,
    ResponseAnalytics,
    ResponseWorkflow,
    ResponseTemplate,
    ResponseMetrics,
    ResponseSearchFilters,
    UpdateResponseRequest,
    ApproveResponseRequest,
    SendResponseRequest
} from '@/types/response';
import { ResponseRepository } from '@/repositories/ResponseRepository';
import { FeedbackRepository } from '@/repositories/FeedbackRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { ResponsePipelineService } from './ResponsePipelineService';

export interface ResponseManagementConfig {
    approvalWorkflow: {
        requireApproval: boolean;
        autoApproveThreshold: number;
        approverRoles: string[];
        escalationRules: Array<{
            condition: string;
            action: string;
            assignTo: string;
        }>;
    };
    qualityControl: {
        enableSpellCheck: boolean;
        enableToneAnalysis: boolean;
        enableContentFiltering: boolean;
        minimumConfidence: number;
    };
    analytics: {
        trackEngagement: boolean;
        trackSatisfaction: boolean;
        enableABTesting: boolean;
    };
}

export class ResponseManagementService {
    private responseRepo: ResponseRepository;
    private feedbackRepo: FeedbackRepository;
    private userRepo: UserRepository;
    private pipelineService: ResponsePipelineService;
    private config: ResponseManagementConfig;
    private workflows: Map<string, ResponseWorkflow> = new Map();
    private templates: Map<string, ResponseTemplate> = new Map();

    constructor(
        responseRepo: ResponseRepository,
        feedbackRepo: FeedbackRepository,
        userRepo: UserRepository,
        pipelineService: ResponsePipelineService,
        config: ResponseManagementConfig
    ) {
        this.responseRepo = responseRepo;
        this.feedbackRepo = feedbackRepo;
        this.userRepo = userRepo;
        this.pipelineService = pipelineService;
        this.config = config;

        this.loadWorkflows();
        this.loadTemplates();
    }

    /**
     * Get response by ID with full details
     */
    async getResponse(responseId: string): Promise<ResponseData | null> {
        return await this.responseRepo.findById(responseId);
    }

    /**
     * Get responses for feedback
     */
    async getResponsesForFeedback(feedbackId: string): Promise<ResponseData[]> {
        const response = await this.responseRepo.findByFeedbackId(feedbackId);
        return response ? [response] : [];
    }

    /**
     * Search responses with filters
     */
    async searchResponses(
        filters: ResponseSearchFilters,
        page: number = 1,
        limit: number = 50
    ): Promise<{ responses: ResponseData[]; total: number; pages: number }> {
        // Build query conditions based on filters
        const conditions: any[] = [];

        if (filters.status && filters.status.length > 0) {
            conditions.push({ field: 'status', operator: 'IN', value: filters.status });
        }

        if (filters.dateFrom) {
            conditions.push({ field: 'created_at', operator: '>=', value: filters.dateFrom });
        }

        if (filters.dateTo) {
            conditions.push({ field: 'created_at', operator: '<=', value: filters.dateTo });
        }

        // Get paginated results
        const offset = (page - 1) * limit;
        const responses = await this.responseRepo.findMany({
            where: conditions,
            orderBy: [{ field: 'created_at', direction: 'DESC' }]
        });

        // Apply additional filters that can't be done at DB level
        let filteredResponses = responses;

        if (filters.minConfidence !== undefined || filters.maxConfidence !== undefined) {
            filteredResponses = filteredResponses.filter(response => {
                const confidence = this.getResponseConfidence(response);
                if (filters.minConfidence !== undefined && confidence < filters.minConfidence) return false;
                if (filters.maxConfidence !== undefined && confidence > filters.maxConfidence) return false;
                return true;
            });
        }

        const total = filteredResponses.length;
        const paginatedResponses = filteredResponses.slice(offset, offset + limit);

        return {
            responses: paginatedResponses,
            total,
            pages: Math.ceil(total / limit)
        };
    }

    /**
     * Update response
     */
    async updateResponse(
        responseId: string,
        updates: UpdateResponseRequest,
        updatedBy: string
    ): Promise<ResponseData | null> {
        const response = await this.responseRepo.findById(responseId);
        if (!response) {
            throw new Error(`Response not found: ${responseId}`);
        }

        // Validate updates
        if (updates.content && this.config.qualityControl.enableContentFiltering) {
            const isValid = await this.validateContent(updates.content);
            if (!isValid) {
                throw new Error('Content validation failed');
            }
        }

        // Apply updates
        const updatedResponse = await this.responseRepo.update(responseId, {
            ...updates,
            // Add audit trail
        } as any);

        // Log the update
        console.log(`📝 Response ${responseId} updated by ${updatedBy}`);

        return updatedResponse;
    }

    /**
     * Approve response
     */
    async approveResponse(
        responseId: string,
        approvalData: ApproveResponseRequest,
        approvedBy: string
    ): Promise<ResponseData | null> {
        const response = await this.responseRepo.findById(responseId);
        if (!response) {
            throw new Error(`Response not found: ${responseId}`);
        }

        // Check if user has approval permissions
        const canApprove = await this.canUserApprove(approvedBy);
        if (!canApprove) {
            throw new Error('User does not have approval permissions');
        }

        // Create approval record
        const approval: ResponseApproval = {
            responseId,
            approvedBy,
            approvedAt: new Date(),
            modifications: approvalData.modifications,
            notes: approvalData.notes
        };

        // Update response status
        const updatedResponse = await this.responseRepo.update(responseId, {
            status: 'approved',
            // Store approval data
        } as any);

        // If auto-send is enabled, queue for sending
        if (approvalData.autoSend) {
            await this.pipelineService.queueResponseSending(responseId, {
                channel: 'email', // Default channel, should be configurable
            });
        }

        console.log(`✅ Response ${responseId} approved by ${approvedBy}`);

        return updatedResponse;
    }

    /**
     * Reject response
     */
    async rejectResponse(
        responseId: string,
        reason: string,
        rejectedBy: string
    ): Promise<ResponseData | null> {
        const response = await this.responseRepo.findById(responseId);
        if (!response) {
            throw new Error(`Response not found: ${responseId}`);
        }

        const updatedResponse = await this.responseRepo.update(responseId, {
            status: 'rejected',
            // Store rejection reason
        } as any);

        // Queue for regeneration with different parameters
        await this.pipelineService.queueResponseGeneration(
            response.feedback_id,
            undefined, // Let system determine tone
            'medium'
        );

        console.log(`❌ Response ${responseId} rejected by ${rejectedBy}: ${reason}`);

        return updatedResponse;
    }

    /**
     * Send response
     */
    async sendResponse(
        responseId: string,
        sendData: SendResponseRequest,
        sentBy: string
    ): Promise<{ success: boolean; error?: string }> {
        const response = await this.responseRepo.findById(responseId);
        if (!response) {
            throw new Error(`Response not found: ${responseId}`);
        }

        if (response.status !== 'approved') {
            throw new Error('Response must be approved before sending');
        }

        try {
            // Queue for sending
            await this.pipelineService.queueResponseSending(responseId, sendData);

            console.log(`📤 Response ${responseId} queued for sending by ${sentBy}`);

            return { success: true };

        } catch (error) {
            console.error(`Failed to send response ${responseId}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Add feedback for response
     */
    async addResponseFeedback(
        responseId: string,
        feedback: Omit<ResponseFeedback, 'responseId' | 'createdAt'>
    ): Promise<void> {
        const responseFeedback: ResponseFeedback = {
            ...feedback,
            responseId,
            createdAt: new Date()
        };

        // Store feedback (would need a ResponseFeedbackRepository)
        console.log(`💬 Feedback added for response ${responseId}: ${feedback.rating}/5`);
    }

    /**
     * Get response analytics
     */
    async getResponseAnalytics(responseId: string): Promise<ResponseAnalytics | null> {
        // This would integrate with your analytics system
        // For now, return mock data
        return {
            responseId,
            sent: true,
            sentAt: new Date(),
            channel: 'email',
            engagement: {
                views: 1,
                clicks: 0,
                replies: 0,
                reactions: 0
            },
            customerSatisfaction: {
                rating: 4,
                followUpRequired: false,
                issueResolved: true
            }
        };
    }

    /**
     * Get response metrics
     */
    async getResponseMetrics(dateFrom: Date, dateTo: Date): Promise<ResponseMetrics> {
        const responses = await this.responseRepo.findInDateRange(dateFrom, dateTo);

        const metrics: ResponseMetrics = {
            totalGenerated: responses.length,
            totalSent: responses.filter((r: any) => r.status === 'sent').length,
            approvalRate: 0,
            averageConfidence: 0,
            averageProcessingTime: 0,
            totalCost: 0,
            toneDistribution: {
                professional: 0,
                empathetic: 0,
                apologetic: 0,
                grateful: 0,
                informative: 0
            },
            platformDistribution: {
                twitter: 0,
                reddit: 0,
                trustpilot: 0,
                appstore: 0
            }
        };

        // Calculate metrics
        let totalConfidence = 0;
        let approvedCount = 0;

        for (const response of responses) {
            // Count by status
            if (response.status === 'approved' || response.status === 'sent') {
                approvedCount++;
            }

            // Sum confidence scores
            const confidence = this.getResponseConfidence(response);
            totalConfidence += confidence;

            // Count by tone (would need to extract from response data)
            // This is simplified - in reality you'd store tone in the response record
        }

        metrics.approvalRate = responses.length > 0 ? approvedCount / responses.length : 0;
        metrics.averageConfidence = responses.length > 0 ? totalConfidence / responses.length : 0;

        return metrics;
    }

    /**
     * Get pending responses for review
     */
    async getPendingResponses(assignedTo?: string): Promise<ResponseData[]> {
        const conditions: any[] = [
            { field: 'status', operator: '=', value: 'draft' }
        ];

        if (assignedTo) {
            // Add condition for assigned user (would need assignment tracking)
        }

        return await this.responseRepo.findMany({
            where: conditions,
            orderBy: [{ field: 'created_at', direction: 'ASC' }] // Oldest first
        });
    }

    /**
     * Assign response to user
     */
    async assignResponse(
        responseId: string,
        assignedTo: string,
        assignedBy: string
    ): Promise<ResponseData | null> {
        const updatedResponse = await this.responseRepo.update(responseId, {
            // Add assignment fields
        } as any);

        console.log(`👤 Response ${responseId} assigned to ${assignedTo} by ${assignedBy}`);

        return updatedResponse;
    }

    /**
     * Bulk approve responses
     */
    async bulkApproveResponses(
        responseIds: string[],
        approvedBy: string
    ): Promise<{ successful: string[]; failed: Array<{ id: string; error: string }> }> {
        const successful: string[] = [];
        const failed: Array<{ id: string; error: string }> = [];

        for (const responseId of responseIds) {
            try {
                await this.approveResponse(responseId, {}, approvedBy);
                successful.push(responseId);
            } catch (error) {
                failed.push({
                    id: responseId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return { successful, failed };
    }

    /**
     * Get response confidence score
     */
    private getResponseConfidence(response: ResponseData): number {
        // Extract confidence from response drafts
        if (response.drafts && response.drafts.length > 0) {
            const bestDraft = response.drafts.reduce((best: any, current: any) =>
                current.confidence > best.confidence ? current : best
            );
            return (bestDraft as any).confidence || 0;
        }
        return 0;
    }

    /**
     * Validate content quality
     */
    private async validateContent(content: string): Promise<boolean> {
        // Basic content validation
        if (content.length < 10) return false;
        if (content.length > 2000) return false;

        // Check for inappropriate content
        const inappropriateWords = ['spam', 'scam', 'fake'];
        const hasInappropriate = inappropriateWords.some(word =>
            content.toLowerCase().includes(word)
        );

        return !hasInappropriate;
    }

    /**
     * Check if user can approve responses
     */
    private async canUserApprove(userId: string): Promise<boolean> {
        try {
            const user = await this.userRepo.findById(userId);
            if (!user) return false;

            // Check user role/permissions
            // This would integrate with your authorization system
            return true; // Simplified for now

        } catch (error) {
            return false;
        }
    }

    /**
     * Load workflows from configuration
     */
    private async loadWorkflows(): Promise<void> {
        // Load workflows from database or configuration
        // For now, we'll use default workflows
    }

    /**
     * Load templates from configuration
     */
    private async loadTemplates(): Promise<void> {
        // Load templates from database or configuration
        // For now, we'll use default templates
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<ResponseManagementConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get current configuration
     */
    getConfig(): ResponseManagementConfig {
        return { ...this.config };
    }
}