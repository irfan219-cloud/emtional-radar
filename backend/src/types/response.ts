import { FeedbackData, AnalysisResult, Platform } from './feedback';

export type ResponseTone = 'professional' | 'empathetic' | 'apologetic' | 'grateful' | 'informative';

export type ResponseStatus = 'draft' | 'approved' | 'sent' | 'failed' | 'rejected';

export type ResponseChannel = 'email' | 'social_media' | 'support_ticket' | 'public_reply' | 'private_message';

export interface ResponseTemplate {
  id: string;
  name: string;
  tone: ResponseTone;
  platform?: Platform;
  template: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResponseDraft {
  content: string;
  tone: ResponseTone;
  confidence: number;
  reasoning: string[];
  metadata?: {
    model?: string;
    processingTime?: number;
    tokensUsed?: number;
    cost?: number;
    templateUsed?: string;
  };
}

export interface ResponseData {
  id: string;
  feedback_id: string;
  drafts: ResponseDraft[];
  selected_draft?: string;
  sent_at?: Date;
  sent_to?: string;
  status: ResponseStatus;
  created_at: Date;
  updated_at?: Date;
}

export interface ResponseGenerationRequest {
  feedback: FeedbackData;
  analysis?: AnalysisResult;
  tone: ResponseTone;
  channel?: ResponseChannel;
  maxLength?: number;
  variations?: number;
  companyContext?: string;
  brandGuidelines?: string;
  customInstructions?: string;
  templateId?: string;
}

export interface ResponseGenerationResult {
  responses: ResponseDraft[];
  metadata: {
    model: string;
    processingTime: number;
    tokensUsed: number;
    cost: number;
    error?: string;
  };
}

export interface ResponseConfig {
  defaultTone: ResponseTone;
  maxLength: number;
  generateVariations: boolean;
  variationCount: number;
  autoApproveThreshold: number;
  requireHumanReview: boolean;
  companyContext: string;
  brandGuidelines: string;
  platformSettings: {
    [key in Platform]: {
      maxLength: number;
      preferredTone: ResponseTone;
      autoReply: boolean;
    };
  };
}

export interface ResponseApproval {
  responseId: string;
  approvedBy: string;
  approvedAt: Date;
  modifications?: string;
  notes?: string;
}

export interface ResponseMetrics {
  totalGenerated: number;
  totalSent: number;
  approvalRate: number;
  averageConfidence: number;
  averageProcessingTime: number;
  totalCost: number;
  toneDistribution: Record<ResponseTone, number>;
  platformDistribution: Record<Platform, number>;
}

export interface ResponseFeedback {
  responseId: string;
  rating: number; // 1-5 scale
  feedback: string;
  helpful: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface ResponseAnalytics {
  responseId: string;
  sent: boolean;
  sentAt?: Date;
  channel?: ResponseChannel;
  engagement?: {
    views?: number;
    clicks?: number;
    replies?: number;
    reactions?: number;
  };
  customerSatisfaction?: {
    rating?: number;
    followUpRequired?: boolean;
    issueResolved?: boolean;
  };
}

export interface ResponseWorkflow {
  id: string;
  name: string;
  description: string;
  triggers: {
    platforms: Platform[];
    sentiments: string[];
    riskLevels: string[];
    emotions: string[];
  };
  actions: {
    generateResponse: boolean;
    tone: ResponseTone;
    requireApproval: boolean;
    autoSend: boolean;
    notifyTeam: boolean;
    escalate: boolean;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResponseQueue {
  id: string;
  feedbackId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  assignedTo?: string;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResponseBatch {
  id: string;
  name: string;
  description: string;
  feedbackIds: string[];
  tone: ResponseTone;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: {
    total: number;
    processed: number;
    successful: number;
    failed: number;
  };
  createdBy: string;
  createdAt: Date;
  completedAt?: Date;
}

// Request/Response interfaces for API
export interface CreateResponseRequest {
  feedbackId: string;
  tone: ResponseTone;
  channel?: ResponseChannel;
  customInstructions?: string;
  templateId?: string;
}

export interface UpdateResponseRequest {
  content?: string;
  tone?: ResponseTone;
  status?: ResponseStatus;
  notes?: string;
}

export interface ApproveResponseRequest {
  modifications?: string;
  notes?: string;
  autoSend?: boolean;
}

export interface SendResponseRequest {
  channel: ResponseChannel;
  scheduledAt?: Date;
  recipientEmail?: string;
  ccEmails?: string[];
}

export interface ResponseSearchFilters {
  status?: ResponseStatus[];
  tone?: ResponseTone[];
  platform?: Platform[];
  dateFrom?: Date;
  dateTo?: Date;
  assignedTo?: string;
  hasApproval?: boolean;
  minConfidence?: number;
  maxConfidence?: number;
}

export interface ResponseStats {
  totalResponses: number;
  pendingApproval: number;
  approved: number;
  sent: number;
  averageConfidence: number;
  averageProcessingTime: number;
  totalCost: number;
  successRate: number;
}