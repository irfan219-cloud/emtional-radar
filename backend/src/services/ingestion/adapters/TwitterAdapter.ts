import { BasePlatformAdapter } from '../BasePlatformAdapter';
import { 
  TwitterConfig, 
  RawFeedbackItem, 
  SearchOptions, 
  UserFeedbackOptions 
} from '@/types/ingestion';
import { FeedbackData } from '@/types/feedback';
import { AxiosResponse } from 'axios';

interface TwitterTweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count: number;
  };
  context_annotations?: Array<{
    domain: { id: string; name: string; description: string };
    entity: { id: string; name: string; description?: string };
  }>;
  entities?: {
    hashtags?: Array<{ start: number; end: number; tag: string }>;
    mentions?: Array<{ start: number; end: number; username: string; id: string }>;
    urls?: Array<{ start: number; end: number; url: string; expanded_url: string; display_url: string }>;
  };
  geo?: {
    place_id: string;
  };
  lang?: string;
  possibly_sensitive?: boolean;
  referenced_tweets?: Array<{
    type: 'retweeted' | 'quoted' | 'replied_to';
    id: string;
  }>;
}

interface TwitterUser {
  id: string;
  username: string;
  name: string;
  public_metrics: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
  verified: boolean;
  profile_image_url?: string;
  location?: string;
  description?: string;
  url?: string;
  created_at: string;
}

interface TwitterSearchResponse {
  data?: TwitterTweet[];
  includes?: {
    users?: TwitterUser[];
    places?: Array<{
      id: string;
      full_name: string;
      country: string;
      geo?: {
        type: string;
        coordinates: number[];
      };
    }>;
  };
  meta: {
    newest_id?: string;
    oldest_id?: string;
    result_count: number;
    next_token?: string;
  };
}

export class TwitterAdapter extends BasePlatformAdapter {
  private config: TwitterConfig;
  private baseUrl = 'https://api.twitter.com/2';

  constructor(config: TwitterConfig) {
    super('twitter', config);
    this.config = config;
  }

  /**
   * Setup HTTP client with Twitter-specific configuration
   */
  protected async setupHttpClient(): Promise<void> {
    this.httpClient.defaults.baseURL = this.baseUrl;
    
    // Set up authentication headers
    if (this.config.bearerToken) {
      this.httpClient.defaults.headers.common['Authorization'] = `Bearer ${this.config.bearerToken}`;
    }
  }

  /**
   * Authenticate with Twitter API
   */
  async authenticate(): Promise<boolean> {
    try {
      // Test authentication by making a simple API call
      const response = await this.makeRequest('GET', '/users/me');
      this.isAuthenticated = response.status === 200;
      
      if (this.isAuthenticated) {
        console.log('✅ Twitter authentication successful');
      }
      
      return this.isAuthenticated;
    } catch (error) {
      console.error('❌ Twitter authentication failed:', error);
      this.isAuthenticated = false;
      return false;
    }
  }

  /**
   * Get health check endpoint
   */
  protected getHealthCheckEndpoint(): string {
    return '/users/me';
  }

  /**
   * Search for tweets
   */
  async searchFeedback(query: string, options: SearchOptions = {}): Promise<RawFeedbackItem[]> {
    const params = new URLSearchParams();
    
    // Build search query
    params.append('query', this.buildSearchQuery(query, options));
    
    // Set result limit
    if (options.maxResults) {
      params.append('max_results', Math.min(options.maxResults, 100).toString());
    }
    
    // Set date range
    if (options.since) {
      params.append('start_time', options.since.toISOString());
    }
    
    if (options.until) {
      params.append('end_time', options.until.toISOString());
    }

    // Request additional fields
    params.append('tweet.fields', 'created_at,public_metrics,context_annotations,entities,geo,lang,possibly_sensitive,referenced_tweets');
    params.append('user.fields', 'username,name,public_metrics,verified,profile_image_url,location,description');
    params.append('expansions', 'author_id,geo.place_id');

    try {
      const response = await this.makeRequest('GET', `/tweets/search/recent?${params.toString()}`);
      const searchResponse: TwitterSearchResponse = response.data;
      
      return this.transformTwitterResponse(searchResponse);
    } catch (error) {
      console.error('❌ Twitter search failed:', error);
      throw error;
    }
  }

  /**
   * Get user timeline tweets
   */
  async getUserFeedback(userId: string, options: UserFeedbackOptions = {}): Promise<RawFeedbackItem[]> {
    const params = new URLSearchParams();
    
    // Set result limit
    if (options.maxResults) {
      params.append('max_results', Math.min(options.maxResults, 100).toString());
    }
    
    // Set date range
    if (options.since) {
      params.append('start_time', options.since.toISOString());
    }
    
    if (options.until) {
      params.append('end_time', options.until.toISOString());
    }

    // Exclude replies and retweets if specified
    const excludes: string[] = [];
    if (!options.includeReplies) {
      excludes.push('replies');
    }
    if (!options.includeRetweets) {
      excludes.push('retweets');
    }
    if (excludes.length > 0) {
      params.append('exclude', excludes.join(','));
    }

    // Request additional fields
    params.append('tweet.fields', 'created_at,public_metrics,context_annotations,entities,geo,lang,possibly_sensitive,referenced_tweets');
    params.append('user.fields', 'username,name,public_metrics,verified,profile_image_url,location,description');
    params.append('expansions', 'author_id,geo.place_id');

    try {
      const response = await this.makeRequest('GET', `/users/${userId}/tweets?${params.toString()}`);
      const searchResponse: TwitterSearchResponse = response.data;
      
      return this.transformTwitterResponse(searchResponse);
    } catch (error) {
      console.error('❌ Twitter user timeline fetch failed:', error);
      throw error;
    }
  }

  /**
   * Transform Twitter API response to RawFeedbackItem[]
   */
  private transformTwitterResponse(response: TwitterSearchResponse): RawFeedbackItem[] {
    if (!response.data || response.data.length === 0) {
      return [];
    }

    // Create user lookup map
    const userMap = new Map<string, TwitterUser>();
    if (response.includes?.users) {
      response.includes.users.forEach(user => {
        userMap.set(user.id, user);
      });
    }

    // Create place lookup map
    const placeMap = new Map<string, any>();
    if (response.includes?.places) {
      response.includes.places.forEach(place => {
        placeMap.set(place.id, place);
      });
    }

    return response.data.map(tweet => this.transformTweet(tweet, userMap, placeMap));
  }

  /**
   * Transform single tweet to RawFeedbackItem
   */
  private transformTweet(
    tweet: TwitterTweet, 
    userMap: Map<string, TwitterUser>,
    placeMap: Map<string, any>
  ): RawFeedbackItem {
    const user = userMap.get(tweet.author_id);
    const place = tweet.geo?.place_id ? placeMap.get(tweet.geo.place_id) : null;

    return {
      id: tweet.id,
      platform: 'twitter',
      content: tweet.text,
      author: {
        id: tweet.author_id,
        username: user?.username || 'unknown',
        displayName: user?.name,
        followerCount: user?.public_metrics?.followers_count,
        verified: user?.verified || false,
        profileUrl: user ? `https://twitter.com/${user.username}` : undefined,
        avatarUrl: user?.profile_image_url
      },
      engagement: {
        likes: tweet.public_metrics?.like_count || 0,
        shares: tweet.public_metrics?.retweet_count || 0,
        comments: tweet.public_metrics?.reply_count || 0,
        views: 0 // Twitter API v2 doesn't provide view count in basic tier
      },
      timestamps: {
        created: new Date(tweet.created_at)
      },
      metadata: {
        language: tweet.lang,
        possibly_sensitive: tweet.possibly_sensitive,
        context_annotations: tweet.context_annotations,
        referenced_tweets: tweet.referenced_tweets,
        quote_count: tweet.public_metrics?.quote_count || 0
      },
      urls: tweet.entities?.urls?.map(url => url.expanded_url) || [],
      mentions: tweet.entities?.mentions?.map(mention => mention.username) || [],
      hashtags: tweet.entities?.hashtags?.map(hashtag => hashtag.tag) || [],
      location: place ? {
        name: place.full_name,
        coordinates: place.geo?.coordinates
      } : undefined
    };
  }

  /**
   * Transform RawFeedbackItem to FeedbackData
   */
  transformToFeedback(rawItem: RawFeedbackItem): FeedbackData {
    return {
      id: '', // Will be generated by database
      platform: 'twitter',
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
      metadata: {
        ...rawItem.metadata,
        hashtags: rawItem.hashtags,
        mentions: rawItem.mentions,
        urls: rawItem.urls,
        location: rawItem.location?.name,
        author_display_name: rawItem.author.displayName,
        author_profile_url: rawItem.author.profileUrl,
        author_avatar_url: rawItem.author.avatarUrl
      }
    };
  }

  /**
   * Build search query with filters
   */
  private buildSearchQuery(query: string, options: SearchOptions): string {
    let searchQuery = query;

    // Add language filter
    if (options.language) {
      searchQuery += ` lang:${options.language}`;
    }

    // Exclude retweets if specified
    if (!options.includeRetweets) {
      searchQuery += ' -is:retweet';
    }

    // Exclude replies if specified
    if (!options.includeReplies) {
      searchQuery += ' -is:reply';
    }

    return searchQuery;
  }

  /**
   * Update rate limit information from Twitter response headers
   */
  protected updateRateLimitInfo(response: AxiosResponse): void {
    const remaining = response.headers['x-rate-limit-remaining'];
    const reset = response.headers['x-rate-limit-reset'];

    if (remaining !== undefined) {
      this.rateLimitInfo.remaining = parseInt(remaining);
    }

    if (reset !== undefined) {
      this.rateLimitInfo.resetAt = new Date(parseInt(reset) * 1000);
    }
  }

  /**
   * Get mentions of a specific user
   */
  async getMentions(userId: string, options: SearchOptions = {}): Promise<RawFeedbackItem[]> {
    // Get user info first to get username
    const userResponse = await this.makeRequest('GET', `/users/${userId}`);
    const username = userResponse.data.data.username;

    // Search for mentions
    return await this.searchFeedback(`@${username}`, options);
  }

  /**
   * Get tweets by hashtag
   */
  async getTweetsByHashtag(hashtag: string, options: SearchOptions = {}): Promise<RawFeedbackItem[]> {
    const query = hashtag.startsWith('#') ? hashtag : `#${hashtag}`;
    return await this.searchFeedback(query, options);
  }

  /**
   * Get trending topics (requires elevated access)
   */
  async getTrendingTopics(woeid: number = 1): Promise<string[]> {
    try {
      // Note: This endpoint requires Twitter API v1.1 and elevated access
      const response = await this.httpClient.get(`https://api.twitter.com/1.1/trends/place.json?id=${woeid}`);
      
      if (response.data && response.data[0] && response.data[0].trends) {
        return response.data[0].trends.map((trend: any) => trend.name);
      }
      
      return [];
    } catch (error) {
      console.warn('⚠️ Could not fetch trending topics (requires elevated access):', error);
      return [];
    }
  }
}