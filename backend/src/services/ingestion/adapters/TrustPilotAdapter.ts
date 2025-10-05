import { BasePlatformAdapter } from '../BasePlatformAdapter';
import { 
  TrustPilotConfig, 
  RawFeedbackItem, 
  SearchOptions, 
  UserFeedbackOptions 
} from '@/types/ingestion';
import { FeedbackData } from '@/types/feedback';

/**
 * TrustPilot Mock Adapter
 * 
 * This is a mock implementation that generates realistic TrustPilot review data
 * for development and testing purposes. In production, this would integrate
 * with the actual TrustPilot API.
 */
export class TrustPilotAdapter extends BasePlatformAdapter {
  private config: TrustPilotConfig;
  private mockReviews: MockTrustPilotReview[] = [];

  constructor(config: TrustPilotConfig) {
    super('trustpilot', config);
    this.config = config;
    this.generateMockData();
  }

  /**
   * Setup HTTP client (mock implementation)
   */
  protected async setupHttpClient(): Promise<void> {
    // Mock setup - no actual HTTP client needed
    console.log('🎭 TrustPilot mock adapter setup complete');
  }

  /**
   * Mock authentication
   */
  async authenticate(): Promise<boolean> {
    // Simulate authentication delay
    await this.sleep(500);
    this.isAuthenticated = true;
    console.log('✅ TrustPilot mock authentication successful');
    return true;
  }

  /**
   * Get health check endpoint (mock)
   */
  protected getHealthCheckEndpoint(): string {
    return '/mock/health';
  }

  /**
   * Search for reviews (mock implementation)
   */
  async searchFeedback(query: string, options: SearchOptions = {}): Promise<RawFeedbackItem[]> {
    console.log(`🔍 TrustPilot mock search: "${query}"`);
    
    // Simulate API delay
    await this.sleep(Math.random() * 1000 + 500);

    // Filter mock reviews based on query
    let filteredReviews = this.mockReviews.filter(review => 
      review.title.toLowerCase().includes(query.toLowerCase()) ||
      review.text.toLowerCase().includes(query.toLowerCase())
    );

    // Apply date filtering
    if (options.since) {
      filteredReviews = filteredReviews.filter(review => 
        new Date(review.created_at) >= options.since!
      );
    }

    if (options.until) {
      filteredReviews = filteredReviews.filter(review => 
        new Date(review.created_at) <= options.until!
      );
    }

    // Apply limit
    if (options.maxResults) {
      filteredReviews = filteredReviews.slice(0, options.maxResults);
    }

    // Sort results
    if (options.sortBy === 'recent') {
      filteredReviews.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (options.sortBy === 'popular') {
      filteredReviews.sort((a, b) => b.helpful_count - a.helpful_count);
    }

    return filteredReviews.map(review => this.transformMockReview(review));
  }

  /**
   * Get user reviews (mock implementation)
   */
  async getUserFeedback(userId: string, options: UserFeedbackOptions = {}): Promise<RawFeedbackItem[]> {
    console.log(`👤 TrustPilot mock user feedback: ${userId}`);
    
    // Simulate API delay
    await this.sleep(Math.random() * 800 + 300);

    // Filter reviews by user
    let userReviews = this.mockReviews.filter(review => review.consumer.id === userId);

    // Apply date filtering
    if (options.since) {
      userReviews = userReviews.filter(review => 
        new Date(review.created_at) >= options.since!
      );
    }

    if (options.until) {
      userReviews = userReviews.filter(review => 
        new Date(review.created_at) <= options.until!
      );
    }

    // Apply limit
    if (options.maxResults) {
      userReviews = userReviews.slice(0, options.maxResults);
    }

    return userReviews.map(review => this.transformMockReview(review));
  }

  /**
   * Transform mock review to RawFeedbackItem
   */
  private transformMockReview(review: MockTrustPilotReview): RawFeedbackItem {
    return {
      id: review.id,
      platform: 'trustpilot',
      content: `${review.title}\n\n${review.text}`,
      author: {
        id: review.consumer.id,
        username: review.consumer.display_name,
        displayName: review.consumer.display_name,
        followerCount: 0,
        verified: review.consumer.has_verified_email
      },
      engagement: {
        likes: review.helpful_count,
        shares: 0,
        comments: 0,
        views: 0
      },
      timestamps: {
        created: new Date(review.created_at),
        modified: review.updated_at ? new Date(review.updated_at) : undefined
      },
      metadata: {
        rating: review.stars,
        title: review.title,
        verified_purchase: review.verified,
        helpful_count: review.helpful_count,
        business_unit_id: review.business_unit.id,
        business_name: review.business_unit.display_name,
        country_code: review.consumer.country_code,
        language: review.language,
        reference_id: review.reference_id
      },
      urls: [],
      mentions: [],
      hashtags: []
    };
  }

  /**
   * Transform RawFeedbackItem to FeedbackData
   */
  transformToFeedback(rawItem: RawFeedbackItem): FeedbackData {
    return {
      id: '', // Will be generated by database
      platform: 'trustpilot',
      external_id: rawItem.id,
      content: rawItem.content,
      author: {
        username: rawItem.author.username,
        followerCount: rawItem.author.followerCount,
        verified: rawItem.author.verified
      },
      engagement: {
        likes: rawItem.engagement.likes,
        shares: rawItem.engagement.shares,
        comments: rawItem.engagement.comments
      },
      posted_at: rawItem.timestamps.created,
      ingested_at: new Date(),
      metadata: rawItem.metadata
    };
  }

  /**
   * Generate realistic mock data
   */
  private generateMockData(): void {
    const sampleReviews = [
      {
        rating: 5,
        title: "Excellent service and fast delivery!",
        text: "I've been using this service for over a year now and I'm consistently impressed with the quality and speed. The customer support team is responsive and helpful. Highly recommended!",
        sentiment: 'positive'
      },
      {
        rating: 1,
        title: "Terrible experience - avoid at all costs",
        text: "This was the worst experience I've ever had with an online service. The product didn't work as advertised, customer service was rude and unhelpful, and getting a refund was like pulling teeth. Save your money and go elsewhere.",
        sentiment: 'negative'
      },
      {
        rating: 3,
        title: "Average service, nothing special",
        text: "The service works as advertised but there's nothing that makes it stand out from competitors. Pricing is fair but I've seen better features elsewhere. It's okay if you need something basic.",
        sentiment: 'neutral'
      },
      {
        rating: 4,
        title: "Good value for money",
        text: "Overall satisfied with the purchase. There are a few minor issues but nothing deal-breaking. The price point is reasonable and the core functionality works well. Would consider buying again.",
        sentiment: 'positive'
      },
      {
        rating: 2,
        title: "Disappointed with recent changes",
        text: "Used to be a great service but recent updates have made it worse. Features that used to work smoothly now have bugs. Customer service says they're working on it but no timeline given.",
        sentiment: 'negative'
      },
      {
        rating: 5,
        title: "Outstanding customer support!",
        text: "Had an issue with my order and the support team went above and beyond to resolve it quickly. They even followed up to make sure everything was working perfectly. This is how customer service should be done!",
        sentiment: 'positive'
      },
      {
        rating: 1,
        title: "Complete waste of money",
        text: "Product stopped working after just two weeks. When I contacted support, they blamed me for 'misuse' even though I followed all instructions. No refund offered. Absolutely terrible company.",
        sentiment: 'negative'
      },
      {
        rating: 4,
        title: "Solid product with room for improvement",
        text: "The core product is good and does what it promises. Interface could be more intuitive and some features feel clunky, but overall it gets the job done. Regular updates show the team cares about improvement.",
        sentiment: 'positive'
      }
    ];

    const businessNames = ['TechCorp Solutions', 'Digital Services Inc', 'Innovation Labs', 'Customer First Co'];
    const countries = ['US', 'UK', 'CA', 'AU', 'DE', 'FR'];
    const languages = ['en', 'en-US', 'en-GB', 'en-CA'];

    for (let i = 0; i < 50; i++) {
      const sample = sampleReviews[i % sampleReviews.length];
      const createdDate = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000); // Last 90 days
      
      this.mockReviews.push({
        id: `tp_${i + 1}`,
        stars: sample.rating,
        title: sample.title,
        text: sample.text,
        language: languages[Math.floor(Math.random() * languages.length)],
        created_at: createdDate.toISOString(),
        updated_at: Math.random() > 0.8 ? new Date(createdDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() : null,
        verified: Math.random() > 0.3,
        helpful_count: Math.floor(Math.random() * 20),
        reference_id: `ref_${Math.random().toString(36).substr(2, 9)}`,
        consumer: {
          id: `user_${i + 1}`,
          display_name: `User${i + 1}`,
          country_code: countries[Math.floor(Math.random() * countries.length)],
          has_verified_email: Math.random() > 0.2
        },
        business_unit: {
          id: `bu_${Math.floor(i / 10) + 1}`,
          display_name: businessNames[Math.floor(i / 10) % businessNames.length]
        }
      });
    }

    console.log(`🎭 Generated ${this.mockReviews.length} mock TrustPilot reviews`);
  }

  /**
   * Get reviews by rating
   */
  async getReviewsByRating(rating: number, options: { limit?: number } = {}): Promise<RawFeedbackItem[]> {
    console.log(`⭐ TrustPilot mock reviews by rating: ${rating}`);
    
    await this.sleep(Math.random() * 600 + 200);

    let filteredReviews = this.mockReviews.filter(review => review.stars === rating);

    if (options.limit) {
      filteredReviews = filteredReviews.slice(0, options.limit);
    }

    return filteredReviews.map(review => this.transformMockReview(review));
  }

  /**
   * Get business unit statistics
   */
  async getBusinessStats(businessUnitId: string): Promise<{
    total_reviews: number;
    average_rating: number;
    rating_distribution: Record<number, number>;
  }> {
    console.log(`📊 TrustPilot mock business stats: ${businessUnitId}`);
    
    await this.sleep(Math.random() * 400 + 100);

    const businessReviews = this.mockReviews.filter(review => 
      review.business_unit.id === businessUnitId
    );

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;

    businessReviews.forEach(review => {
      ratingDistribution[review.stars]++;
      totalRating += review.stars;
    });

    return {
      total_reviews: businessReviews.length,
      average_rating: businessReviews.length > 0 ? totalRating / businessReviews.length : 0,
      rating_distribution: ratingDistribution
    };
  }
}

interface MockTrustPilotReview {
  id: string;
  stars: number;
  title: string;
  text: string;
  language: string;
  created_at: string;
  updated_at: string | null;
  verified: boolean;
  helpful_count: number;
  reference_id: string;
  consumer: {
    id: string;
    display_name: string;
    country_code: string;
    has_verified_email: boolean;
  };
  business_unit: {
    id: string;
    display_name: string;
  };
}