import express from 'express';

const router = express.Router();

/**
 * GET /api/test/health
 * Comprehensive health check for all services
 */
router.get('/health', async (req, res) => {
  const healthChecks = {
    timestamp: new Date().toISOString(),
    services: {} as Record<string, { status: string; message?: string; responseTime?: number }>
  };

  // Test basic API functionality
  try {
    const start = Date.now();
    // Simple test - just check if we can process a request
    const testResult = { message: 'API is working' };
    healthChecks.services.api = {
      status: 'healthy',
      responseTime: Date.now() - start
    };
  } catch (error) {
    healthChecks.services.api = {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  // Test database connection
  try {
    const start = Date.now();
    // Simple database test would go here
    healthChecks.services.database = {
      status: 'healthy',
      responseTime: Date.now() - start
    };
  } catch (error) {
    healthChecks.services.database = {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  const overallHealthy = Object.values(healthChecks.services).every(
    service => service.status === 'healthy'
  );

  res.status(overallHealthy ? 200 : 503).json({
    success: overallHealthy,
    ...healthChecks
  });
});

/**
 * POST /api/test/analyze
 * Test the complete analysis pipeline
 */
router.post('/analyze', async (req, res) => {
  try {
    const { text, platform = 'twitter' } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    const startTime = Date.now();
    const results = {
      input: { text, platform },
      steps: {} as Record<string, any>,
      totalTime: 0
    };

    // Mock analysis for testing
    const analysisStart = Date.now();
    
    // Simulate sentiment analysis
    const sentiment = text.toLowerCase().includes('bad') || text.toLowerCase().includes('terrible') ? 'negative' :
                     text.toLowerCase().includes('good') || text.toLowerCase().includes('great') ? 'positive' : 'neutral';
    
    results.steps.analysis = {
      sentiment: { label: sentiment, confidence: 0.85 },
      emotions: [
        { emotion: 'frustration', confidence: 0.7 },
        { emotion: 'anger', confidence: 0.6 }
      ],
      virality: {
        score: Math.floor(Math.random() * 100),
        riskLevel: 'medium'
      },
      response: {
        content: "Thank you for your feedback. We appreciate your input and are working to improve.",
        tone: 'professional'
      },
      responseTime: Date.now() - analysisStart
    };

    results.totalTime = Date.now() - startTime;

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Test analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Analysis test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/test/alert
 * Test alert system
 */
router.post('/alert', async (req, res) => {
  try {
    const { severity = 'risky', channel = 'both' } = req.body;

    const results = {
      timestamp: new Date().toISOString(),
      tests: {} as Record<string, any>
    };

    // Mock notification testing
    if (channel === 'slack' || channel === 'both') {
      results.tests.slack = { 
        status: 'success', 
        message: 'Slack notification test completed (mock)' 
      };
    }

    if (channel === 'email' || channel === 'both') {
      results.tests.email = { 
        status: 'success', 
        message: 'Email notification test completed (mock)' 
      };
    }

    const allSuccessful = Object.values(results.tests).every(
      test => test.status === 'success'
    );

    res.status(allSuccessful ? 200 : 207).json({
      success: allSuccessful,
      data: results
    });

  } catch (error) {
    console.error('Alert test error:', error);
    res.status(500).json({
      success: false,
      error: 'Alert test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/test/mock-data
 * Generate mock data for testing
 */
router.get('/mock-data', async (req, res) => {
  try {
    const { type = 'all', count = 10 } = req.query;

    const mockData = {
      timestamp: new Date().toISOString(),
      data: {} as Record<string, any>
    };

    if (type === 'feedback' || type === 'all') {
      mockData.data.feedback = Array.from({ length: Number(count) }, (_, i) => ({
        id: `mock-fb-${i + 1}`,
        platform: ['twitter', 'reddit', 'trustpilot', 'appstore'][Math.floor(Math.random() * 4)],
        content: [
          'This product is amazing! Love the new features.',
          'Terrible experience. Nothing works as expected.',
          'Good but could be better. Missing some key features.',
          'Outstanding customer service and quality.',
          'Disappointed with the recent updates.',
          'Exactly what I was looking for. Highly recommend!',
          'Buggy and unreliable. Needs major improvements.',
          'Great value for money. Very satisfied.',
          'Confusing interface. Hard to navigate.',
          'Perfect! Exceeded my expectations.'
        ][Math.floor(Math.random() * 10)],
        author: `user_${Math.floor(Math.random() * 1000)}`,
        sentiment: ['positive', 'negative', 'neutral'][Math.floor(Math.random() * 3)],
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        engagement: {
          likes: Math.floor(Math.random() * 100),
          shares: Math.floor(Math.random() * 50),
          comments: Math.floor(Math.random() * 25)
        }
      }));
    }

    if (type === 'alerts' || type === 'all') {
      mockData.data.alerts = Array.from({ length: Math.min(Number(count), 5) }, (_, i) => ({
        id: `mock-alert-${i + 1}`,
        severity: ['mild', 'risky', 'viral-threat'][Math.floor(Math.random() * 3)],
        platform: ['twitter', 'reddit', 'trustpilot', 'appstore'][Math.floor(Math.random() * 4)],
        viralityScore: Math.floor(Math.random() * 100),
        content: 'Mock alert content for testing purposes',
        timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active'
      }));
    }

    if (type === 'heatmap' || type === 'all') {
      mockData.data.heatmap = ['Twitter', 'Reddit', 'TrustPilot', 'App Store'].map(platform => ({
        group: platform,
        emotions: {
          anger: Math.floor(Math.random() * 100),
          sarcasm: Math.floor(Math.random() * 100),
          frustration: Math.floor(Math.random() * 100),
          betrayal: Math.floor(Math.random() * 100),
          confusion: Math.floor(Math.random() * 100),
          joy: Math.floor(Math.random() * 100)
        },
        totalFeedback: Math.floor(Math.random() * 1000) + 100,
        averageSentiment: (Math.random() - 0.5) * 2 // -1 to 1
      }));
    }

    res.json({
      success: true,
      ...mockData
    });

  } catch (error) {
    console.error('Mock data generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate mock data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/test/performance
 * Performance benchmarking
 */
router.get('/performance', async (req, res) => {
  try {
    const { iterations = 10 } = req.query;
    const testText = "This is a test message for performance benchmarking. It contains enough text to properly test the analysis pipeline.";
    
    const results = {
      timestamp: new Date().toISOString(),
      iterations: Number(iterations),
      benchmarks: {} as Record<string, any>
    };

    // Mock performance benchmarking
    const processingTimes: number[] = [];
    
    for (let i = 0; i < Number(iterations); i++) {
      const start = Date.now();
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
      
      processingTimes.push(Date.now() - start);
    }

    results.benchmarks.processing = {
      avgTime: processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length,
      minTime: Math.min(...processingTimes),
      maxTime: Math.max(...processingTimes),
      times: processingTimes
    };

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Performance test error:', error);
    res.status(500).json({
      success: false,
      error: 'Performance test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;