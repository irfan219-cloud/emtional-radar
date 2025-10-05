import { BaseRepository, QueryOptions } from './BaseRepository';
import { ResponseData, ResponseStatus } from '@/types/response';

export class ResponseRepository extends BaseRepository<ResponseData> {
    constructor() {
        super('responses', 'id');
    }

    /**
     * Find response by feedback ID
     */
    async findByFeedbackId(feedbackId: string): Promise<ResponseData | null> {
        return await this.findOne({
            where: [{ field: 'feedback_id', operator: '=' as const, value: feedbackId }]
        });
    }

    /**
     * Find responses by status
     */
    async findByStatus(status: ResponseStatus, limit?: number): Promise<ResponseData[]> {
        const options: QueryOptions = {
            where: [{ field: 'status', operator: '=' as const, value: status }],
            orderBy: [{ field: 'created_at', direction: 'DESC' }]
        };

        const results = await this.findMany(options);

        if (limit) {
            return results.slice(0, limit);
        }

        return results;
    }

    /**
     * Get pending responses (draft status)
     */
    async getPendingResponses(limit: number = 50): Promise<ResponseData[]> {
        return await this.findByStatus('draft', limit);
    }

    /**
     * Get sent responses
     */
    async getSentResponses(limit: number = 50): Promise<ResponseData[]> {
        return await this.findByStatus('sent', limit);
    }

    /**
     * Update response status
     */
    async updateStatus(id: string, status: ResponseStatus, sentTo?: string): Promise<ResponseData | null> {
        const updateData: any = { status };

        if (status === 'sent' && sentTo) {
            updateData.sent_to = sentTo;
            updateData.sent_at = new Date();
        }

        return await this.update(id, updateData);
    }

    /**
     * Select a draft for sending
     */
    async selectDraft(id: string, selectedDraft: string): Promise<ResponseData | null> {
        return await this.update(id, {
            selected_draft: selectedDraft,
            status: 'approved' as ResponseStatus
        });
    }

    /**
     * Get response statistics
     */
    async getResponseStats(): Promise<{
        total: number;
        draft: number;
        approved: number;
        sent: number;
        failed: number;
    }> {
        const result = await this.raw(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
      FROM responses
    `);

        const row = result.rows[0];
        return {
            total: parseInt(row.total),
            draft: parseInt(row.draft),
            approved: parseInt(row.approved),
            sent: parseInt(row.sent),
            failed: parseInt(row.failed)
        };
    }

    /**
     * Get responses with feedback data
     */
    async findWithFeedback(limit: number = 50): Promise<any[]> {
        const result = await this.raw(
            `SELECT 
        r.id, r.feedback_id, r.drafts, r.selected_draft, r.sent_at,
        r.sent_to, r.status, r.created_at,
        f.platform, f.content, f.author_username
       FROM responses r
       JOIN feedback f ON r.feedback_id = f.id
       ORDER BY r.created_at DESC
       LIMIT $1`,
            [limit]
        );

        return result.rows.map((row: Record<string, any>) => ({
            ...this.mapRowToEntity(row),
            feedback: {
                platform: row.platform,
                content: row.content,
                author_username: row.author_username
            }
        }));
    }

    /**
     * Get failed responses for retry
     */
    async getFailedResponses(limit: number = 50): Promise<ResponseData[]> {
        return await this.findByStatus('failed', limit);
    }

    /**
     * Mark response as failed
     */
    async markAsFailed(id: string): Promise<ResponseData | null> {
        return await this.updateStatus(id, 'failed');
    }

    /**
     * Get responses sent in date range
     */
    async getSentInDateRange(dateFrom: Date, dateTo: Date): Promise<ResponseData[]> {
        return await this.findMany({
            where: [
                { field: 'status', operator: '=' as const, value: 'sent' },
                { field: 'sent_at', operator: '>=' as const, value: dateFrom },
                { field: 'sent_at', operator: '<=' as const, value: dateTo }
            ],
            orderBy: [{ field: 'sent_at', direction: 'DESC' }]
        });
    }

    /**
     * Map database row to ResponseData
     */
    protected mapRowToEntity(row: Record<string, any>): ResponseData {
        return {
            id: row.id,
            feedback_id: row.feedback_id,
            drafts: row.drafts || [],
            selected_draft: row.selected_draft,
            sent_at: row.sent_at,
            sent_to: row.sent_to,
            status: row.status,
            created_at: row.created_at
        };
    }

    /**
     * Find responses in date range
     */
    async findInDateRange(dateFrom: Date, dateTo: Date): Promise<ResponseData[]> {
        return await this.findMany({
            where: [
                { field: 'created_at', operator: '>=' as const, value: dateFrom },
                { field: 'created_at', operator: '<=' as const, value: dateTo }
            ],
            orderBy: [{ field: 'created_at', direction: 'DESC' }]
        });
    }
}