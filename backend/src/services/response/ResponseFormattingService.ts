import { 
  ResponseDraft, 
  ResponseTone, 
  ResponseChannel 
} from '@/types/response';
import { Platform, FeedbackData } from '@/types/feedback';

export interface PlatformConstraints {
  maxLength: number;
  allowsHtml: boolean;
  allowsMarkdown: boolean;
  allowsEmojis: boolean;
  allowsHashtags: boolean;
  allowsMentions: boolean;
  allowsLinks: boolean;
  requiresPublicResponse: boolean;
  supportedChannels: ResponseChannel[];
}

export interface FormattingOptions {
  platform: Platform;
  channel: ResponseChannel;
  includeSignature: boolean;
  includeContactInfo: boolean;
  useEmojis: boolean;
  useFormalLanguage: boolean;
  includeHashtags: boolean;
  maxLength?: number;
}

export interface FormattedResponse {
  content: string;
  originalLength: number;
  finalLength: number;
  truncated: boolean;
  modifications: string[];
  platformOptimized: boolean;
}

export class ResponseFormattingService {
  private platformConstraints: Map<Platform, PlatformConstraints> = new Map();
  private signatures: Map<Platform, string> = new Map();
  private contactInfo: Map<Platform, string> = new Map();

  constructor() {
    this.initializePlatformConstraints();
    this.initializeSignatures();
    this.initializeContactInfo();
  }

  /**
   * Format response for specific platform and channel
   */
  formatResponse(
    response: ResponseDraft,
    options: FormattingOptions
  ): FormattedResponse {
    const constraints = this.platformConstraints.get(options.platform);
    if (!constraints) {
      throw new Error(`Unsupported platform: ${options.platform}`);
    }

    let content = response.content;
    const originalLength = content.length;
    const modifications: string[] = [];

    // Apply platform-specific formatting
    content = this.applyPlatformFormatting(content, options, constraints, modifications);

    // Apply channel-specific formatting
    content = this.applyChannelFormatting(content, options, modifications);

    // Add signature if requested
    if (options.includeSignature) {
      content = this.addSignature(content, options.platform, modifications);
    }

    // Add contact info if requested
    if (options.includeContactInfo) {
      content = this.addContactInfo(content, options.platform, modifications);
    }

    // Handle length constraints
    const maxLength = options.maxLength || constraints.maxLength;
    let truncated = false;
    
    if (content.length > maxLength) {
      content = this.truncateContent(content, maxLength, constraints);
      truncated = true;
      modifications.push(`Truncated to ${maxLength} characters`);
    }

    return {
      content,
      originalLength,
      finalLength: content.length,
      truncated,
      modifications,
      platformOptimized: true
    };
  }

  /**
   * Format multiple response variations
   */
  formatMultipleResponses(
    responses: ResponseDraft[],
    options: FormattingOptions
  ): FormattedResponse[] {
    return responses.map(response => this.formatResponse(response, options));
  }

  /**
   * Optimize response for virality (social media platforms)
   */
  optimizeForVirality(
    response: ResponseDraft,
    platform: Platform
  ): FormattedResponse {
    const options: FormattingOptions = {
      platform,
      channel: 'social_media',
      includeSignature: false,
      includeContactInfo: false,
      useEmojis: true,
      useFormalLanguage: false,
      includeHashtags: true
    };

    let content = response.content;
    const modifications: string[] = [];

    // Add engaging elements for social media
    if (platform === 'twitter') {
      content = this.optimizeForTwitter(content, modifications);
    } else if (platform === 'reddit') {
      content = this.optimizeForReddit(content, modifications);
    }

    return this.formatResponse({ ...response, content }, options);
  }

  /**
   * Apply platform-specific formatting rules
   */
  private applyPlatformFormatting(
    content: string,
    options: FormattingOptions,
    constraints: PlatformConstraints,
    modifications: string[]
  ): string {
    let formatted = content;

    switch (options.platform) {
      case 'twitter':
        formatted = this.formatForTwitter(formatted, options, modifications);
        break;
      case 'reddit':
        formatted = this.formatForReddit(formatted, options, modifications);
        break;
      case 'trustpilot':
        formatted = this.formatForTrustPilot(formatted, options, modifications);
        break;
      case 'appstore':
        formatted = this.formatForAppStore(formatted, options, modifications);
        break;
    }

    // Remove unsupported elements
    if (!constraints.allowsHtml) {
      formatted = this.stripHtml(formatted, modifications);
    }

    if (!constraints.allowsMarkdown) {
      formatted = this.stripMarkdown(formatted, modifications);
    }

    if (!constraints.allowsEmojis && !options.useEmojis) {
      formatted = this.stripEmojis(formatted, modifications);
    }

    if (!constraints.allowsLinks) {
      formatted = this.stripLinks(formatted, modifications);
    }

    return formatted;
  }

  /**
   * Apply channel-specific formatting
   */
  private applyChannelFormatting(
    content: string,
    options: FormattingOptions,
    modifications: string[]
  ): string {
    let formatted = content;

    switch (options.channel) {
      case 'email':
        formatted = this.formatForEmail(formatted, modifications);
        break;
      case 'social_media':
        formatted = this.formatForSocialMedia(formatted, options, modifications);
        break;
      case 'support_ticket':
        formatted = this.formatForSupportTicket(formatted, modifications);
        break;
      case 'public_reply':
        formatted = this.formatForPublicReply(formatted, modifications);
        break;
      case 'private_message':
        formatted = this.formatForPrivateMessage(formatted, modifications);
        break;
    }

    return formatted;
  }

  /**
   * Format for Twitter
   */
  private formatForTwitter(
    content: string,
    options: FormattingOptions,
    modifications: string[]
  ): string {
    let formatted = content;

    // Add thread indicators if content is long
    if (formatted.length > 240) {
      formatted = `${formatted} (1/2)`;
      modifications.push('Added thread indicator');
    }

    // Optimize hashtags
    if (options.includeHashtags) {
      formatted = this.addTwitterHashtags(formatted, modifications);
    }

    return formatted;
  }

  /**
   * Format for Reddit
   */
  private formatForReddit(
    content: string,
    options: FormattingOptions,
    modifications: string[]
  ): string {
    let formatted = content;

    // Add Reddit-style formatting
    if (options.useFormalLanguage) {
      formatted = `**Update from our team:**\n\n${formatted}`;
      modifications.push('Added Reddit-style header');
    }

    return formatted;
  }

  /**
   * Format for TrustPilot
   */
  private formatForTrustPilot(
    content: string,
    options: FormattingOptions,
    modifications: string[]
  ): string {
    let formatted = content;

    // TrustPilot responses should be professional and detailed
    if (!formatted.includes('Thank you')) {
      formatted = `Thank you for your review. ${formatted}`;
      modifications.push('Added professional greeting');
    }

    return formatted;
  }

  /**
   * Format for App Store
   */
  private formatForAppStore(
    content: string,
    options: FormattingOptions,
    modifications: string[]
  ): string {
    let formatted = content;

    // App Store responses should mention app updates
    if (formatted.includes('issue') || formatted.includes('problem')) {
      formatted += ' Please ensure you have the latest version of our app.';
      modifications.push('Added app update reminder');
    }

    return formatted;
  }

  /**
   * Format for email channel
   */
  private formatForEmail(content: string, modifications: string[]): string {
    let formatted = content;

    // Add email-appropriate greeting and closing
    if (!formatted.startsWith('Dear') && !formatted.startsWith('Hello')) {
      formatted = `Dear Customer,\n\n${formatted}`;
      modifications.push('Added email greeting');
    }

    if (!formatted.includes('Best regards') && !formatted.includes('Sincerely')) {
      formatted += '\n\nBest regards,\nCustomer Support Team';
      modifications.push('Added email closing');
    }

    return formatted;
  }

  /**
   * Format for social media channel
   */
  private formatForSocialMedia(
    content: string,
    options: FormattingOptions,
    modifications: string[]
  ): string {
    let formatted = content;

    // Make more casual and engaging
    if (options.useEmojis) {
      formatted = this.addAppropriateEmojis(formatted, modifications);
    }

    // Add call-to-action
    if (!formatted.includes('DM') && !formatted.includes('contact')) {
      formatted += ' Feel free to DM us for more help! 💬';
      modifications.push('Added social media CTA');
    }

    return formatted;
  }

  /**
   * Format for support ticket
   */
  private formatForSupportTicket(content: string, modifications: string[]): string {
    let formatted = content;

    // Add ticket reference format
    formatted = `**Support Response:**\n\n${formatted}\n\n---\nTicket ID: #${Date.now()}`;
    modifications.push('Added support ticket formatting');

    return formatted;
  }

  /**
   * Format for public reply
   */
  private formatForPublicReply(content: string, modifications: string[]): string {
    let formatted = content;

    // Ensure professional tone for public visibility
    formatted = this.ensureProfessionalTone(formatted, modifications);

    return formatted;
  }

  /**
   * Format for private message
   */
  private formatForPrivateMessage(content: string, modifications: string[]): string {
    let formatted = content;

    // Can be more personal and detailed
    if (!formatted.includes('personally')) {
      formatted = formatted.replace('We ', 'I personally ');
      modifications.push('Made response more personal');
    }

    return formatted;
  }

  /**
   * Optimize content for Twitter virality
   */
  private optimizeForTwitter(content: string, modifications: string[]): string {
    let optimized = content;

    // Add engaging elements
    if (!optimized.includes('!')) {
      optimized = optimized.replace('.', '!');
      modifications.push('Added excitement for engagement');
    }

    // Add relevant hashtags
    optimized = this.addTwitterHashtags(optimized, modifications);

    return optimized;
  }

  /**
   * Optimize content for Reddit
   */
  private optimizeForReddit(content: string, modifications: string[]): string {
    let optimized = content;

    // Reddit users appreciate transparency and detail
    if (optimized.length < 100) {
      optimized += ' We\'re committed to transparency and will keep you updated on our progress.';
      modifications.push('Added transparency statement for Reddit');
    }

    return optimized;
  }

  /**
   * Add appropriate Twitter hashtags
   */
  private addTwitterHashtags(content: string, modifications: string[]): string {
    const hashtags = ['#CustomerService', '#Support', '#Help'];
    const relevantHashtag = hashtags[0]; // Simplified selection

    if (!content.includes('#')) {
      const formatted = `${content} ${relevantHashtag}`;
      modifications.push('Added relevant hashtag');
      return formatted;
    }

    return content;
  }

  /**
   * Add appropriate emojis based on tone
   */
  private addAppropriateEmojis(content: string, modifications: string[]): string {
    let formatted = content;

    // Add emojis based on content sentiment
    if (content.includes('sorry') || content.includes('apologize')) {
      formatted = formatted.replace('sorry', 'sorry 😔');
      modifications.push('Added apologetic emoji');
    } else if (content.includes('thank') || content.includes('great')) {
      formatted += ' 😊';
      modifications.push('Added positive emoji');
    } else if (content.includes('help') || content.includes('support')) {
      formatted += ' 🤝';
      modifications.push('Added helpful emoji');
    }

    return formatted;
  }

  /**
   * Add signature for platform
   */
  private addSignature(content: string, platform: Platform, modifications: string[]): string {
    const signature = this.signatures.get(platform);
    if (signature) {
      modifications.push('Added platform signature');
      return `${content}\n\n${signature}`;
    }
    return content;
  }

  /**
   * Add contact information
   */
  private addContactInfo(content: string, platform: Platform, modifications: string[]): string {
    const contactInfo = this.contactInfo.get(platform);
    if (contactInfo) {
      modifications.push('Added contact information');
      return `${content}\n\n${contactInfo}`;
    }
    return content;
  }

  /**
   * Truncate content while preserving meaning
   */
  private truncateContent(
    content: string,
    maxLength: number,
    constraints: PlatformConstraints
  ): string {
    if (content.length <= maxLength) {
      return content;
    }

    // Try to truncate at sentence boundaries
    const sentences = content.split('. ');
    let truncated = '';
    
    for (const sentence of sentences) {
      const potential = truncated + (truncated ? '. ' : '') + sentence;
      if (potential.length <= maxLength - 3) { // Reserve space for "..."
        truncated = potential;
      } else {
        break;
      }
    }

    // If we couldn't fit any complete sentences, truncate at word boundary
    if (!truncated) {
      const words = content.split(' ');
      for (const word of words) {
        const potential = truncated + (truncated ? ' ' : '') + word;
        if (potential.length <= maxLength - 3) {
          truncated = potential;
        } else {
          break;
        }
      }
    }

    return truncated + '...';
  }

  /**
   * Strip HTML tags
   */
  private stripHtml(content: string, modifications: string[]): string {
    const stripped = content.replace(/<[^>]*>/g, '');
    if (stripped !== content) {
      modifications.push('Removed HTML tags');
    }
    return stripped;
  }

  /**
   * Strip Markdown formatting
   */
  private stripMarkdown(content: string, modifications: string[]): string {
    let stripped = content;
    stripped = stripped.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
    stripped = stripped.replace(/\*(.*?)\*/g, '$1'); // Italic
    stripped = stripped.replace(/`(.*?)`/g, '$1'); // Code
    stripped = stripped.replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Links
    
    if (stripped !== content) {
      modifications.push('Removed Markdown formatting');
    }
    return stripped;
  }

  /**
   * Strip emojis
   */
  private stripEmojis(content: string, modifications: string[]): string {
    const stripped = content.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '');
    if (stripped !== content) {
      modifications.push('Removed emojis');
    }
    return stripped;
  }

  /**
   * Strip links
   */
  private stripLinks(content: string, modifications: string[]): string {
    const stripped = content.replace(/https?:\/\/[^\s]+/g, '');
    if (stripped !== content) {
      modifications.push('Removed links');
    }
    return stripped;
  }

  /**
   * Ensure professional tone
   */
  private ensureProfessionalTone(content: string, modifications: string[]): string {
    let professional = content;

    // Replace casual language
    const replacements: Record<string, string> = {
      'hey': 'hello',
      'yeah': 'yes',
      'nope': 'no',
      'gonna': 'going to',
      'wanna': 'want to'
    };

    for (const [casual, formal] of Object.entries(replacements)) {
      if (professional.toLowerCase().includes(casual)) {
        professional = professional.replace(new RegExp(casual, 'gi'), formal);
        modifications.push(`Replaced "${casual}" with "${formal}"`);
      }
    }

    return professional;
  }

  /**
   * Initialize platform constraints
   */
  private initializePlatformConstraints(): void {
    this.platformConstraints.set('twitter', {
      maxLength: 280,
      allowsHtml: false,
      allowsMarkdown: false,
      allowsEmojis: true,
      allowsHashtags: true,
      allowsMentions: true,
      allowsLinks: true,
      requiresPublicResponse: true,
      supportedChannels: ['social_media', 'public_reply']
    });

    this.platformConstraints.set('reddit', {
      maxLength: 10000,
      allowsHtml: false,
      allowsMarkdown: true,
      allowsEmojis: true,
      allowsHashtags: false,
      allowsMentions: true,
      allowsLinks: true,
      requiresPublicResponse: true,
      supportedChannels: ['social_media', 'public_reply']
    });

    this.platformConstraints.set('trustpilot', {
      maxLength: 1000,
      allowsHtml: false,
      allowsMarkdown: false,
      allowsEmojis: false,
      allowsHashtags: false,
      allowsMentions: false,
      allowsLinks: true,
      requiresPublicResponse: true,
      supportedChannels: ['public_reply']
    });

    this.platformConstraints.set('appstore', {
      maxLength: 500,
      allowsHtml: false,
      allowsMarkdown: false,
      allowsEmojis: false,
      allowsHashtags: false,
      allowsMentions: false,
      allowsLinks: false,
      requiresPublicResponse: true,
      supportedChannels: ['public_reply']
    });
  }

  /**
   * Initialize platform signatures
   */
  private initializeSignatures(): void {
    this.signatures.set('twitter', '- Customer Support Team');
    this.signatures.set('reddit', '- Official Support');
    this.signatures.set('trustpilot', '- Customer Care Team');
    this.signatures.set('appstore', '- App Support Team');
  }

  /**
   * Initialize contact information
   */
  private initializeContactInfo(): void {
    this.contactInfo.set('twitter', 'DM us for immediate assistance!');
    this.contactInfo.set('reddit', 'Message us directly for personalized help.');
    this.contactInfo.set('trustpilot', 'Contact us at support@company.com');
    this.contactInfo.set('appstore', 'Visit our support page in the app for more help.');
  }

  /**
   * Get platform constraints
   */
  getPlatformConstraints(platform: Platform): PlatformConstraints | undefined {
    return this.platformConstraints.get(platform);
  }

  /**
   * Validate response for platform
   */
  validateForPlatform(content: string, platform: Platform): { valid: boolean; issues: string[] } {
    const constraints = this.platformConstraints.get(platform);
    if (!constraints) {
      return { valid: false, issues: ['Unsupported platform'] };
    }

    const issues: string[] = [];

    if (content.length > constraints.maxLength) {
      issues.push(`Content exceeds maximum length of ${constraints.maxLength} characters`);
    }

    if (!constraints.allowsHtml && /<[^>]*>/.test(content)) {
      issues.push('HTML tags not allowed on this platform');
    }

    if (!constraints.allowsEmojis && /[\u{1F600}-\u{1F64F}]/u.test(content)) {
      issues.push('Emojis not allowed on this platform');
    }

    return { valid: issues.length === 0, issues };
  }
}