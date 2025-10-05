export type AlertSeverity = 'mild' | 'risky' | 'viral-threat';
export type AlertStatus = 'active' | 'handled' | 'dismissed' | 'escalated';

export interface Alert {
  id: string;
  feedback_id: string;
  analysis_id: string;
  severity: AlertSeverity;
  risk_level: string;
  virality_score: number;
  sentiment: string;
  emotions: Array<{
    emotion: string;
    confidence: number;
  }>;
  triggers: string[];
  status: AlertStatus;
  metadata: Record<string, any>;
  notifications_sent?: boolean;
  handled_by?: string;
  handled_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface AlertFilters {
  severity?: AlertSeverity;
  status?: AlertStatus;
  platform?: string;
  riskLevel?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AlertStats {
  totalAlerts: number;
  severityBreakdown: Record<AlertSeverity, number>;
  platformBreakdown: Record<string, number>;
  responseTime: number;
  resolutionRate: number;
}

export interface AlertThresholds {
  viralityThreshold: number;
  sentimentThreshold: number;
  emotionThreshold: number;
  engagementThreshold: number;
}