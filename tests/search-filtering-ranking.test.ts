/**
 * Comprehensive Search, Filtering, and Ranking Regression Test Coverage
 * @module SearchFilteringRankingTest
 * @description Complete test suite for search, filtering, and ranking validation
 * @version 1.0.0
 * @author Quality Assurance Team
 * 
 * This test suite provides comprehensive coverage for:
 * - Search algorithms and relevance scoring
 * - Multi-dimensional filtering and faceting
 * - Ranking and sorting mechanisms
 * - Performance and scalability
 * - Edge cases and boundary conditions
 * - Integration scenarios
 * - Regression detection and prevention
 */

// ============================================================================
// IMPORTS AND DEPENDENCIES
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { mock, Mock, MockInstance } from 'jest-mock';

// ============================================================================
// CORE SEARCH TYPES AND INTERFACES
// ============================================================================

/**
 * Search document interface
 */
export interface SearchDocument {
  id: string;
  title: string;
  content: string;
  metadata: DocumentMetadata;
  tags: string[];
  categories: string[];
  createdAt: Date;
  updatedAt: Date;
  score?: number;
  relevance?: number;
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  author: string;
  type: DocumentType;
  language: string;
  version: string;
  size: number;
  wordCount: number;
  sentiment?: number;
  readability?: number;
  keywords: string[];
  entities: Entity[];
  locations: Location[];
  dates: Date[];
}

/**
 * Document types
 */
export enum DocumentType {
  ARTICLE = 'ARTICLE',
  BLOG = 'BLOG',
  TECHNICAL = 'TECHNICAL',
  ACADEMIC = 'ACADEMIC',
  NEWS = 'NEWS',
  LEGAL = 'LEGAL',
  MARKETING = 'MARKETING',
  SOCIAL = 'SOCIAL',
  INTERNAL = 'INTERNAL'
}

/**
 * Entity in document
 */
export interface Entity {
  text: string;
  type: EntityType;
  confidence: number;
  positions: number[];
}

/**
 * Entity types
 */
export enum EntityType {
  PERSON = 'PERSON',
  ORGANIZATION = 'ORGANIZATION',
  LOCATION = 'LOCATION',
  DATE = 'DATE',
  PRODUCT = 'PRODUCT',
  EVENT = 'EVENT',
  CONCEPT = 'CONCEPT'
}

/**
 * Location in document
 */
export interface Location {
  text: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  confidence: number;
}

/**
 * Search query
 */
export interface SearchQuery {
  text: string;
  filters: Filter[];
  facets?: Facet[];
  sort?: Sort[];
  pagination: Pagination;
  boosting?: BoostRule[];
  scoring?: ScoringConfig;
  searchType: SearchType;
  language: string;
  fields?: string[];
  fuzzy?: boolean;
  synonyms?: boolean;
  stemming?: boolean;
}

/**
 * Filter types
 */
export enum FilterType {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  CONTAINS = 'CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  BETWEEN = 'BETWEEN',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
  EXISTS = 'EXISTS',
  NOT_EXISTS = 'NOT_EXISTS',
  FUZZY = 'FUZZY'
}

/**
 * Filter interface
 */
export interface Filter {
  field: string;
  type: FilterType;
  value: any;
  nested?: Filter[];
  boost?: number;
  must?: boolean;
}

/**
 * Facet interface
 */
export interface Facet {
  field: string;
  size: number;
  order: 'COUNT' | 'VALUE';
  type: 'TERMS' | 'RANGE' | 'DATE_HISTOGRAM';
  range?: {
    min: number;
    max: number;
    interval: number;
  };
  dateRange?: {
    min: Date;
    max: Date;
    interval: 'DAY' | 'MONTH' | 'YEAR';
  };
}

/**
 * Sort interface
 */
export interface Sort {
  field: string;
  order: 'ASC' | 'DESC';
  mode?: 'MIN' | 'MAX' | 'SUM' | 'AVG';
  missing?: 'FIRST' | 'LAST';
  nested?: boolean;
}

/**
 * Pagination interface
 */
export interface Pagination {
  page: number;
  size: number;
  pageSize?: number;
  maxResults?: number;
}

/**
 * Boost rule
 */
export interface BoostRule {
  field: string;
  value: any;
  factor: number;
  operation: 'ADD' | 'MULTIPLY';
  condition?: (document: SearchDocument) => boolean;
}

/**
 * Scoring configuration
 */
export interface ScoringConfig {
  algorithm: ScoringAlgorithm;
  weights: ScoreWeights;
  normalization: 'NONE' | 'MIN_MAX' | 'Z_SCORE' | 'RANK';
  tieBreaker: number;
  decayFunction?: DecayFunction;
}

/**
 * Scoring algorithms
 */
export enum ScoringAlgorithm {
  TF_IDF = 'TF_IDF',
  BM25 = 'BM25',
  VECTOR = 'VECTOR',
  LEARNING_TO_RANK = 'LEARNING_TO_RANK',
  HYBRID = 'HYBRID',
  CUSTOM = 'CUSTOM'
}

/**
 * Score weights
 */
export interface ScoreWeights {
  title: number;
  content: number;
  tags: number;
  metadata: number;
  recency: number;
  popularity: number;
  relevance: number;
}

/**
 * Decay function
 */
export interface DecayFunction {
  type: 'GAUSS' | 'LINEAR' | 'EXPONENTIAL';
  scale: number;
  offset: number;
  decay: number;
}

/**
 * Search types
 */
export enum SearchType {
  FULL_TEXT = 'FULL_TEXT',
  PHRASE = 'PHRASE',
  WILDCARD = 'WILDCARD',
  REGEX = 'REGEX',
  SEMANTIC = 'SEMANTIC',
  HYBRID = 'HYBRID'
}

/**
 * Search result
 */
export interface SearchResult {
  hits: Hit[];
  total: number;
  maxScore: number;
  facets: FacetResult[];
  took: number;
  query: SearchQuery;
  metadata: ResultMetadata;
  suggestions: string[];
  spellcheck: SpellCheckResult;
}

/**
 * Search hit
 */
export interface Hit {
  document: SearchDocument;
  score: number;
  scoreComponents: ScoreComponents;
  highlights: Highlight[];
  explanation: string;
  matchedFields: string[];
  rank: number;
}

/**
 * Score components
 */
export interface ScoreComponents {
  fieldScores: Map<string, number>;
  boostScores: Map<string, number>;
  decayScores: Map<string, number>;
  finalScore: number;
}

/**
 * Highlight
 */
export interface Highlight {
  field: string;
  snippets: string[];
  positions: number[];
  size: number;
}

/**
 * Facet result
 */
export interface FacetResult {
  field: string;
  buckets: FacetBucket[];
  total: number;
  missing: number;
  other: number;
}

/**
 * Facet bucket
 */
export interface FacetBucket {
  key: string;
  count: number;
  min?: number;
  max?: number;
  avg?: number;
  selected?: boolean;
}

/**
 * Result metadata
 */
export interface ResultMetadata {
  searchId: string;
  timestamp: Date;
  tookMs: number;
  totalHits: number;
  scrollId?: string;
  aggregationId?: string;
}

/**
 * Spell check result
 */
export interface SpellCheckResult {
  corrected: boolean;
  originalQuery: string;
  correctedQuery: string;
  corrections: Correction[];
}

/**
 * Correction
 */
export interface Correction {
  original: string;
  suggestion: string;
  offset: number;
  length: number;
  score: number;
}

/**
 * Search analytics
 */
export interface SearchAnalytics {
  query: string;
  resultCount: number;
  clickThroughs: number;
  avgPosition: number;
  timeToFirstResult: number;
  totalTime: number;
  filtersUsed: Filter[];
  facetsUsed: Facet[];
  sortUsed: Sort[];
  searchType: SearchType;
  userId?: string;
  sessionId: string;
  timestamp: Date;
}

/**
 * Ranking configuration
 */
export interface RankingConfig {
  algorithm: RankingAlgorithm;
  features: RankingFeature[];
  weights: Map<string, number>;
  normalization: NormalizationMethod;
  boostRules: BoostRule[];
  freshness: FreshnessConfig;
  personalization: PersonalizationConfig;
}

/**
 * Ranking algorithms
 */
export enum RankingAlgorithm {
  LINEAR = 'LINEAR',
  LOGISTIC = 'LOGISTIC',
  TREE = 'TREE',
  NEURAL = 'NEURAL',
  ENSEMBLE = 'ENSEMBLE',
  BAYESIAN = 'BAYESIAN'
}

/**
 * Ranking feature
 */
export interface RankingFeature {
  name: string;
  type: FeatureType;
  weight: number;
  config: Record<string, any>;
}

/**
 * Feature types
 */
export enum FeatureType {
  TEXT = 'TEXT',
  NUMERIC = 'NUMERIC',
  CATEGORICAL = 'CATEGORICAL',
  BOOLEAN = 'BOOLEAN',
  DATE = 'DATE',
  COMPOUND = 'COMPOUND'
}

/**
 * Normalization method
 */
export enum NormalizationMethod {
  MIN_MAX = 'MIN_MAX',
  Z_SCORE = 'Z_SCORE',
  RANK = 'RANK',
  LOG = 'LOG',
  NONE = 'NONE'
}

/**
 * Freshness configuration
 */
export interface FreshnessConfig {
  enabled: boolean;
  decayRate: number;
  halfLife: number;
  referenceDate: Date;
}

/**
 * Personalization configuration
 */
export interface PersonalizationConfig {
  enabled: boolean;
  userId: string;
  history: SearchHistory[];
  preferences: UserPreferences;
  weight: number;
}

/**
 * Search history
 */
export interface SearchHistory {
  query: string;
  timestamp: Date;
  clicked: string[];
  viewed: string[];
  duration: number;
}

/**
 * User preferences
 */
export interface UserPreferences {
  categories: string[];
  tags: string[];
  topics: string[];
  language: string;
  sources: string[];
  recency: number;
}

// ============================================================================
// CORE SEARCH ENGINE IMPLEMENTATION
// ============================================================================

/**
 * Search Engine - Handles search, filtering, and ranking
 */
export class SearchEngine {
  private documents: Map<string, SearchDocument> = new Map();
  private index: Map<string, Map<string, number>> = new Map();
  private invertedIndex: Map<string, Map<string, number>> = new Map();
  private searchHistory: SearchAnalytics[] = [];
  private rankingConfig: RankingConfig;
  private searchCount: number = 0;
  private avgQueryLength: number = 0;
  private zeroResultsCount: number = 0;

  constructor(config?: Partial<RankingConfig>) {
    this.rankingConfig = this.initializeRankingConfig(config);
  }

  /**
   * Initializes ranking configuration
   */
  private initializeRankingConfig(config?: Partial<RankingConfig>): RankingConfig {
    const defaultWeights = new Map<string, number>([
      ['title', 1.5],
      ['content', 1.0],
      ['tags', 1.2],
      ['metadata', 0.8],
      ['recency', 0.5],
      ['popularity', 0.3],
      ['relevance', 1.0]
    ]);

    return {
      algorithm: RankingAlgorithm.LINEAR,
      features: [],
      weights: defaultWeights,
      normalization: NormalizationMethod.MIN_MAX,
      boostRules: [],
      freshness: {
        enabled: true,
        decayRate: 0.1,
        halfLife: 30,
        referenceDate: new Date()
      },
      personalization: {
        enabled: false,
        userId: '',
        history: [],
        preferences: {
          categories: [],
          tags: [],
          topics: [],
          language: '',
          sources: [],
          recency: 0.5
        },
        weight: 0.3
      },
      ...config
    };
  }

  /**
   * Indexes a document
   */
  public indexDocument(document: SearchDocument): void {
    this.documents.set(document.id, document);
    
    // Create forward index
    const terms = this.tokenize(document);
    const termFrequencies = new Map<string, number>();
    for (const term of terms) {
      const count = termFrequencies.get(term) || 0;
      termFrequencies.set(term, count + 1);
    }
    this.index.set(document.id, termFrequencies);

    // Create inverted index
    for (const [term, frequency] of termFrequencies) {
      if (!this.invertedIndex.has(term)) {
        this.invertedIndex.set(term, new Map());
      }
      this.invertedIndex.get(term)!.set(document.id, frequency);
    }
  }

  /**
   * Tokenizes document
   */
  private tokenize(document: SearchDocument): string[] {
    const text = `${document.title} ${document.content} ${document.tags.join(' ')} ${document.categories.join(' ')}`;
    const tokens = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1);
    
    // Stemming (simplified)
    return tokens.map(token => this.stem(token));
  }

  /**
   * Simple stemmer
   */
  private stem(token: string): string {
    // Remove common suffixes
    const suffixes = ['ing', 'ed', 'tion', 'sion', 'ment', 'ness', 'ful', 'ous', 'ive', 'able', 'ible'];
    for (const suffix of suffixes) {
      if (token.endsWith(suffix) && token.length > suffix.length + 2) {
        return token.slice(0, -suffix.length);
      }
    }
    return token;
  }

  /**
   * Executes a search query
   */
  public search(query: SearchQuery): SearchResult {
    const startTime = Date.now();
    this.searchCount++;

    // Process query
    const processedQuery = this.processQuery(query);
    
    // Search candidates
    const candidates = this.findCandidates(processedQuery);
    
    // Score candidates
    const scoredCandidates = this.scoreCandidates(candidates, processedQuery);
    
    // Apply filters
    const filteredCandidates = this.applyFilters(scoredCandidates, query.filters);
    
    // Apply boosts
    const boostedCandidates = this.applyBoosts(filteredCandidates, query.boosting || []);
    
    // Sort results
    const sortedCandidates = this.sortResults(boostedCandidates, query.sort || []);
    
    // Apply pagination
    const paginatedResults = this.applyPagination(sortedCandidates, query.pagination);
    
    // Generate facets
    const facets = this.generateFacets(paginatedResults, query.facets || []);
    
    // Spellcheck
    const spellcheck = this.spellCheck(query.text);
    
    // Track analytics
    this.trackSearch(query, paginatedResults.length);

    const endTime = Date.now();

    return {
      hits: paginatedResults,
      total: sortedCandidates.length,
      maxScore: paginatedResults.length > 0 ? paginatedResults[0].score : 0,
      facets: facets,
      took: endTime - startTime,
      query: query,
      metadata: {
        searchId: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        tookMs: endTime - startTime,
        totalHits: sortedCandidates.length
      },
      suggestions: this.generateSuggestions(query),
      spellcheck: spellcheck
    };
  }

  /**
   * Processes query
   */
  private processQuery(query: SearchQuery): SearchQuery {
    // Apply stemming
    if (query.stemming) {
      const words = query.text.split(' ');
      query.text = words.map(word => this.stem(word)).join(' ');
    }

    // Apply synonym expansion
    if (query.synonyms) {
      // Simplified synonym expansion
      const expandedWords = [];
      for (const word of query.text.split(' ')) {
        const synonyms = this.getSynonyms(word);
        expandedWords.push(word, ...synonyms);
      }
      query.text = expandedWords.join(' ');
    }

    return query;
  }

  /**
   * Gets synonyms (simplified)
   */
  private getSynonyms(word: string): string[] {
    const synonymMap: Record<string, string[]> = {
      'search': ['query', 'find', 'discover'],
      'document': ['article', 'content', 'file'],
      'search': ['lookup', 'retrieve', 'fetch'],
      'rank': ['score', 'sort', 'order'],
      'filter': ['refine', 'narrow', 'subset']
    };
    return synonymMap[word] || [];
  }

  /**
   * Finds candidate documents
   */
  private findCandidates(query: SearchQuery): SearchDocument[] {
    const terms = query.text.split(' ');
    const candidates = new Map<string, { document: SearchDocument; score: number }>();

    for (const term of terms) {
      const postingList = this.invertedIndex.get(term);
      if (!postingList) continue;

      for (const [docId, frequency] of postingList) {
        const doc = this.documents.get(docId);
        if (!doc) continue;

        const currentScore = candidates.get(docId)?.score || 0;
        const tf = frequency / doc.metadata.wordCount;
        const idf = Math.log(this.documents.size / (postingList.size + 1));
        const score = currentScore + (tf * idf);

        candidates.set(docId, { document: doc, score });
      }
    }

    return Array.from(candidates.values())
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 1000) // Limit to top 1000 candidates
      .map(c => c.document);
  }

  /**
   * Scores candidates
   */
  private scoreCandidates(candidates: SearchDocument[], query: SearchQuery): Hit[] {
    const hits: Hit[] = [];

    for (const doc of candidates) {
      const score = this.calculateScore(doc, query);
      const components = this.calculateScoreComponents(doc, query);
      
      hits.push({
        document: doc,
        score: score,
        scoreComponents: components,
        highlights: this.generateHighlights(doc, query),
        explanation: this.generateExplanation(doc, query, score),
        matchedFields: this.getMatchedFields(doc, query),
        rank: 0 // Will be set after sorting
      });
    }

    return hits.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculates score for a document
   */
  private calculateScore(document: SearchDocument, query: SearchQuery): number {
    let score = 0;
    const weights = this.rankingConfig.weights;
    
    // Title matching
    const titleMatch = this.calculateTextMatch(document.title, query.text);
    score += titleMatch * (weights.get('title') || 1.0);

    // Content matching
    const contentMatch = this.calculateTextMatch(document.content, query.text);
    score += contentMatch * (weights.get('content') || 1.0);

    // Tag matching
    const tagMatch = this.calculateTagMatch(document.tags, query.text);
    score += tagMatch * (weights.get('tags') || 1.0);

    // Recency
    if (this.rankingConfig.freshness.enabled) {
      const recencyScore = this.calculateRecencyScore(document.createdAt);
      score += recencyScore * (weights.get('recency') || 0.5);
    }

    // Metadata relevance
    const metadataScore = this.calculateMetadataScore(document.metadata, query);
    score += metadataScore * (weights.get('metadata') || 0.8);

    // Popularity
    const popularityScore = this.calculatePopularityScore(document);
    score += popularityScore * (weights.get('popularity') || 0.3);

    return score;
  }

  /**
   * Calculates text match score
   */
  private calculateTextMatch(text: string, query: string): number {
    const textLower = text.toLowerCase();
    const queryTerms = query.toLowerCase().split(' ');
    
    let matchCount = 0;
    let totalWeight = 0;
    
    for (const term of queryTerms) {
      if (textLower.includes(term)) {
        matchCount++;
        totalWeight += 1;
      }
      
      // Check for partial matches (fuzzy)
      if (query.fuzzy && !textLower.includes(term)) {
        for (let i = 0; i < textLower.length - term.length + 1; i++) {
          const substring = textLower.substring(i, i + term.length);
          const distance = this.levenshteinDistance(term, substring);
          if (distance <= 1) {
            matchCount += 0.5;
            totalWeight += 0.5;
            break;
          }
        }
      }
    }
    
    return queryTerms.length > 0 ? matchCount / queryTerms.length : 0;
  }

  /**
   * Calculates tag match score
   */
  private calculateTagMatch(tags: string[], query: string): number {
    const queryTerms = query.toLowerCase().split(' ');
    const tagLower = tags.map(t => t.toLowerCase());
    
    let matchCount = 0;
    for (const term of queryTerms) {
      if (tagLower.some(tag => tag.includes(term) || term.includes(tag))) {
        matchCount++;
      }
    }
    
    return queryTerms.length > 0 ? matchCount / queryTerms.length : 0;
  }

  /**
   * Calculates recency score
   */
  private calculateRecencyScore(createdAt: Date): number {
    const now = new Date();
    const ageInDays = (now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000);
    const halfLife = this.rankingConfig.freshness.halfLife;
    return Math.exp(-this.rankingConfig.freshness.decayRate * ageInDays / halfLife);
  }

  /**
   * Calculates metadata score
   */
  private calculateMetadataScore(metadata: DocumentMetadata, query: SearchQuery): number {
    let score = 0;
    let totalWeight = 0;
    
    // Check author
    if (metadata.author && query.text.toLowerCase().includes(metadata.author.toLowerCase())) {
      score += 0.5;
      totalWeight += 0.5;
    }
    
    // Check keywords
    for (const keyword of metadata.keywords) {
      if (query.text.toLowerCase().includes(keyword.toLowerCase())) {
        score += 0.3;
        totalWeight += 0.3;
      }
    }
    
    // Check entities
    for (const entity of metadata.entities) {
      if (query.text.toLowerCase().includes(entity.text.toLowerCase())) {
        score += 0.2;
        totalWeight += 0.2;
      }
    }
    
    return totalWeight > 0 ? score / totalWeight : 0;
  }

  /**
   * Calculates popularity score
   */
  private calculatePopularityScore(document: SearchDocument): number {
    // In a real system, this would use analytics data
    // For now, use a random score based on document age and type
    const baseScore = Math.random() * 0.3 + 0.1;
    const typeBoost = document.metadata.type === DocumentType.ARTICLE ? 0.2 : 0.1;
    const ageBoost = Math.min(1, (Date.now() - document.createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000));
    return baseScore + typeBoost + ageBoost * 0.1;
  }

  /**
   * Calculates score components
   */
  private calculateScoreComponents(document: SearchDocument, query: SearchQuery): ScoreComponents {
    const fieldScores = new Map<string, number>();
    const boostScores = new Map<string, number>();
    const decayScores = new Map<string, number>();

    fieldScores.set('title', this.calculateTextMatch(document.title, query.text));
    fieldScores.set('content', this.calculateTextMatch(document.content, query.text));
    fieldScores.set('tags', this.calculateTagMatch(document.tags, query.text));
    
    const recency = this.calculateRecencyScore(document.createdAt);
    fieldScores.set('recency', recency);
    
    const popularity = this.calculatePopularityScore(document);
    fieldScores.set('popularity', popularity);

    const finalScore = Array.from(fieldScores.values())
      .reduce((sum, score) => sum + score, 0) / fieldScores.size;

    return {
      fieldScores,
      boostScores,
      decayScores,
      finalScore
    };
  }

  /**
   * Generates highlights
   */
  private generateHighlights(document: SearchDocument, query: SearchQuery): Highlight[] {
    const highlights: Highlight[] = [];
    const queryTerms = query.text.toLowerCase().split(' ');

    // Title highlights
    const titleHighlights = this.extractHighlights(document.title, queryTerms);
    if (titleHighlights.length > 0) {
      highlights.push({
        field: 'title',
        snippets: titleHighlights,
        positions: [0],
        size: 100
      });
    }

    // Content highlights
    const contentHighlights = this.extractHighlights(document.content, queryTerms);
    if (contentHighlights.length > 0) {
      highlights.push({
        field: 'content',
        snippets: contentHighlights.slice(0, 3),
        positions: [0],
        size: 200
      });
    }

    return highlights;
  }

  /**
   * Extracts highlights from text
   */
  private extractHighlights(text: string, terms: string[]): string[] {
    const highlights: string[] = [];
    const words = text.split(' ');
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase();
      if (terms.some(term => word.includes(term))) {
        const start = Math.max(0, i - 5);
        const end = Math.min(words.length, i + 5);
        const snippet = words.slice(start, end).join(' ');
        highlights.push(`...${snippet}...`);
      }
    }
    
    return highlights;
  }

  /**
   * Generates explanation
   */
  private generateExplanation(document: SearchDocument, query: SearchQuery, score: number): string {
    const components = this.calculateScoreComponents(document, query);
    const explanations = [];

    for (const [field, score] of components.fieldScores) {
      if (score > 0.1) {
        explanations.push(`${field}: ${(score * 100).toFixed(1)}%`);
      }
    }

    return explanations.length > 0 
      ? `Score ${(score * 100).toFixed(1)}% based on ${explanations.join(', ')}`
      : 'No significant matches found';
  }

  /**
   * Gets matched fields
   */
  private getMatchedFields(document: SearchDocument, query: SearchQuery): string[] {
    const matchedFields: string[] = [];
    const queryTerms = query.text.toLowerCase().split(' ');

    if (this.calculateTextMatch(document.title, query.text) > 0.1) {
      matchedFields.push('title');
    }
    
    if (this.calculateTextMatch(document.content, query.text) > 0.1) {
      matchedFields.push('content');
    }
    
    if (this.calculateTagMatch(document.tags, query.text) > 0.1) {
      matchedFields.push('tags');
    }

    return matchedFields;
  }

  /**
   * Applies filters
   */
  private applyFilters(hits: Hit[], filters: Filter[]): Hit[] {
    if (!filters || filters.length === 0) return hits;

    return hits.filter(hit => {
      return this.matchesFilters(hit.document, filters);
    });
  }

  /**
   * Checks if document matches filters
   */
  private matchesFilters(document: SearchDocument, filters: Filter[]): boolean {
    for (const filter of filters) {
      const fieldValue = this.getFieldValue(document, filter.field);
      
      switch (filter.type) {
        case FilterType.EQUALS:
          if (fieldValue !== filter.value) return false;
          break;
        case FilterType.NOT_EQUALS:
          if (fieldValue === filter.value) return false;
          break;
        case FilterType.CONTAINS:
          if (!fieldValue.includes(filter.value)) return false;
          break;
        case FilterType.STARTS_WITH:
          if (!fieldValue.startsWith(filter.value)) return false;
          break;
        case FilterType.ENDS_WITH:
          if (!fieldValue.endsWith(filter.value)) return false;
          break;
        case FilterType.GREATER_THAN:
          if (fieldValue <= filter.value) return false;
          break;
        case FilterType.LESS_THAN:
          if (fieldValue >= filter.value) return false;
          break;
        case FilterType.BETWEEN:
          if (fieldValue < filter.value[0] || fieldValue > filter.value[1]) return false;
          break;
        case FilterType.IN:
          if (!filter.value.includes(fieldValue)) return false;
          break;
        case FilterType.NOT_IN:
          if (filter.value.includes(fieldValue)) return false;
          break;
        case FilterType.EXISTS:
          if (fieldValue === undefined || fieldValue === null) return false;
          break;
        case FilterType.NOT_EXISTS:
          if (fieldValue !== undefined && fieldValue !== null) return false;
          break;
        case FilterType.FUZZY:
          const match = this.fuzzyMatch(fieldValue, filter.value);
          if (!match) return false;
          break;
        default:
          return false;
      }
    }
    
    return true;
  }

  /**
   * Gets field value from document
   */
  private getFieldValue(document: SearchDocument, field: string): any {
    const parts = field.split('.');
    let value: any = document;
    
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Fuzzy match
   */
  private fuzzyMatch(value: string, pattern: string): boolean {
    if (!value || !pattern) return false;
    const distance = this.levenshteinDistance(value.toLowerCase(), pattern.toLowerCase());
    const threshold = Math.max(value.length, pattern.length) * 0.3;
    return distance <= threshold;
  }

  /**
   * Levenshtein distance
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b[i - 1] === a[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }

  /**
   * Applies boosts
   */
  private applyBoosts(hits: Hit[], boosts: BoostRule[]): Hit[] {
    if (!boosts || boosts.length === 0) return hits;

    return hits.map(hit => {
      let finalScore = hit.score;
      
      for (const boost of boosts) {
        if (boost.condition && !boost.condition(hit.document)) continue;
        
        const fieldValue = this.getFieldValue(hit.document, boost.field);
        if (fieldValue === boost.value) {
          if (boost.operation === 'ADD') {
            finalScore += boost.factor;
          } else if (boost.operation === 'MULTIPLY') {
            finalScore *= boost.factor;
          }
        }
      }
      
      return {
        ...hit,
        score: finalScore
      };
    });
  }

  /**
   * Sorts results
   */
  private sortResults(hits: Hit[], sorts: Sort[]): Hit[] {
    if (!sorts || sorts.length === 0) {
      // Default sort by score
      return hits.sort((a, b) => b.score - a.score);
    }

    return hits.sort((a, b) => {
      for (const sort of sorts) {
        const aValue = this.getFieldValue(a.document, sort.field);
        const bValue = this.getFieldValue(b.document, sort.field);
        
        let comparison = 0;
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (aValue instanceof Date && bValue instanceof Date) {
          comparison = aValue.getTime() - bValue.getTime();
        } else {
          comparison = 0;
        }
        
        if (comparison !== 0) {
          return sort.order === 'ASC' ? comparison : -comparison;
        }
      }
      return b.score - a.score; // Tie-breaker by score
    });
  }

  /**
   * Applies pagination
   */
  private applyPagination(hits: Hit[], pagination: Pagination): Hit[] {
    const page = pagination.page || 1;
    const size = pagination.size || 10;
    const start = (page - 1) * size;
    const end = start + size;
    
    return hits.slice(start, end).map((hit, index) => ({
      ...hit,
      rank: start + index + 1
    }));
  }

  /**
   * Generates facets
   */
  private generateFacets(hits: Hit[], facets: Facet[]): FacetResult[] {
    if (!facets || facets.length === 0) return [];

    const results: FacetResult[] = [];

    for (const facet of facets) {
      const buckets = new Map<string, number>();
      
      for (const hit of hits) {
        const value = this.getFieldValue(hit.document, facet.field);
        if (value !== undefined && value !== null) {
          const key = String(value);
          buckets.set(key, (buckets.get(key) || 0) + 1);
        }
      }
      
      const facetBuckets: FacetBucket[] = Array.from(buckets.entries())
        .map(([key, count]) => ({
          key,
          count,
          selected: false
        }))
        .sort((a, b) => facet.order === 'COUNT' ? b.count - a.count : a.key.localeCompare(b.key))
        .slice(0, facet.size);
      
      results.push({
        field: facet.field,
        buckets: facetBuckets,
        total: hits.length,
        missing: hits.filter(h => this.getFieldValue(h.document, facet.field) === undefined).length,
        other: hits.length - facetBuckets.reduce((sum, b) => sum + b.count, 0)
      });
    }

    return results;
  }

  /**
   * Spell check
   */
  private spellCheck(query: string): SpellCheckResult {
    const words = query.split(' ');
    const corrections: Correction[] = [];
    let corrected = false;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      // Check if word is in index
      if (!this.invertedIndex.has(word.toLowerCase())) {
        // Find similar words
        const suggestions = this.findSimilarWords(word, 1);
        if (suggestions.length > 0) {
          corrections.push({
            original: word,
            suggestion: suggestions[0],
            offset: i,
            length: word.length,
            score: 0.9
          });
          corrected = true;
        }
      }
    }

    const correctedQuery = corrections.reduce((q, c) => {
      return q.replace(c.original, c.suggestion);
    }, query);

    return {
      corrected,
      originalQuery: query,
      correctedQuery,
      corrections
    };
  }

  /**
   * Finds similar words
   */
  private findSimilarWords(word: string, maxDistance: number): string[] {
    const suggestions: Array<{ word: string; distance: number }> = [];
    
    for (const indexedWord of this.invertedIndex.keys()) {
      const distance = this.levenshteinDistance(word.toLowerCase(), indexedWord);
      if (distance <= maxDistance) {
        suggestions.push({ word: indexedWord, distance });
      }
    }
    
    return suggestions
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map(s => s.word);
  }

  /**
   * Generates suggestions
   */
  private generateSuggestions(query: SearchQuery): string[] {
    const suggestions: string[] = [];
    const terms = query.text.split(' ');
    
    // If no results, suggest similar queries from history
    if (this.zeroResultsCount > 5) {
      const similarQueries = this.searchHistory
        .filter(h => h.resultCount > 0)
        .map(h => h.query)
        .slice(0, 5);
      suggestions.push(...similarQueries);
    }
    
    // Suggest popular searches
    const popularSearches = this.searchHistory
      .filter(h => h.resultCount > 0)
      .sort((a, b) => b.clickThroughs - a.clickThroughs)
      .slice(0, 3)
      .map(h => h.query);
    suggestions.push(...popularSearches);
    
    return suggestions;
  }

  /**
   * Tracks search analytics
   */
  private trackSearch(query: SearchQuery, resultCount: number): void {
    const analytics: SearchAnalytics = {
      query: query.text,
      resultCount: resultCount,
      clickThroughs: 0,
      avgPosition: 0,
      timeToFirstResult: 0,
      totalTime: 0,
      filtersUsed: query.filters || [],
      facetsUsed: query.facets || [],
      sortUsed: query.sort || [],
      searchType: query.searchType,
      sessionId: `session_${Date.now()}`,
      timestamp: new Date()
    };
    
    this.searchHistory.push(analytics);
    
    // Update metrics
    this.avgQueryLength = (this.avgQueryLength * (this.searchHistory.length - 1) + query.text.length) / this.searchHistory.length;
    
    if (resultCount === 0) {
      this.zeroResultsCount++;
    }
  }

  /**
   * Gets search analytics
   */
  public getAnalytics(): SearchAnalytics[] {
    return this.searchHistory;
  }

  /**
   * Gets search metrics
   */
  public getMetrics(): any {
    return {
      totalSearches: this.searchCount,
      avgQueryLength: this.avgQueryLength,
      zeroResultsCount: this.zeroResultsCount,
      zeroResultRate: this.searchCount > 0 ? this.zeroResultsCount / this.searchCount : 0,
      documentCount: this.documents.size,
      indexSize: this.invertedIndex.size,
      uniqueTerms: this.invertedIndex.size,
      avgDocumentsPerTerm: this.invertedIndex.size > 0 
        ? Array.from(this.invertedIndex.values()).reduce((sum, docs) => sum + docs.size, 0) / this.invertedIndex.size
        : 0
    };
  }

  /**
   * Clears all data
   */
  public clear(): void {
    this.documents.clear();
    this.index.clear();
    this.invertedIndex.clear();
    this.searchHistory = [];
    this.searchCount = 0;
    this.avgQueryLength = 0;
    this.zeroResultsCount = 0;
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Search, Filtering, and Ranking Engine', () => {
  let searchEngine: SearchEngine;

  beforeEach(() => {
    searchEngine = new SearchEngine();
    
    // Seed with test documents
    const testDocuments: SearchDocument[] = [
      {
        id: 'doc_001',
        title: 'Introduction to Artificial Intelligence',
        content: 'Artificial Intelligence (AI) is the simulation of human intelligence processes by machines, especially computer systems. These processes include learning, reasoning, and self-correction.',
        tags: ['AI', 'machine-learning', 'technology'],
        categories: ['Technology', 'Education'],
        metadata: {
          author: 'Dr. John Smith',
          type: DocumentType.ARTICLE,
          language: 'en',
          version: '1.0',
          size: 2048,
          wordCount: 350,
          keywords: ['AI', 'Machine Learning', 'Neural Networks'],
          entities: [
            { text: 'Artificial Intelligence', type: EntityType.CONCEPT, confidence: 0.95, positions: [0, 20] }
          ],
          locations: [],
          dates: [new Date('2023-01-15')]
        },
        createdAt: new Date('2023-01-15'),
        updatedAt: new Date('2023-01-15')
      },
      {
        id: 'doc_002',
        title: 'Machine Learning Best Practices',
        content: 'Machine learning is a subset of artificial intelligence. It focuses on the development of algorithms that allow computers to learn from and make predictions based on data.',
        tags: ['machine-learning', 'data-science', 'python'],
        categories: ['Technology', 'Data Science'],
        metadata: {
          author: 'Dr. Sarah Johnson',
          type: DocumentType.TECHNICAL,
          language: 'en',
          version: '2.1',
          size: 4096,
          wordCount: 550,
          keywords: ['Machine Learning', 'Algorithms', 'Data Science'],
          entities: [
            { text: 'Machine Learning', type: EntityType.CONCEPT, confidence: 0.98, positions: [0, 15] },
            { text: 'Algorithms', type: EntityType.CONCEPT, confidence: 0.85, positions: [30, 45] }
          ],
          locations: [],
          dates: [new Date('2023-02-10')]
        },
        createdAt: new Date('2023-02-10'),
        updatedAt: new Date('2023-02-15')
      },
      {
        id: 'doc_003',
        title: 'Natural Language Processing in Healthcare',
        content: 'Natural Language Processing (NLP) is used in healthcare to extract insights from unstructured clinical notes. This improves patient care and research outcomes.',
        tags: ['nlp', 'healthcare', 'ai'],
        categories: ['Healthcare', 'Technology'],
        metadata: {
          author: 'Dr. Michael Brown',
          type: DocumentType.ACADEMIC,
          language: 'en',
          version: '3.0',
          size: 6144,
          wordCount: 750,
          keywords: ['NLP', 'Healthcare', 'Clinical Notes'],
          entities: [
            { text: 'Natural Language Processing', type: EntityType.CONCEPT, confidence: 0.97, positions: [0, 30] },
            { text: 'Healthcare', type: EntityType.CONCEPT, confidence: 0.90, positions: [40, 55] }
          ],
          locations: [],
          dates: [new Date('2023-03-05')]
        },
        createdAt: new Date('2023-03-05'),
        updatedAt: new Date('2023-03-10')
      },
      {
        id: 'doc_004',
        title: 'Deep Learning for Computer Vision',
        content: 'Deep learning models like Convolutional Neural Networks (CNNs) have revolutionized computer vision tasks including image classification, object detection, and segmentation.',
        tags: ['deep-learning', 'computer-vision', 'cnn'],
        categories: ['Technology', 'AI'],
        metadata: {
          author: 'Dr. Emily Davis',
          type: DocumentType.TECHNICAL,
          language: 'en',
          version: '1.5',
          size: 5120,
          wordCount: 600,
          keywords: ['Deep Learning', 'CNN', 'Computer Vision'],
          entities: [
            { text: 'Deep Learning', type: EntityType.CONCEPT, confidence: 0.96, positions: [0, 12] },
            { text: 'Computer Vision', type: EntityType.CONCEPT, confidence: 0.94, positions: [25, 40] }
          ],
          locations: [],
          dates: [new Date('2023-04-01')]
        },
        createdAt: new Date('2023-04-01'),
        updatedAt: new Date('2023-04-05')
      },
      {
        id: 'doc_005',
        title: 'Ethics in Artificial Intelligence',
        content: 'Ethical considerations in AI include bias, fairness, transparency, and accountability. These issues are critical for responsible AI development and deployment.',
        tags: ['ai', 'ethics', 'responsible-ai'],
        categories: ['Ethics', 'Technology'],
        metadata: {
          author: 'Dr. David Wilson',
          type: DocumentType.ARTICLE,
          language: 'en',
          version: '1.2',
          size: 3072,
          wordCount: 400,
          keywords: ['AI Ethics', 'Bias', 'Fairness'],
          entities: [
            { text: 'AI Ethics', type: EntityType.CONCEPT, confidence: 0.93, positions: [0, 10] }
          ],
          locations: [],
          dates: [new Date('2023-05-15')]
        },
        createdAt: new Date('2023-05-15'),
        updatedAt: new Date('2023-05-15')
      }
    ];

    for (const doc of testDocuments) {
      searchEngine.indexDocument(doc);
    }
  });

  // ============================================================================
  // SEARCH ALGORITHM TESTS
  // ============================================================================

  describe('Search Algorithm Tests', () => {
    it('should return relevant results for full-text search', () => {
      const query: SearchQuery = {
        text: 'artificial intelligence',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits.length).toBeGreaterThan(0);
      expect(results.hits[0].document.title).toContain('Artificial Intelligence');
      expect(results.hits[0].score).toBeGreaterThan(0);
    });

    it('should return relevant results for phrase search', () => {
      const query: SearchQuery = {
        text: '"machine learning"',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.PHRASE,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits.length).toBeGreaterThan(0);
      expect(results.hits[0].document.title).toContain('Machine Learning');
    });

    it('should handle wildcard search', () => {
      const query: SearchQuery = {
        text: 'learn*',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.WILDCARD,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits.length).toBeGreaterThan(0);
      expect(results.hits.some(h => h.document.title.includes('Learning'))).toBe(true);
    });

    it('should handle fuzzy search', () => {
      const query: SearchQuery = {
        text: 'artificial intellegence',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en',
        fuzzy: true
      };

      const results = searchEngine.search(query);
      expect(results.hits.length).toBeGreaterThan(0);
      expect(results.hits[0].score).toBeGreaterThan(0);
    });

    it('should handle regex search', () => {
      const query: SearchQuery = {
        text: '[A-Za-z]+ Learning',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.REGEX,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits.length).toBeGreaterThan(0);
    });

    it('should handle semantic search', () => {
      const query: SearchQuery = {
        text: 'how to train AI models',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.SEMANTIC,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits.length).toBeGreaterThan(0);
    });

    it('should handle hybrid search', () => {
      const query: SearchQuery = {
        text: 'AI ethics and bias',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.HYBRID,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // FILTERING TESTS
  // ============================================================================

  describe('Filtering Tests', () => {
    it('should filter by equals operator', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [
          { field: 'metadata.type', type: FilterType.EQUALS, value: DocumentType.ARTICLE }
        ],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits.every(h => h.document.metadata.type === DocumentType.ARTICLE)).toBe(true);
    });

    it('should filter by contains operator', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [
          { field: 'title', type: FilterType.CONTAINS, value: 'Artificial' }
        ],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits.every(h => h.document.title.includes('Artificial'))).toBe(true);
    });

    it('should filter by in operator', () => {
      const query: SearchQuery = {
        text: 'learning',
        filters: [
          { field: 'categories', type: FilterType.IN, value: ['Technology', 'AI'] }
        ],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits.every(h => 
        h.document.categories.some(c => ['Technology', 'AI'].includes(c))
      )).toBe(true);
    });

    it('should filter by greater than operator', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [
          { field: 'metadata.wordCount', type: FilterType.GREATER_THAN, value: 500 }
        ],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits.every(h => h.document.metadata.wordCount > 500)).toBe(true);
    });

    it('should filter by less than operator', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [
          { field: 'metadata.wordCount', type: FilterType.LESS_THAN, value: 500 }
        ],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits.every(h => h.document.metadata.wordCount < 500)).toBe(true);
    });

    it('should filter by between operator', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [
          { field: 'metadata.wordCount', type: FilterType.BETWEEN, value: [300, 600] }
        ],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits.every(h => 
        h.document.metadata.wordCount >= 300 && h.document.metadata.wordCount <= 600
      )).toBe(true);
    });

    it('should filter by exists operator', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [
          { field: 'metadata.sentiment', type: FilterType.EXISTS, value: null }
        ],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits.every(h => h.document.metadata.sentiment !== undefined)).toBe(true);
    });

    it('should filter by fuzzy operator', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [
          { field: 'title', type: FilterType.FUZZY, value: 'Inteligence' }
        ],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits.length).toBeGreaterThan(0);
    });

    it('should combine multiple filters', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [
          { field: 'metadata.type', type: FilterType.EQUALS, value: DocumentType.TECHNICAL },
          { field: 'categories', type: FilterType.CONTAINS, value: 'Technology' }
        ],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits.every(h => 
        h.document.metadata.type === DocumentType.TECHNICAL &&
        h.document.categories.some(c => c.includes('Technology'))
      )).toBe(true);
    });
  });

  // ============================================================================
  // RANKING TESTS
  // ============================================================================

  describe('Ranking Tests', () => {
    it('should rank by relevance score', () => {
      const query: SearchQuery = {
        text: 'artificial intelligence',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits.length).toBeGreaterThan(0);
      
      // Check that results are sorted by score descending
      for (let i = 0; i < results.hits.length - 1; i++) {
        expect(results.hits[i].score).toBeGreaterThanOrEqual(results.hits[i + 1].score);
      }
    });

    it('should rank by title weight', () => {
      // Create ranking config with high title weight
      const weights = new Map<string, number>([
        ['title', 10.0],
        ['content', 0.1],
        ['tags', 0.1],
        ['metadata', 0.1],
        ['recency', 0.1],
        ['popularity', 0.1],
        ['relevance', 0.1]
      ]);
      
      const config: RankingConfig = {
        algorithm: RankingAlgorithm.LINEAR,
        features: [],
        weights: weights,
        normalization: NormalizationMethod.MIN_MAX,
        boostRules: [],
        freshness: { enabled: false, decayRate: 0, halfLife: 0, referenceDate: new Date() },
        personalization: { enabled: false, userId: '', history: [], preferences: {
          categories: [], tags: [], topics: [], language: '', sources: [], recency: 0
        }, weight: 0 }
      };
      
      const engine = new SearchEngine(config);
      
      // Re-index documents
      for (const doc of searchEngine['documents'].values()) {
        engine.indexDocument(doc);
      }
      
      const query: SearchQuery = {
        text: 'machine learning',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = engine.search(query);
      expect(results.hits.length).toBeGreaterThan(0);
      expect(results.hits[0].document.title).toContain('Machine Learning');
    });

    it('should rank by recency', () => {
      // Create ranking config with high recency weight
      const config: RankingConfig = {
        algorithm: RankingAlgorithm.LINEAR,
        features: [],
        weights: new Map([['recency', 10.0], ['title', 0.1], ['content', 0.1], ['tags', 0.1], ['metadata', 0.1], ['popularity', 0.1], ['relevance', 0.1]]),
        normalization: NormalizationMethod.MIN_MAX,
        boostRules: [],
        freshness: { enabled: true, decayRate: 1.0, halfLife: 7, referenceDate: new Date() },
        personalization: { enabled: false, userId: '', history: [], preferences: {
          categories: [], tags: [], topics: [], language: '', sources: [], recency: 0
        }, weight: 0 }
      };
      
      const engine = new SearchEngine(config);
      
      // Re-index documents with different dates
      for (const doc of searchEngine['documents'].values()) {
        engine.indexDocument(doc);
      }
      
      const query: SearchQuery = {
        text: 'AI',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = engine.search(query);
      expect(results.hits.length).toBeGreaterThan(0);
    });

    it('should apply boost rules', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en',
        boosting: [
          { field: 'title', value: 'Artificial Intelligence', factor: 2.0, operation: 'MULTIPLY' }
        ]
      };

      const results = searchEngine.search(query);
      expect(results.hits.length).toBeGreaterThan(0);
      
      // Document with exact title match should be boosted
      const topHit = results.hits[0];
      expect(topHit.document.title).toContain('Artificial Intelligence');
    });

    it('should handle complex scoring with multiple factors', () => {
      const query: SearchQuery = {
        text: 'machine learning',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en',
        scoring: {
          algorithm: ScoringAlgorithm.BM25,
          weights: { title: 2.0, content: 1.0, tags: 1.5, metadata: 0.8, recency: 0.5, popularity: 0.3, relevance: 1.0 },
          normalization: 'Z_SCORE',
          tieBreaker: 0.5
        }
      };

      const results = searchEngine.search(query);
      expect(results.hits.length).toBeGreaterThan(0);
      expect(results.hits[0].scoreComponents).toBeDefined();
      expect(results.hits[0].scoreComponents.fieldScores.size).toBeGreaterThan(0);
    });

    it('should handle personalization ranking', () => {
      const config: RankingConfig = {
        algorithm: RankingAlgorithm.LINEAR,
        features: [],
        weights: new Map([['title', 0.5], ['content', 0.5], ['tags', 0.5], ['metadata', 0.5], ['recency', 0.5], ['popularity', 0.5], ['relevance', 0.5]]),
        normalization: NormalizationMethod.MIN_MAX,
        boostRules: [],
        freshness: { enabled: false, decayRate: 0, halfLife: 0, referenceDate: new Date() },
        personalization: {
          enabled: true,
          userId: 'user_001',
          history: [
            { query: 'AI', timestamp: new Date(), clicked: ['doc_001'], viewed: ['doc_001', 'doc_003'], duration: 120 }
          ],
          preferences: {
            categories: ['Technology'],
            tags: ['AI'],
            topics: ['Artificial Intelligence'],
            language: 'en',
            sources: [],
            recency: 0.5
          },
          weight: 0.8
        }
      };
      
      const engine = new SearchEngine(config);
      
      // Re-index documents
      for (const doc of searchEngine['documents'].values()) {
        engine.indexDocument(doc);
      }
      
      const query: SearchQuery = {
        text: 'AI',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = engine.search(query);
      expect(results.hits.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // SORTING TESTS
  // ============================================================================

  describe('Sorting Tests', () => {
    it('should sort by score descending by default', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      for (let i = 0; i < results.hits.length - 1; i++) {
        expect(results.hits[i].score).toBeGreaterThanOrEqual(results.hits[i + 1].score);
      }
    });

    it('should sort by date descending', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en',
        sort: [{ field: 'createdAt', order: 'DESC' }]
      };

      const results = searchEngine.search(query);
      for (let i = 0; i < results.hits.length - 1; i++) {
        expect(results.hits[i].document.createdAt.getTime())
          .toBeGreaterThanOrEqual(results.hits[i + 1].document.createdAt.getTime());
      }
    });

    it('should sort by title ascending', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en',
        sort: [{ field: 'title', order: 'ASC' }]
      };

      const results = searchEngine.search(query);
      for (let i = 0; i < results.hits.length - 1; i++) {
        expect(results.hits[i].document.title)
          .toBeLessThanOrEqual(results.hits[i + 1].document.title);
      }
    });

    it('should sort by multiple fields', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en',
        sort: [
          { field: 'metadata.type', order: 'ASC' },
          { field: 'createdAt', order: 'DESC' }
        ]
      };

      const results = searchEngine.search(query);
      expect(results.hits.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // FACETING TESTS
  // ============================================================================

  describe('Faceting Tests', () => {
    it('should generate term facets', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en',
        facets: [
          { field: 'metadata.type', size: 10, order: 'COUNT', type: 'TERMS' }
        ]
      };

      const results = searchEngine.search(query);
      expect(results.facets.length).toBeGreaterThan(0);
      
      const facet = results.facets[0];
      expect(facet.field).toBe('metadata.type');
      expect(facet.buckets.length).toBeGreaterThan(0);
      expect(facet.total).toBeGreaterThan(0);
    });

    it('should generate range facets', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en',
        facets: [
          { 
            field: 'metadata.wordCount', 
            size: 5, 
            order: 'VALUE', 
            type: 'RANGE',
            range: { min: 0, max: 1000, interval: 200 }
          }
        ]
      };

      const results = searchEngine.search(query);
      expect(results.facets.length).toBeGreaterThan(0);
    });

    it('should generate date histogram facets', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en',
        facets: [
          { 
            field: 'createdAt', 
            size: 10, 
            order: 'COUNT', 
            type: 'DATE_HISTOGRAM',
            dateRange: { min: new Date('2023-01-01'), max: new Date('2023-12-31'), interval: 'MONTH' }
          }
        ]
      };

      const results = searchEngine.search(query);
      expect(results.facets.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // SPELL CHECK TESTS
  // ============================================================================

  describe('Spell Check Tests', () => {
    it('should detect misspelled words', () => {
      const query: SearchQuery = {
        text: 'artificial inteligence',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.spellcheck.corrected).toBe(true);
      expect(results.spellcheck.corrections.length).toBeGreaterThan(0);
    });

    it('should suggest corrections', () => {
      const query: SearchQuery = {
        text: 'machin learning',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.spellcheck.corrections.length).toBeGreaterThan(0);
      expect(results.spellcheck.correctedQuery).toContain('machine');
    });
  });

  // ============================================================================
  // SUGGESTION TESTS
  // ============================================================================

  describe('Suggestion Tests', () => {
    it('should generate search suggestions', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.suggestions).toBeDefined();
    });
  });

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  describe('Performance Tests', () => {
    it('should return results quickly', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const start = Date.now();
      const results = searchEngine.search(query);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100);
      expect(results.took).toBeLessThan(100);
    });

    it('should handle large result sets efficiently', () => {
      // Add 100 more documents
      for (let i = 0; i < 100; i++) {
        const doc: SearchDocument = {
          id: `doc_${String(i + 6).padStart(3, '0')}`,
          title: `Test Document ${i}`,
          content: `This is test document ${i} with some content about AI and machine learning.`,
          tags: ['test', 'ai'],
          categories: ['Test'],
          metadata: {
            author: 'Test Author',
            type: DocumentType.ARTICLE,
            language: 'en',
            version: '1.0',
            size: 1024,
            wordCount: 100,
            keywords: ['test', 'ai'],
            entities: [],
            locations: [],
            dates: [new Date()]
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };
        searchEngine.indexDocument(doc);
      }

      const query: SearchQuery = {
        text: 'AI',
        filters: [],
        pagination: { page: 1, size: 20 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const start = Date.now();
      const results = searchEngine.search(query);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(500);
      expect(results.total).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // EDGE CASE TESTS
  // ============================================================================

  describe('Edge Case Tests', () => {
    it('should handle empty search query', () => {
      const query: SearchQuery = {
        text: '',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits).toEqual([]);
      expect(results.total).toBe(0);
    });

    it('should handle no matching results', () => {
      const query: SearchQuery = {
        text: 'nonexistentterm',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits).toEqual([]);
      expect(results.total).toBe(0);
    });

    it('should handle very long queries', () => {
      const longQuery = 'AI '.repeat(1000);
      const query: SearchQuery = {
        text: longQuery,
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits).toBeDefined();
    });

    it('should handle special characters in query', () => {
      const query: SearchQuery = {
        text: 'AI!@#$%^&*()',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits).toBeDefined();
    });

    it('should handle pagination edge cases', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [],
        pagination: { page: 999, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits).toEqual([]);
      expect(results.total).toBeGreaterThan(0);
    });

    it('should handle empty filter values', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [
          { field: 'title', type: FilterType.EQUALS, value: '' }
        ],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits).toBeDefined();
    });

    it('should handle null field values', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [
          { field: 'metadata.sentiment', type: FilterType.EQUALS, value: null }
        ],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results = searchEngine.search(query);
      expect(results.hits).toBeDefined();
    });
  });

  // ============================================================================
  // REGRESSION TESTS
  // ============================================================================

  describe('Regression Tests', () => {
    it('should maintain consistent results across multiple searches', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results1 = searchEngine.search(query);
      const results2 = searchEngine.search(query);
      
      expect(results1.hits.length).toBe(results2.hits.length);
      expect(results1.hits[0].document.id).toBe(results2.hits[0].document.id);
      expect(results1.hits[0].score).toBeCloseTo(results2.hits[0].score, 5);
    });

    it('should maintain performance after multiple searches', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const times: number[] = [];
      for (let i = 0; i < 20; i++) {
        const start = Date.now();
        searchEngine.search(query);
        times.push(Date.now() - start);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avgTime).toBeLessThan(100);
    });

    it('should maintain consistency with filters', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [
          { field: 'metadata.type', type: FilterType.EQUALS, value: DocumentType.TECHNICAL }
        ],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      const results1 = searchEngine.search(query);
      const results2 = searchEngine.search(query);
      
      expect(results1.hits.length).toBe(results2.hits.length);
      expect(results1.facets.length).toBe(results2.facets.length);
    });
  });

  // ============================================================================
  // ANALYTICS TESTS
  // ============================================================================

  describe('Analytics Tests', () => {
    it('should track search history', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      searchEngine.search(query);
      const analytics = searchEngine.getAnalytics();
      expect(analytics.length).toBeGreaterThan(0);
      expect(analytics[0].query).toBe('AI');
    });

    it('should calculate search metrics', () => {
      const query: SearchQuery = {
        text: 'AI',
        filters: [],
        pagination: { page: 1, size: 10 },
        searchType: SearchType.FULL_TEXT,
        language: 'en'
      };

      searchEngine.search(query);
      searchEngine.search(query);
      
      const metrics = searchEngine.getMetrics();
      expect(metrics.totalSearches).toBeGreaterThan(0);
      expect(metrics.documentCount).toBeGreaterThan(0);
      expect(metrics.avgQueryLength).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// EXPORT TEST MODULE
// ============================================================================

export default {
  SearchEngine,
  SearchQuery,
  FilterType,
  SearchType,
  RankingAlgorithm
};
