import express from 'express';

const router = express.Router();

/**
 * POST /api/simple-analysis/feedback
 * Simple feedback analysis endpoint for testing
 */
router.post('/feedback', async (req, res) => {
  try {
    const { text, platform = 'unknown' } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    // Mock analysis results
    const mockResult = {
      feedbackId: 'mock-' + Date.now(),
      analysisId: 'analysis-' + Date.now(),
      sentiment: {
        label: text.toLowerCase().includes('bad') || text.toLowerCase().includes('terrible') || text.toLowerCase().includes('awful') ? 'negative' :
               text.toLowerCase().includes('good') || text.toLowerCase().includes('great') || text.toLowerCase().includes('amazing') ? 'positive' : 'neutral',
        confidence: 0.85
      },
      emotions: [
        { emotion: 'frustration', confidence: 0.78 },
        { emotion: 'anger', confidence: 0.65 }
      ],
      virality: {
        score: Math.floor(Math.random() * 100),
        riskLevel: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
        factors: {
          toneSeverity: 0.7,
          engagementVelocity: 0.5,
          userInfluence: 0.3
        }
      },
      responses: [
        {
          content: "Thank you for your feedback. We're sorry to hear about your experience and we're working to improve.",
          tone: 'empathetic',
          confidence: 0.9
        }
      ],
      processedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: mockResult
    });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze feedback'
    });
  }
});

/**
 * GET /api/simple-analysis/alerts
 * Simple alerts endpoint
 */
router.get('/alerts', async (req, res) => {
  try {
    const mockAlerts = [
      {
        id: '1',
        feedbackId: 'fb-1',
        content: 'This app is absolutely terrible! It crashes every time I try to use it.',
        platform: 'twitter',
        sentiment: 'negative',
        emotions: [{ emotion: 'anger', confidence: 0.92 }],
        viralityScore: 85,
        riskLevel: 'viral-threat',
        severity: 'Viral Threat',
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        author: '@angry_user123'
      },
      {
        id: '2',
        feedbackId: 'fb-2',
        content: 'Customer service is non-existent. Been waiting for 3 days for a response.',
        platform: 'trustpilot',
        sentiment: 'negative',
        emotions: [{ emotion: 'frustration', confidence: 0.78 }],
        viralityScore: 62,
        riskLevel: 'high',
        severity: 'Risky',
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        author: 'disappointed_customer'
      }
    ];

    res.json({
      success: true,
      data: {
        alerts: mockAlerts,
        pagination: {
          total: mockAlerts.length,
          limit: 20,
          offset: 0,
          hasMore: false
        }
      }
    });

  } catch (error) {
    console.error('Alerts fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts'
    });
  }
});

/**
 * GET /api/simple-analysis/heatmap
 * Simple heatmap data endpoint
 */
router.get('/heatmap', async (req, res) => {
  try {
    const mockHeatmapData = [
      {
        group: 'Twitter',
        emotions: { anger: 45, sarcasm: 32, frustration: 67, betrayal: 23, confusion: 18, joy: 12 },
        totalFeedback: 1250,
        averageSentiment: -0.3,
        lastUpdated: new Date().toISOString()
      },
      {
        group: 'Reddit',
        emotions: { anger: 38, sarcasm: 56, frustration: 42, betrayal: 19, confusion: 34, joy: 28 },
        totalFeedback: 890,
        averageSentiment: -0.1,
        lastUpdated: new Date().toISOString()
      },
      {
        group: 'TrustPilot',
        emotions: { anger: 72, sarcasm: 15, frustration: 89, betrayal: 45, confusion: 23, joy: 8 },
        totalFeedback: 567,
        averageSentiment: -0.6,
        lastUpdated: new Date().toISOString()
      },
      {
        group: 'App Store',
        emotions: { anger: 29, sarcasm: 21, frustration: 51, betrayal: 16, confusion: 67, joy: 34 },
        totalFeedback: 743,
        averageSentiment: -0.2,
        lastUpdated: new Date().toISOString()
      }
    ];

    res.json({
      success: true,
      data: {
        heatmapData: mockHeatmapData,
        groupBy: req.query.groupBy || 'platform',
        filters: req.query,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Heatmap data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch heatmap data'
    });
  }
});

export default router;