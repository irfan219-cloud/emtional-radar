import { Router, Request, Response } from 'express';

const router = Router();

// Mock data for demonstration
const generateMockData = () => {
  const now = new Date();
  
  return {
    stats: {
      totalFeedback: Math.floor(Math.random() * 1000) + 1000,
      sentimentScore: (Math.random() * 3 + 7).toFixed(1), // 7.0 - 10.0
      highRiskAlerts: Math.floor(Math.random() * 10),
      responseRate: Math.floor(Math.random() * 20 + 80), // 80-100%
    },
    recentActivity: [
      {
        id: 1,
        type: 'feedback',
        message: 'New feedback from Twitter',
        description: 'Negative sentiment detected',
        sentiment: 'negative',
        timestamp: new Date(now.getTime() - Math.random() * 3600000).toISOString()
      },
      {
        id: 2,
        type: 'response',
        message: 'Response sent to customer',
        description: 'Auto-generated response approved',
        sentiment: 'positive',
        timestamp: new Date(now.getTime() - Math.random() * 7200000).toISOString()
      },
      {
        id: 3,
        type: 'alert',
        message: 'High virality alert',
        description: 'Reddit post gaining traction',
        sentiment: 'high-risk',
        timestamp: new Date(now.getTime() - Math.random() * 10800000).toISOString()
      },
      {
        id: 4,
        type: 'feedback',
        message: 'Positive review on App Store',
        description: 'Customer praised new features',
        sentiment: 'positive',
        timestamp: new Date(now.getTime() - Math.random() * 14400000).toISOString()
      }
    ],
    sentimentTrend: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(now.getTime() - (6 - i) * 24 * 3600000).toISOString().split('T')[0],
      positive: Math.floor(Math.random() * 50 + 30),
      neutral: Math.floor(Math.random() * 30 + 20),
      negative: Math.floor(Math.random() * 20 + 10)
    }))
  };
};

// Get dashboard overview data
router.get('/overview', (req: Request, res: Response) => {
  try {
    const data = generateMockData();
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

// Get real-time stats (simulated)
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = generateMockData().stats;
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats'
    });
  }
});

export default router;