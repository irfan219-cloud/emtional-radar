import { BasePlatformAdapter } from '../BasePlatformAdapter';
import { 
  RedditConfig, 
  RawFeedbackItem, 
  SearchOptions, 
  UserFeedbackOptions 
} from '@/types/ingestion';
import { FeedbackData } from '@/types/feedback';
import { AxiosResponse } from 'axios';

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  created_utc: number;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  permalink: string;
  url: string;
  is_self: boolean;
  over_18: boolean;
  spoiler: boolean;
  locked: boolean;
  stickied: boolean;
  distinguished: string | null;
  link_flair_text?: string;
  author_flair_text?: string;
  gilded: number;
  total_awards_received: number;
  all_awardings?: Array<{
    name: string;
    count: number;
  }>;
}

interface RedditComment {
  id: string;
  body: string;
  author: string;
  subreddit: string;
  created_utc: number;
  score: number;
  ups: number;
  downs: number;
  permalink: string;
  parent_id: string;
  link_id: string;
  depth: number;
  is_submitter: boolean;
  distinguished: string | null;
  gilded: number;
  total_awards_received: number;
}

interface RedditListing {
  kind: string;
  data: {
    after?: string;
    before?: string;
    children: Array<{
      kind: string;
      data: RedditPost | RedditComment;
    }>;
    dist: number;
    modhash: string;
  };
}

interface RedditUser {
  name: string;
  id: string;
  created_utc: number;
  comment_karma: number;
  link_karma: number;
  total_karma: number;
  is_gold: boolean;
  is_mod: boolean;
  verified: boolean;
  has_verified_email: boolean;
  icon_img?: string;
  subreddit?: {
    subscribers: number;
  };
}

export class RedditAdapter extends BasePlatformAdapter {
  public readonly config: RedditConfig;
  private baseUrl = 'https://oauth.reddit.com';
  private authUrl = 'https://www.reddit.com/api/v1/access_token';
  private accessToken?: string;
  private tokenExpiresAt?: Date;

  constructor(config: RedditConfig) {
    super('reddit', config);
    this.config = config;
  }

  /**
   * Setup HTTP client with Reddit-specific configuration
   */
  protected async setupHttpClient(): Promise<void> {
    this.httpClient.defaults.baseURL = this.baseUrl;
    this.httpClient.defaults.headers.common['User-Agent'] = this.config.userAgent;
  }

  /**
   * Authenticate with Reddit API using OAuth2
   */
  async authenticate(): Promise<boolean> {
    try {
      // Check if we have a valid token
      if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
        this.isAuthenticated = true;
        return true;
      }

      // Get new access token
      const authData = new URLSearchParams();
      authData.append('grant_type', 'client_credentials');

      const authResponse = await this.httpClient.post(this.authUrl, authData, {
        baseURL: '', // Override baseURL for auth endpoint
        auth: {
          username: this.config.clientId,
          password: this.config.clientSecret
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.config.userAgent
        }
      });

      if (authResponse.status === 200 && authResponse.data.access_token) {
        this.accessToken = authResponse.data.access_token;
        const expiresIn = authResponse.data.expires_in || 3600;
        this.tokenExpiresAt = new Date(Date.now() + (expiresIn * 1000));

        // Set authorization header
        this.httpClient.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
        
        this.isAuthenticated = true;
        console.log('✅ Reddit authentication successful');
        return true;
      }

      throw new Error('Failed to get access token');
    } catch (error) {
      console.error('❌ Reddit authentication failed:', error);
      this.isAuthenticated = false;
      return false;
    }
  }

  /**
   * Get health check endpoint
   */
  protected getHealthCheckEndpoint(): string {
    return '/api/v1/me';
  }

  /**
   * Search for Reddit posts and comments
   */
  async searchFeedback(query: string, options: SearchOptions = {}): Promise<RawFeedbackItem[]> {
    const params = new URLSearchParams();
    params.append('q', query);
    params.append('type', 'link,sr'); // Search posts and subreddits
    params.append('sort', this.mapSortOption(options.sortBy));
    
    if (options.maxResults) {
      params.append('limit', Math.min(options.maxResults, 100).toString());
    }

    // Reddit doesn't support date filtering in search, so we'll filter after fetching
    
    try {
      const response = await this.makeRequest('GET', `/search?${params.toString()}`);
      const listing: RedditListing = response.data;
      
      const items = await this.transformRedditListing(listing);
      
      // Apply date filtering if specified
      return this.filterByDate(items, options.since, options.until);
    } catch (error) {
      console.error('❌ Reddit search failed:', error);
      throw error;
    }
  }

  /**
   * Get user's posts and comments
   */
  async getUserFeedback(username: string, options: UserFeedbackOptions = {}): Promise<RawFeedbackItem[]> {
    const params = new URLSearchParams();
    
    if (options.maxResults) {
      params.append('limit', Math.min(options.maxResults, 100).toString());
    }

    try {
      const items: RawFeedbackItem[] = [];

      // Get user's posts
      const postsResponse = await this.makeRequest('GET', `/user/${username}/submitted?${params.toString()}`);
      const postsListing: RedditListing = postsResponse.data;
      const posts = await this.transformRedditListing(postsListing);
      items.push(...posts);

      // Get user's comments if includeReplies is true
      if (options.includeReplies) {
        const commentsResponse = await this.makeRequest('GET', `/user/${username}/comments?${params.toString()}`);
        const commentsListing: RedditListing = commentsResponse.data;
        const comments = await this.transformRedditListing(commentsListing);
        items.push(...comments);
      }

      // Apply date filtering if specified
      return this.filterByDate(items, options.since, options.until);
    } catch (error) {
      console.error('❌ Reddit user feedback fetch failed:', error);
      throw error;
    }
  }

  /**
   * Get posts from a specific subreddit
   */
  async getSubredditPosts(
    subreddit: string, 
    sort: 'hot' | 'new' | 'top' | 'rising' = 'hot',
    options: { limit?: number; timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' } = {}
  ): Promise<RawFeedbackItem[]> {
    const params = new URLSearchParams();
    
    if (options.limit) {
      params.append('limit', Math.min(options.limit, 100).toString());
    }

    if (sort === 'top' && options.timeframe) {
      params.append('t', options.timeframe);
    }

    try {
      const response = await this.makeRequest('GET', `/r/${subreddit}/${sort}?${params.toString()}`);
      const listing: RedditListing = response.data;
      
      return await this.transformRedditListing(listing);
    } catch (error) {
      console.error(`❌ Reddit subreddit ${subreddit} fetch failed:`, error);
      throw error;
    }
  }

  /**
   * Get comments from a specific post
   */
  async getPostComments(subreddit: string, postId: string, options: { limit?: number; sort?: string } = {}): Promise<RawFeedbackItem[]> {
    const params = new URLSearchParams();
    
    if (options.limit) {
      params.append('limit', options.limit.toString());
    }

    if (options.sort) {
      params.append('sort', options.sort);
    }

    try {
      const response = await this.makeRequest('GET', `/r/${subreddit}/comments/${postId}?${params.toString()}`);
      
      // Reddit returns an array with post data and comments
      if (Array.isArray(response.data) && response.data.length > 1) {
        const commentsListing: RedditListing = response.data[1];
        return await this.transformRedditListing(commentsListing);
      }

      return [];
    } catch (error) {
      console.error(`❌ Reddit post comments fetch failed:`, error);
      throw error;
    }
  }

  /**
   * Transform Reddit listing to RawFeedbackItem[]
   */
  private async transformRedditListing(listing: RedditListing): Promise<RawFeedbackItem[]> {
    if (!listing.data || !listing.data.children) {
      return [];
    }

    const items: RawFeedbackItem[] = [];

    for (const child of listing.data.children) {
      try {
        if (child.kind === 't3') {
          // Post
          const post = child.data as RedditPost;
          items.push(await this.transformRedditPost(post));
        } else if (child.kind === 't1') {
          // Comment
          const comment = child.data as RedditComment;
          items.push(await this.transformRedditComment(comment));
        }
      } catch (error) {
        console.warn('⚠️ Failed to transform Reddit item:', error);
      }
    }

    return items;
  }

  /**
   * Transform Reddit post to RawFeedbackItem
   */
  private async transformRedditPost(post: RedditPost): Promise<RawFeedbackItem> {
    // Calculate engagement metrics
    const upvotes = Math.round(post.score * post.upvote_ratio);
    const downvotes = post.score - upvotes;

    return {
      id: post.id,
      platform: 'reddit',
      content: post.title + (post.selftext ? '\n\n' + post.selftext : ''),
      author: {
        id: post.author,
        username: post.author,
        followerCount: 0, // Reddit doesn't expose follower counts
        verified: false
      },
      engagement: {
        likes: upvotes,
        shares: 0, // Reddit doesn't have shares
        comments: post.num_comments,
        views: 0 // Reddit doesn't expose view counts
      },
      timestamps: {
        created: new Date(post.created_utc * 1000)
      },
      metadata: {
        subreddit: post.subreddit,
        permalink: `https://reddit.com${post.permalink}`,
        url: post.url,
        is_self: post.is_self,
        over_18: post.over_18,
        spoiler: post.spoiler,
        locked: post.locked,
        stickied: post.stickied,
        distinguished: post.distinguished,
        link_flair_text: post.link_flair_text,
        author_flair_text: post.author_flair_text,
        gilded: post.gilded,
        total_awards_received: post.total_awards_received,
        upvote_ratio: post.upvote_ratio,
        score: post.score,
        upvotes,
        downvotes
      },
      urls: post.is_self ? [] : [post.url],
      mentions: this.extractMentions(post.title + ' ' + post.selftext),
      hashtags: [] // Reddit doesn't use hashtags like Twitter
    };
  }

  /**
   * Transform Reddit comment to RawFeedbackItem
   */
  private async transformRedditComment(comment: RedditComment): Promise<RawFeedbackItem> {
    return {
      id: comment.id,
      platform: 'reddit',
      content: comment.body,
      author: {
        id: comment.author,
        username: comment.author,
        followerCount: 0,
        verified: false
      },
      engagement: {
        likes: comment.ups,
        shares: 0,
        comments: 0, // Comments don't have sub-comments in this context
        views: 0
      },
      timestamps: {
        created: new Date(comment.created_utc * 1000)
      },
      metadata: {
        subreddit: comment.subreddit,
        permalink: `https://reddit.com${comment.permalink}`,
        parent_id: comment.parent_id,
        link_id: comment.link_id,
        depth: comment.depth,
        is_submitter: comment.is_submitter,
        distinguished: comment.distinguished,
        gilded: comment.gilded,
        total_awards_received: comment.total_awards_received,
        score: comment.score,
        ups: comment.ups,
        downs: comment.downs
      },
      urls: this.extractUrls(comment.body),
      mentions: this.extractMentions(comment.body),
      hashtags: []
    };
  }

  /**
   * Transform RawFeedbackItem to FeedbackData
   */
  transformToFeedback(rawItem: RawFeedbackItem): FeedbackData {
    return {
      id: '', // Will be generated by database
      platform: 'reddit',
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
        urls: rawItem.urls,
        mentions: rawItem.mentions
      }
    };
  }

  /**
   * Map sort options to Reddit API format
   */
  private mapSortOption(sortBy?: string): string {
    switch (sortBy) {
      case 'recent':
        return 'new';
      case 'popular':
        return 'top';
      case 'relevance':
      default:
        return 'relevance';
    }
  }

  /**
   * Filter items by date range
   */
  private filterByDate(items: RawFeedbackItem[], since?: Date, until?: Date): RawFeedbackItem[] {
    if (!since && !until) {
      return items;
    }

    return items.filter(item => {
      const createdAt = item.timestamps.created;
      
      if (since && createdAt < since) {
        return false;
      }
      
      if (until && createdAt > until) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Extract URLs from text
   */
  private extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s]+/g;
    const matches = text.match(urlRegex);
    return matches || [];
  }

  /**
   * Extract mentions from text (u/username format)
   */
  private extractMentions(text: string): string[] {
    const mentionRegex = /u\/([a-zA-Z0-9_-]+)/g;
    const matches = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      matches.push(match[1]);
    }
    
    return matches;
  }

  /**
   * Update rate limit information from Reddit response headers
   */
  protected updateRateLimitInfo(response: AxiosResponse): void {
    const remaining = response.headers['x-ratelimit-remaining'];
    const reset = response.headers['x-ratelimit-reset'];

    if (remaining !== undefined) {
      this.rateLimitInfo.remaining = parseInt(remaining);
    }

    if (reset !== undefined) {
      this.rateLimitInfo.resetAt = new Date(parseInt(reset) * 1000);
    }
  }

  /**
   * Get trending subreddits
   */
  async getTrendingSubreddits(): Promise<string[]> {
    try {
      const response = await this.makeRequest('GET', '/subreddits/popular?limit=25');
      const listing: RedditListing = response.data;
      
      return listing.data.children.map(child => {
        const subreddit = child.data as any;
        return subreddit.display_name;
      });
    } catch (error) {
      console.warn('⚠️ Could not fetch trending subreddits:', error);
      return [];
    }
  }

  /**
   * Search within a specific subreddit
   */
  async searchInSubreddit(subreddit: string, query: string, options: SearchOptions = {}): Promise<RawFeedbackItem[]> {
    const params = new URLSearchParams();
    params.append('q', query);
    params.append('restrict_sr', 'true');
    params.append('sort', this.mapSortOption(options.sortBy));
    
    if (options.maxResults) {
      params.append('limit', Math.min(options.maxResults, 100).toString());
    }

    try {
      const response = await this.makeRequest('GET', `/r/${subreddit}/search?${params.toString()}`);
      const listing: RedditListing = response.data;
      
      const items = await this.transformRedditListing(listing);
      return this.filterByDate(items, options.since, options.until);
    } catch (error) {
      console.error(`❌ Reddit subreddit search failed for r/${subreddit}:`, error);
      throw error;
    }
  }
}