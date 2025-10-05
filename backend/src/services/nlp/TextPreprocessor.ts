import { TextPreprocessingOptions, TextQualityAssessment, LanguageDetectionResult } from '@/types/nlp';

export class TextPreprocessor {
  private static readonly DEFAULT_OPTIONS: TextPreprocessingOptions = {
    removeUrls: true,
    removeMentions: false,
    removeHashtags: false,
    removeEmojis: false,
    normalizeWhitespace: true,
    convertToLowercase: false,
    removeSpecialChars: false,
    maxLength: 5000
  };

  /**
   * Preprocess text for NLP analysis
   */
  static preprocess(text: string, options: Partial<TextPreprocessingOptions> = {}): string {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    let processedText = text;

    // Remove URLs
    if (opts.removeUrls) {
      processedText = this.removeUrls(processedText);
    }

    // Remove mentions (@username)
    if (opts.removeMentions) {
      processedText = this.removeMentions(processedText);
    }

    // Remove hashtags (#hashtag)
    if (opts.removeHashtags) {
      processedText = this.removeHashtags(processedText);
    }

    // Remove emojis
    if (opts.removeEmojis) {
      processedText = this.removeEmojis(processedText);
    }

    // Normalize whitespace
    if (opts.normalizeWhitespace) {
      processedText = this.normalizeWhitespace(processedText);
    }

    // Convert to lowercase
    if (opts.convertToLowercase) {
      processedText = processedText.toLowerCase();
    }

    // Remove special characters
    if (opts.removeSpecialChars) {
      processedText = this.removeSpecialChars(processedText);
    }

    // Truncate to max length
    if (opts.maxLength && processedText.length > opts.maxLength) {
      processedText = processedText.substring(0, opts.maxLength).trim();
    }

    return processedText.trim();
  }

  /**
   * Assess text quality for NLP analysis
   */
  static assessTextQuality(text: string): TextQualityAssessment {
    const issues: string[] = [];
    let qualityScore = 1.0;

    // Basic validation
    if (!text || typeof text !== 'string') {
      return {
        isValid: false,
        length: 0,
        wordCount: 0,
        hasEmojis: false,
        hasUrls: false,
        hasMentions: false,
        hasHashtags: false,
        qualityScore: 0,
        issues: ['Invalid or empty text']
      };
    }

    const trimmedText = text.trim();
    const length = trimmedText.length;
    const wordCount = this.countWords(trimmedText);

    // Length checks
    if (length < 3) {
      issues.push('Text too short for meaningful analysis');
      qualityScore -= 0.5;
    } else if (length < 10) {
      issues.push('Text very short, analysis may be less accurate');
      qualityScore -= 0.2;
    }

    if (length > 5000) {
      issues.push('Text very long, may be truncated');
      qualityScore -= 0.1;
    }

    // Word count checks
    if (wordCount < 2) {
      issues.push('Very few words for analysis');
      qualityScore -= 0.3;
    }

    // Content analysis
    const hasEmojis = this.hasEmojis(trimmedText);
    const hasUrls = this.hasUrls(trimmedText);
    const hasMentions = this.hasMentions(trimmedText);
    const hasHashtags = this.hasHashtags(trimmedText);

    // Check for spam-like content
    if (this.isLikelySpam(trimmedText)) {
      issues.push('Text appears to be spam or low quality');
      qualityScore -= 0.4;
    }

    // Check for repeated characters/words
    if (this.hasExcessiveRepetition(trimmedText)) {
      issues.push('Excessive repetition detected');
      qualityScore -= 0.2;
    }

    // Language detection (simplified)
    const language = this.detectLanguage(trimmedText);

    return {
      isValid: qualityScore > 0.3 && length >= 3,
      length,
      wordCount,
      hasEmojis,
      hasUrls,
      hasMentions,
      hasHashtags,
      language: language.language,
      qualityScore: Math.max(0, qualityScore),
      issues
    };
  }

  /**
   * Remove URLs from text
   */
  private static removeUrls(text: string): string {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    return text.replace(urlRegex, '').trim();
  }

  /**
   * Remove mentions (@username) from text
   */
  private static removeMentions(text: string): string {
    const mentionRegex = /@[a-zA-Z0-9_]+/g;
    return text.replace(mentionRegex, '').trim();
  }

  /**
   * Remove hashtags (#hashtag) from text
   */
  private static removeHashtags(text: string): string {
    const hashtagRegex = /#[a-zA-Z0-9_]+/g;
    return text.replace(hashtagRegex, '').trim();
  }

  /**
   * Remove emojis from text
   */
  private static removeEmojis(text: string): string {
    // Simplified emoji removal - in production, use a more comprehensive regex
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    return text.replace(emojiRegex, '').trim();
  }

  /**
   * Normalize whitespace in text
   */
  private static normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Remove special characters from text
   */
  private static removeSpecialChars(text: string): string {
    // Keep letters, numbers, spaces, and basic punctuation
    return text.replace(/[^a-zA-Z0-9\s.,!?;:'"()-]/g, '').trim();
  }

  /**
   * Count words in text
   */
  private static countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Check if text contains emojis
   */
  private static hasEmojis(text: string): boolean {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    return emojiRegex.test(text);
  }

  /**
   * Check if text contains URLs
   */
  private static hasUrls(text: string): boolean {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    return urlRegex.test(text);
  }

  /**
   * Check if text contains mentions
   */
  private static hasMentions(text: string): boolean {
    const mentionRegex = /@[a-zA-Z0-9_]+/g;
    return mentionRegex.test(text);
  }

  /**
   * Check if text contains hashtags
   */
  private static hasHashtags(text: string): boolean {
    const hashtagRegex = /#[a-zA-Z0-9_]+/g;
    return hashtagRegex.test(text);
  }

  /**
   * Detect if text is likely spam
   */
  private static isLikelySpam(text: string): boolean {
    const spamIndicators = [
      /(.)\1{4,}/g, // Repeated characters (5+ times)
      /\b(buy|sale|discount|offer|free|win|prize|click|visit)\b/gi,
      /[A-Z]{10,}/, // Excessive caps
      /\d{4,}/, // Long numbers (phone numbers, etc.)
    ];

    let spamScore = 0;
    spamIndicators.forEach(regex => {
      if (regex.test(text)) {
        spamScore++;
      }
    });

    return spamScore >= 2;
  }

  /**
   * Check for excessive repetition
   */
  private static hasExcessiveRepetition(text: string): boolean {
    const words = text.toLowerCase().split(/\s+/);
    const wordCounts = new Map<string, number>();

    words.forEach(word => {
      if (word.length > 2) { // Only count words longer than 2 characters
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    });

    // Check if any word appears more than 30% of the time
    const totalWords = words.length;
    for (const [word, count] of wordCounts) {
      if (count / totalWords > 0.3 && count > 3) {
        return true;
      }
    }

    return false;
  }

  /**
   * Simple language detection
   */
  private static detectLanguage(text: string): LanguageDetectionResult {
    // This is a very simplified language detection
    // In production, you'd use a proper language detection library
    
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'];
    
    const words = text.toLowerCase().split(/\s+/);
    const englishWordCount = words.filter(word => englishWords.includes(word)).length;
    const englishRatio = englishWordCount / words.length;

    if (englishRatio > 0.3) {
      return {
        language: 'en',
        confidence: Math.min(englishRatio * 2, 1),
        supportedForAnalysis: true
      };
    }

    return {
      language: 'unknown',
      confidence: 0.5,
      supportedForAnalysis: false
    };
  }

  /**
   * Extract key features from text for analysis
   */
  static extractFeatures(text: string): {
    length: number;
    wordCount: number;
    sentenceCount: number;
    avgWordsPerSentence: number;
    capsRatio: number;
    punctuationRatio: number;
    exclamationCount: number;
    questionCount: number;
  } {
    const length = text.length;
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = sentences.length;
    const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;

    const capsCount = (text.match(/[A-Z]/g) || []).length;
    const capsRatio = length > 0 ? capsCount / length : 0;

    const punctuationCount = (text.match(/[.,;:!?]/g) || []).length;
    const punctuationRatio = length > 0 ? punctuationCount / length : 0;

    const exclamationCount = (text.match(/!/g) || []).length;
    const questionCount = (text.match(/\?/g) || []).length;

    return {
      length,
      wordCount,
      sentenceCount,
      avgWordsPerSentence,
      capsRatio,
      punctuationRatio,
      exclamationCount,
      questionCount
    };
  }
}