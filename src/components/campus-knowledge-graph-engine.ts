/**
 * Campus Knowledge Graph & Contextual Intelligence Engine
 * @module CampusKnowledgeGraphEngine
 * @description Advanced knowledge graph engine for campus-wide contextual intelligence
 * @version 2.0.0
 * @author Campus Intelligence Team
 * 
 * This engine provides comprehensive knowledge graph capabilities including:
 * - Entity extraction and relationship mapping
 * - Semantic reasoning and inference
 * - Contextual awareness and pattern recognition
 * - Multi-dimensional data integration
 * - Temporal and spatial intelligence
 * - Predictive analytics and recommendations
 */

// ============================================================================
// IMPORTS AND DEPENDENCIES
// ============================================================================

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CORE TYPES AND ENUMS
// ============================================================================

/**
 * Entity types in the knowledge graph
 */
export enum EntityType {
  // People
  STUDENT = 'STUDENT',
  FACULTY = 'FACULTY',
  STAFF = 'STAFF',
  ADMINISTRATOR = 'ADMINISTRATOR',
  ALUMNI = 'ALUMNI',
  VISITOR = 'VISITOR',
  
  // Physical
  BUILDING = 'BUILDING',
  ROOM = 'ROOM',
  DEPARTMENT = 'DEPARTMENT',
  LABORATORY = 'LABORATORY',
  LIBRARY = 'LIBRARY',
  DINING_HALL = 'DINING_HALL',
  RESIDENCE_HALL = 'RESIDENCE_HALL',
  SPORTS_FACILITY = 'SPORTS_FACILITY',
  PARKING = 'PARKING',
  GROUNDS = 'GROUNDS',
  
  // Academic
  COURSE = 'COURSE',
  PROGRAM = 'PROGRAM',
  MAJOR = 'MAJOR',
  MINOR = 'MINOR',
  CERTIFICATE = 'CERTIFICATE',
  RESEARCH_GROUP = 'RESEARCH_GROUP',
  PROJECT = 'PROJECT',
  PUBLICATION = 'PUBLICATION',
  
  // Events
  CLASS_SESSION = 'CLASS_SESSION',
  EXAM = 'EXAM',
  EVENT = 'EVENT',
  WORKSHOP = 'WORKSHOP',
  SEMINAR = 'SEMINAR',
  CONFERENCE = 'CONFERENCE',
  CLUB_MEETING = 'CLUB_MEETING',
  
  // Resources
  EQUIPMENT = 'EQUIPMENT',
  TECHNOLOGY = 'TECHNOLOGY',
  SOFTWARE = 'SOFTWARE',
  DATABASE = 'DATABASE',
  COLLECTION = 'COLLECTION',
  
  // Abstract
  CONCEPT = 'CONCEPT',
  SKILL = 'SKILL',
  COMPETENCY = 'COMPETENCY',
  KNOWLEDGE_AREA = 'KNOWLEDGE_AREA',
  INTEREST = 'INTEREST',
  GOAL = 'GOAL',
  OUTCOME = 'OUTCOME',
  
  // Temporal
  SEMESTER = 'SEMESTER',
  ACADEMIC_YEAR = 'ACADEMIC_YEAR',
  TIME_SLOT = 'TIME_SLOT',
  DEADLINE = 'DEADLINE'
}

/**
 * Relationship types in the knowledge graph
 */
export enum RelationshipType {
  // Structural
  IS_A = 'IS_A',
  HAS_A = 'HAS_A',
  PART_OF = 'PART_OF',
  CONTAINS = 'CONTAINS',
  LOCATED_IN = 'LOCATED_IN',
  BELONGS_TO = 'BELONGS_TO',
  REPORTS_TO = 'REPORTS_TO',
  SUPERVISES = 'SUPERVISES',
  
  // Academic
  ENROLLED_IN = 'ENROLLED_IN',
  TEACHES = 'TEACHES',
  STUDIES = 'STUDIES',
  RESEARCHES = 'RESEARCHES',
  PUBLISHED_IN = 'PUBLISHED_IN',
  CITES = 'CITES',
  CITED_BY = 'CITED_BY',
  REQUIRES = 'REQUIRES',
  PREREQUISITE = 'PREREQUISITE',
  COREQUISITE = 'COREQUISITE',
  EQUIVALENT_TO = 'EQUIVALENT_TO',
  
  // Temporal
  PRECEDES = 'PRECEDES',
  FOLLOWS = 'FOLLOWS',
  DURING = 'DURING',
  OVERLAPS = 'OVERLAPS',
  SCHEDULED_AT = 'SCHEDULED_AT',
  DEADLINE_ON = 'DEADLINE_ON',
  
  // Spatial
  ADJACENT_TO = 'ADJACENT_TO',
  NEAR = 'NEAR',
  WITHIN = 'WITHIN',
  ACCESSIBLE_FROM = 'ACCESSIBLE_FROM',
  
  // Resource
  USES = 'USES',
  ALLOCATED_TO = 'ALLOCATED_TO',
  AVAILABLE_FOR = 'AVAILABLE_FOR',
  RESERVED_FOR = 'RESERVED_FOR',
  MAINTAINS = 'MAINTAINS',
  
  // Social
  KNOWS = 'KNOWS',
  COLLABORATES_WITH = 'COLLABORATES_WITH',
  MENTORS = 'MENTORS',
  ADVISES = 'ADVISES',
  FOLLOWS = 'FOLLOWS',
  INTERACTS_WITH = 'INTERACTS_WITH',
  
  // Semantic
  RELATED_TO = 'RELATED_TO',
  SIMILAR_TO = 'SIMILAR_TO',
  IMPLIES = 'IMPLIES',
  CONTRADICTS = 'CONTRADICTS',
  SUPPORTS = 'SUPPORTS',
  CHALLENGES = 'CHALLENGES',
  
  // Activity
  PARTICIPATES_IN = 'PARTICIPATES_IN',
  ORGANIZES = 'ORGANIZES',
  ATTENDS = 'ATTENDS',
  PRESENTS_AT = 'PRESENTS_AT',
  VOLUNTEERS_FOR = 'VOLUNTEERS_FOR'
}

/**
 * Relationship cardinality
 */
export enum Cardinality {
  ONE_TO_ONE = 'ONE_TO_ONE',
  ONE_TO_MANY = 'ONE_TO_MANY',
  MANY_TO_ONE = 'MANY_TO_ONE',
  MANY_TO_MANY = 'MANY_TO_MANY'
}

/**
 * Entity property types
 */
export enum PropertyType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  DATE = 'DATE',
  DATETIME = 'DATETIME',
  JSON = 'JSON',
  ARRAY = 'ARRAY',
  ENUM = 'ENUM',
  REFERENCE = 'REFERENCE'
}

/**
 * Knowledge graph node / entity
 */
export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  description?: string;
  properties: Map<string, PropertyValue>;
  metadata: EntityMetadata;
  created: Date;
  updated: Date;
  active: boolean;
}

/**
 * Property value with type information
 */
export interface PropertyValue {
  type: PropertyType;
  value: any;
  confidence?: number;
  source?: string;
  timestamp?: Date;
}

/**
 * Entity metadata
 */
export interface EntityMetadata {
  sourceSystem?: string;
  confidence: number;
  verified: boolean;
  lastUpdated: Date;
  version: number;
  tags: string[];
  visibility: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
}

/**
 * Knowledge graph edge / relationship
 */
export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  cardinality: Cardinality;
  weight: number;
  properties: Map<string, PropertyValue>;
  metadata: RelationshipMetadata;
  created: Date;
  updated: Date;
  active: boolean;
}

/**
 * Relationship metadata
 */
export interface RelationshipMetadata {
  confidence: number;
  source: string;
  timestamp: Date;
  context?: string;
  temporalValidity?: {
    start: Date;
    end: Date;
  };
  spatialValidity?: {
    location: string;
    radius: number;
  };
}

/**
 * Contextual intelligence query
 */
export interface IntelligenceQuery {
  id: string;
  queryType: QueryType;
  entities: string[];
  relationships: RelationshipType[];
  constraints: QueryConstraint[];
  context: QueryContext;
  temporalRange?: TimeRange;
  spatialRange?: SpatialRange;
  limit: number;
  offset: number;
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
}

/**
 * Query types
 */
export enum QueryType {
  SIMPLE = 'SIMPLE',
  COMPLEX = 'COMPLEX',
  PATTERN = 'PATTERN',
  INFERENCE = 'INFERENCE',
  RECOMMENDATION = 'RECOMMENDATION',
  PREDICTION = 'PREDICTION',
  EXPLANATION = 'EXPLANATION',
  COMPARISON = 'COMPARISON'
}

/**
 * Query constraint
 */
export interface QueryConstraint {
  field: string;
  operator: 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IN' | 'NOT_IN' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH';
  value: any;
}

/**
 * Query context
 */
export interface QueryContext {
  userId?: string;
  role?: EntityType;
  location?: string;
  time?: Date;
  purpose?: string;
  metadata?: Record<string, any>;
}

/**
 * Time range
 */
export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Spatial range
 */
export interface SpatialRange {
  center: {
    latitude: number;
    longitude: number;
  };
  radius: number; // in meters
}

/**
 * Query result
 */
export interface QueryResult {
  id: string;
  entities: Entity[];
  relationships: Relationship[];
  insights: Insight[];
  confidence: number;
  explanation?: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

/**
 * Insight generated from knowledge graph
 */
export interface Insight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  confidence: number;
  entities: string[];
  relationships: string[];
  evidence: string[];
  implications: string[];
  recommendations: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string[];
  created: Date;
  metadata: Record<string, any>;
}

/**
 * Insight types
 */
export enum InsightType {
  PATTERN = 'PATTERN',
  ANOMALY = 'ANOMALY',
  TREND = 'TREND',
  CORRELATION = 'CORRELATION',
  CAUSATION = 'CAUSATION',
  OPPORTUNITY = 'OPPORTUNITY',
  RISK = 'RISK',
  RECOMMENDATION = 'RECOMMENDATION',
  PREDICTION = 'PREDICTION',
  EXPLANATION = 'EXPLANATION'
}

/**
 * Contextual intelligence profile
 */
export interface IntelligenceProfile {
  id: string;
  userId: string;
  interests: string[];
  expertise: string[];
  relationships: Relationship[];
  activityPatterns: ActivityPattern[];
  preferences: Record<string, any>;
  temporalContext: TemporalContext;
  spatialContext: SpatialContext;
  socialContext: SocialContext;
  academicContext: AcademicContext;
  updated: Date;
}

/**
 * Activity pattern
 */
export interface ActivityPattern {
  pattern: string;
  frequency: number;
  recurrence: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  confidence: number;
  entities: string[];
  relationships: string[];
  timeframe: TimeRange;
}

/**
 * Temporal context
 */
export interface TemporalContext {
  currentTime: Date;
  timezone: string;
  schedule: ScheduledEvent[];
  deadlines: Deadline[];
  availability: TimeSlot[];
}

/**
 * Scheduled event
 */
export interface ScheduledEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  location: string;
  type: string;
  participants: string[];
}

/**
 * Deadline
 */
export interface Deadline {
  id: string;
  title: string;
  dueDate: Date;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  associatedWith: string[];
  completed: boolean;
}

/**
 * Spatial context
 */
export interface SpatialContext {
  currentLocation: Location;
  frequentlyVisited: Location[];
  commutePatterns: CommutePattern[];
  boundaries: {
    home: Location;
    campus: Location;
    city: Location;
  };
}

/**
 * Location
 */
export interface Location {
  latitude: number;
  longitude: number;
  altitude?: number;
  building?: string;
  room?: string;
  accuracy: number;
  timestamp: Date;
}

/**
 * Commute pattern
 */
export interface CommutePattern {
  from: Location;
  to: Location;
  time: TimeRange;
  mode: 'WALKING' | 'DRIVING' | 'BIKING' | 'PUBLIC_TRANSIT' | 'OTHER';
  duration: number; // minutes
  frequency: number;
}

/**
 * Social context
 */
export interface SocialContext {
  connections: Connection[];
  groups: Group[];
  collaborations: Collaboration[];
  socialActivity: SocialActivity[];
}

/**
 * Connection
 */
export interface Connection {
  userId: string;
  relationship: RelationshipType;
  strength: number;
  interactionFrequency: number;
  lastInteraction: Date;
}

/**
 * Group
 */
export interface Group {
  id: string;
  name: string;
  type: 'CLASS' | 'CLUB' | 'PROJECT' | 'RESEARCH' | 'SOCIAL' | 'OTHER';
  members: string[];
  purpose: string;
  activity: string[];
}

/**
 * Collaboration
 */
export interface Collaboration {
  id: string;
  type: 'PROJECT' | 'RESEARCH' | 'STUDY' | 'SOCIAL' | 'OTHER';
  participants: string[];
  startDate: Date;
  endDate?: Date;
  status: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD';
}

/**
 * Social activity
 */
export interface SocialActivity {
  timestamp: Date;
  type: 'MEETING' | 'EVENT' | 'INTERACTION' | 'COMMUNICATION';
  participants: string[];
  location: Location;
  duration: number;
}

/**
 * Academic context
 */
export interface AcademicContext {
  enrolledCourses: Course[];
  grades: Grade[];
  major: string;
  minor: string[];
  academicYear: number;
  gpa: number;
  creditsEarned: number;
  progress: AcademicProgress;
}

/**
 * Course
 */
export interface Course {
  id: string;
  code: string;
  title: string;
  credits: number;
  semester: string;
  instructor: string;
  schedule: TimeSlot[];
  location: string;
  prerequisites: string[];
  status: 'ENROLLED' | 'COMPLETED' | 'WITHDRAWN';
}

/**
 * Grade
 */
export interface Grade {
  courseId: string;
  score: number;
  letterGrade: string;
  semester: string;
  timestamp: Date;
}

/**
 * Academic progress
 */
export interface AcademicProgress {
  degree: string;
  totalCreditsRequired: number;
  creditsCompleted: number;
  completionPercentage: number;
  expectedGraduation: Date;
  requirementsMet: string[];
  requirementsPending: string[];
}

/**
 * Knowledge graph statistics
 */
export interface GraphStatistics {
  totalEntities: number;
  totalRelationships: number;
  entityTypeDistribution: Map<EntityType, number>;
  relationshipTypeDistribution: Map<RelationshipType, number>;
  averageDegree: number;
  density: number;
  components: number;
  diameter: number;
  lastUpdated: Date;
}

/**
 * Inference rule
 */
export interface InferenceRule {
  id: string;
  name: string;
  description: string;
  antecedent: Pattern;
  consequent: Pattern;
  confidence: number;
  weight: number;
  active: boolean;
  created: Date;
}

/**
 * Pattern for inference
 */
export interface Pattern {
  type: 'ENTITY' | 'RELATIONSHIP' | 'PATH' | 'SUBGRAPH';
  conditions: PatternCondition[];
}

/**
 * Pattern condition
 */
export interface PatternCondition {
  field: string;
  operator: 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IN' | 'EXISTS' | 'MATCHES';
  value?: any;
}

/**
 * Embedding vector
 */
export interface EmbeddingVector {
  id: string;
  entityId: string;
  vector: number[];
  dimension: number;
  model: string;
  created: Date;
}

// ============================================================================
// CORE ENGINE CLASS
// ============================================================================

/**
 * Configuration interface for knowledge graph
 */
export interface KGConfig {
  enableInference: boolean;
  enableEmbeddings: boolean;
  enableAnalytics: boolean;
  enableCaching: boolean;
  maxEntities: number;
  maxRelationships: number;
  inferenceThreshold: number;
  embeddingDimension: number;
  similarityThreshold: number;
  cacheTTL: number;
  maintenanceInterval: number;
}

export class CampusKnowledgeGraphEngine {
  // Core graph structures
  private entities: Map<string, Entity> = new Map();
  private relationships: Map<string, Relationship> = new Map();
  private entityRelationships: Map<string, string[]> = new Map();
  private inverseRelationships: Map<string, string[]> = new Map();
  
  // Contextual intelligence
  private profiles: Map<string, IntelligenceProfile> = new Map();
  private insights: Insight[] = [];
  private inferenceRules: InferenceRule[] = [];
  private embeddings: Map<string, EmbeddingVector> = new Map();
  
  // Analytics
  private statistics: GraphStatistics;
  private queryHistory: IntelligenceQuery[] = [];
  private insightHistory: Insight[] = [];
  
  // Configuration
  private config: KGConfig;
  private isInitialized: boolean = false;
  private lastMaintenance: Date = new Date();
  
  // Event listeners
  private eventListeners: Map<string, Function[]> = new Map();



  constructor(config: Partial<KGConfig> = {}) {
    this.config = {
      enableInference: true,
      enableEmbeddings: true,
      enableAnalytics: true,
      enableCaching: true,
      maxEntities: 100000,
      maxRelationships: 500000,
      inferenceThreshold: 0.7,
      embeddingDimension: 384,
      similarityThreshold: 0.8,
      cacheTTL: 3600,
      maintenanceInterval: 86400,
      ...config
    };
    
    this.statistics = this.initializeStatistics();
    this.initializeDefaultRules();
  }

  /**
   * Initializes graph statistics
   */
  private initializeStatistics(): GraphStatistics {
    return {
      totalEntities: 0,
      totalRelationships: 0,
      entityTypeDistribution: new Map(),
      relationshipTypeDistribution: new Map(),
      averageDegree: 0,
      density: 0,
      components: 0,
      diameter: 0,
      lastUpdated: new Date()
    };
  }

  /**
   * Initializes default inference rules
   */
  private initializeDefaultRules(): void {
    // Rule: If a student is enrolled in a course, they are studying that subject
    this.inferenceRules.push({
      id: 'rule_001',
      name: 'Student Study Subject',
      description: 'Students enrolled in courses are studying the subject',
      antecedent: {
        type: 'RELATIONSHIP',
        conditions: [
          { field: 'type', operator: 'EQ', value: RelationshipType.ENROLLED_IN }
        ]
      },
      consequent: {
        type: 'RELATIONSHIP',
        conditions: [
          { field: 'type', operator: 'EQ', value: RelationshipType.STUDIES }
        ]
      },
      confidence: 0.95,
      weight: 1.0,
      active: true,
      created: new Date()
    });

    // Rule: If a faculty member teaches a course, they are in the department
    this.inferenceRules.push({
      id: 'rule_002',
      name: 'Faculty Department',
      description: 'Faculty teaching courses belong to the department',
      antecedent: {
        type: 'RELATIONSHIP',
        conditions: [
          { field: 'type', operator: 'EQ', value: RelationshipType.TEACHES }
        ]
      },
      consequent: {
        type: 'RELATIONSHIP',
        conditions: [
          { field: 'type', operator: 'EQ', value: RelationshipType.BELONGS_TO }
        ]
      },
      confidence: 0.90,
      weight: 0.9,
      active: true,
      created: new Date()
    });

    // Rule: If two students are in the same course, they are peers
    this.inferenceRules.push({
      id: 'rule_003',
      name: 'Student Peers',
      description: 'Students in the same course are peers',
      antecedent: {
        type: 'PATH',
        conditions: [
          { field: 'path_type', operator: 'EQ', value: 'SAME_COURSE' }
        ]
      },
      consequent: {
        type: 'RELATIONSHIP',
        conditions: [
          { field: 'type', operator: 'EQ', value: RelationshipType.KNOWS }
        ]
      },
      confidence: 0.85,
      weight: 0.8,
      active: true,
      created: new Date()
    });

    // Rule: Resources in the same location are accessible together
    this.inferenceRules.push({
      id: 'rule_004',
      name: 'Location Accessibility',
      description: 'Resources in the same location are accessible together',
      antecedent: {
        type: 'RELATIONSHIP',
        conditions: [
          { field: 'type', operator: 'EQ', value: RelationshipType.LOCATED_IN }
        ]
      },
      consequent: {
        type: 'RELATIONSHIP',
        conditions: [
          { field: 'type', operator: 'EQ', value: RelationshipType.ACCESSIBLE_FROM }
        ]
      },
      confidence: 0.75,
      weight: 0.7,
      active: true,
      created: new Date()
    });

    // Rule: Prerequisite courses imply knowledge progression
    this.inferenceRules.push({
      id: 'rule_005',
      name: 'Knowledge Progression',
      description: 'Prerequisite courses indicate knowledge progression',
      antecedent: {
        type: 'RELATIONSHIP',
        conditions: [
          { field: 'type', operator: 'EQ', value: RelationshipType.PREREQUISITE }
        ]
      },
      consequent: {
        type: 'RELATIONSHIP',
        conditions: [
          { field: 'type', operator: 'EQ', value: RelationshipType.SUPPORTS }
        ]
      },
      confidence: 0.80,
      weight: 0.85,
      active: true,
      created: new Date()
    });
  }

  // ============================================================================
  // ENTITY MANAGEMENT
  // ============================================================================

  /**
   * Adds a new entity to the knowledge graph
   */
  public addEntity(entity: Partial<Entity>): Entity {
    const newEntity: Entity = {
      id: entity.id || this.generateId(),
      type: entity.type || EntityType.CONCEPT,
      name: entity.name || '',
      description: entity.description,
      properties: entity.properties || new Map(),
      metadata: entity.metadata || {
        confidence: 1.0,
        verified: false,
        lastUpdated: new Date(),
        version: 1,
        tags: [],
        visibility: 'PUBLIC'
      },
      created: new Date(),
      updated: new Date(),
      active: entity.active !== undefined ? entity.active : true
    };

    if (this.entities.has(newEntity.id)) {
      throw new Error(`Entity with ID ${newEntity.id} already exists`);
    }

    this.entities.set(newEntity.id, newEntity);
    this.updateStatistics();
    this.emit('entityAdded', newEntity);
    
    return newEntity;
  }

  /**
   * Updates an existing entity
   */
  public updateEntity(entityId: string, updates: Partial<Entity>): Entity | null {
    const existing = this.entities.get(entityId);
    if (!existing) return null;

    const updated: Entity = {
      ...existing,
      ...updates,
      updated: new Date()
    };

    this.entities.set(entityId, updated);
    this.updateStatistics();
    this.emit('entityUpdated', updated);
    
    return updated;
  }

  /**
   * Deletes an entity and its relationships
   */
  public deleteEntity(entityId: string): boolean {
    if (!this.entities.has(entityId)) return false;

    // Remove all relationships involving this entity
    const relsToRemove = this.entityRelationships.get(entityId) || [];
    for (const relId of relsToRemove) {
      this.deleteRelationship(relId);
    }

    // Remove inverse relationships
    const inverseRels = this.inverseRelationships.get(entityId) || [];
    for (const relId of inverseRels) {
      this.deleteRelationship(relId);
    }

    this.entities.delete(entityId);
    this.entityRelationships.delete(entityId);
    this.inverseRelationships.delete(entityId);
    
    this.updateStatistics();
    this.emit('entityDeleted', entityId);
    
    return true;
  }

  /**
   * Gets an entity by ID
   */
  public getEntity(entityId: string): Entity | null {
    return this.entities.get(entityId) || null;
  }

  /**
   * Finds entities by type
   */
  public findEntitiesByType(type: EntityType): Entity[] {
    return Array.from(this.entities.values())
      .filter(e => e.type === type && e.active);
  }

  /**
   * Finds entities by property
   */
  public findEntitiesByProperty(
    propertyKey: string,
    propertyValue: any
  ): Entity[] {
    const result: Entity[] = [];
    for (const entity of this.entities.values()) {
      if (!entity.active) continue;
      const prop = entity.properties.get(propertyKey);
      if (prop && prop.value === propertyValue) {
        result.push(entity);
      }
    }
    return result;
  }

  /**
   * Finds entities by name (fuzzy search)
   */
  public findEntitiesByName(name: string, threshold: number = 0.7): Entity[] {
    const results: Array<{ entity: Entity; score: number }> = [];
    
    for (const entity of this.entities.values()) {
      if (!entity.active) continue;
      const similarity = this.calculateStringSimilarity(entity.name, name);
      if (similarity >= threshold) {
        results.push({ entity, score: similarity });
      }
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .map(r => r.entity);
  }

  // ============================================================================
  // RELATIONSHIP MANAGEMENT
  // ============================================================================

  /**
   * Adds a new relationship to the knowledge graph
   */
  public addRelationship(relationship: Partial<Relationship>): Relationship {
    const source = this.entities.get(relationship.sourceId!);
    const target = this.entities.get(relationship.targetId!);
    
    if (!source || !target) {
      throw new Error('Source or target entity not found');
    }

    const newRelationship: Relationship = {
      id: relationship.id || this.generateId(),
      sourceId: relationship.sourceId!,
      targetId: relationship.targetId!,
      type: relationship.type || RelationshipType.RELATED_TO,
      cardinality: relationship.cardinality || Cardinality.MANY_TO_MANY,
      weight: relationship.weight || 1.0,
      properties: relationship.properties || new Map(),
      metadata: relationship.metadata || {
        confidence: 1.0,
        source: 'SYSTEM',
        timestamp: new Date()
      },
      created: new Date(),
      updated: new Date(),
      active: relationship.active !== undefined ? relationship.active : true
    };

    if (this.relationships.has(newRelationship.id)) {
      throw new Error(`Relationship with ID ${newRelationship.id} already exists`);
    }

    this.relationships.set(newRelationship.id, newRelationship);
    
    // Update relationship indices
    if (!this.entityRelationships.has(newRelationship.sourceId)) {
      this.entityRelationships.set(newRelationship.sourceId, []);
    }
    this.entityRelationships.get(newRelationship.sourceId)!.push(newRelationship.id);
    
    if (!this.inverseRelationships.has(newRelationship.targetId)) {
      this.inverseRelationships.set(newRelationship.targetId, []);
    }
    this.inverseRelationships.get(newRelationship.targetId)!.push(newRelationship.id);

    this.updateStatistics();
    this.emit('relationshipAdded', newRelationship);
    
    // Apply inference rules if enabled
    if (this.config.enableInference) {
      this.applyInferenceRules(newRelationship);
    }
    
    return newRelationship;
  }

  /**
   * Updates an existing relationship
   */
  public updateRelationship(relationshipId: string, updates: Partial<Relationship>): Relationship | null {
    const existing = this.relationships.get(relationshipId);
    if (!existing) return null;

    const updated: Relationship = {
      ...existing,
      ...updates,
      updated: new Date()
    };

    this.relationships.set(relationshipId, updated);
    this.updateStatistics();
    this.emit('relationshipUpdated', updated);
    
    return updated;
  }

  /**
   * Deletes a relationship
   */
  public deleteRelationship(relationshipId: string): boolean {
    const rel = this.relationships.get(relationshipId);
    if (!rel) return false;

    // Remove from indices
    const sourceRels = this.entityRelationships.get(rel.sourceId);
    if (sourceRels) {
      const index = sourceRels.indexOf(relationshipId);
      if (index !== -1) sourceRels.splice(index, 1);
    }
    
    const targetRels = this.inverseRelationships.get(rel.targetId);
    if (targetRels) {
      const index = targetRels.indexOf(relationshipId);
      if (index !== -1) targetRels.splice(index, 1);
    }

    this.relationships.delete(relationshipId);
    this.updateStatistics();
    this.emit('relationshipDeleted', relationshipId);
    
    return true;
  }

  /**
   * Gets all relationships for an entity
   */
  public getEntityRelationships(entityId: string): Relationship[] {
    const relIds = this.entityRelationships.get(entityId) || [];
    const inverseRelIds = this.inverseRelationships.get(entityId) || [];
    const allIds = [...relIds, ...inverseRelIds];
    
    return allIds
      .map(id => this.relationships.get(id))
      .filter((r): r is Relationship => r !== undefined && r.active);
  }

  /**
   * Gets relationships of a specific type for an entity
   */
  public getRelationshipsByType(
    entityId: string,
    type: RelationshipType
  ): Relationship[] {
    return this.getEntityRelationships(entityId)
      .filter(r => r.type === type);
  }

  /**
   * Finds path between two entities
   */
  public findPath(
    sourceId: string,
    targetId: string,
    maxDepth: number = 5
  ): Entity[] | null {
    if (!this.entities.has(sourceId) || !this.entities.has(targetId)) {
      return null;
    }

    if (sourceId === targetId) {
      return [this.entities.get(sourceId)!];
    }

    // BFS search
    const visited = new Set<string>();
    const queue: Array<{ entity: Entity; path: Entity[] }> = [];
    
    const startEntity = this.entities.get(sourceId)!;
    queue.push({ entity: startEntity, path: [startEntity] });
    visited.add(sourceId);

    while (queue.length > 0) {
      const { entity, path } = queue.shift()!;
      
      if (path.length > maxDepth) continue;
      
      const neighbors = this.getNeighbors(entity.id);
      for (const neighbor of neighbors) {
        if (visited.has(neighbor.id)) continue;
        
        const newPath = [...path, neighbor];
        if (neighbor.id === targetId) {
          return newPath;
        }
        
        visited.add(neighbor.id);
        queue.push({ entity: neighbor, path: newPath });
      }
    }

    return null;
  }

  /**
   * Gets all neighbors of an entity
   */
  public getNeighbors(entityId: string): Entity[] {
    const relationships = this.getEntityRelationships(entityId);
    const neighborIds = new Set<string>();
    
    for (const rel of relationships) {
      if (rel.sourceId === entityId) {
        neighborIds.add(rel.targetId);
      } else {
        neighborIds.add(rel.sourceId);
      }
    }
    
    return Array.from(neighborIds)
      .map(id => this.entities.get(id))
      .filter((e): e is Entity => e !== undefined && e.active);
  }

  /**
   * Gets degree of an entity (number of relationships)
   */
  public getEntityDegree(entityId: string): number {
    return this.getEntityRelationships(entityId).length;
  }

  // ============================================================================
  // INFERENCE ENGINE
  // ============================================================================

  /**
   * Applies inference rules to a new relationship
   */
  private applyInferenceRules(relationship: Relationship): void {
    for (const rule of this.inferenceRules) {
      if (!rule.active) continue;
      
      const matches = this.evaluateRule(rule, relationship);
      if (matches && rule.confidence >= this.config.inferenceThreshold) {
        this.generateInferredRelationship(rule, relationship);
      }
    }
  }

  /**
   * Evaluates if a rule matches a relationship
   */
  private evaluateRule(rule: InferenceRule, relationship: Relationship): boolean {
    // Simplified rule evaluation
    // In production, this would be more sophisticated with pattern matching
    
    const conditions = rule.antecedent.conditions;
    for (const condition of conditions) {
      if (condition.field === 'type') {
        if (condition.operator === 'EQ') {
          if (relationship.type !== condition.value) return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Generates inferred relationships
   */
  private generateInferredRelationship(
    rule: InferenceRule,
    sourceRelationship: Relationship
  ): void {
    // Generate new relationships based on inference rules
    // This is a simplified implementation
    
    const sourceEntity = this.entities.get(sourceRelationship.sourceId);
    const targetEntity = this.entities.get(sourceRelationship.targetId);
    
    if (!sourceEntity || !targetEntity) return;
    
    // Example: If student is enrolled in course, infer they are studying the subject
    if (sourceRelationship.type === RelationshipType.ENROLLED_IN) {
      // Check if student is a student
      if (sourceEntity.type === EntityType.STUDENT) {
        // Try to find course subject
        const courseProperties = targetEntity.properties;
        const subject = courseProperties.get('subject')?.value;
        
        if (subject) {
          // Create inferred relationship: student STUDIES subject
          const subjectEntity = this.findEntitiesByName(subject, 0.9)[0];
          if (subjectEntity) {
            try {
              this.addRelationship({
                sourceId: sourceEntity.id,
                targetId: subjectEntity.id,
                type: RelationshipType.STUDIES,
                cardinality: Cardinality.MANY_TO_MANY,
                weight: rule.weight,
                metadata: {
                  confidence: rule.confidence,
                  source: 'INFERENCE_ENGINE',
                  timestamp: new Date(),
                  context: `Inferred from ${rule.name}`
                }
              });
            } catch (error) {
              // Relationship might already exist
            }
          }
        }
      }
    }
  }

  /**
   * Adds a new inference rule
   */
  public addInferenceRule(rule: Partial<InferenceRule>): InferenceRule {
    const newRule: InferenceRule = {
      id: rule.id || this.generateId(),
      name: rule.name || 'Unnamed Rule',
      description: rule.description || '',
      antecedent: rule.antecedent || { type: 'ENTITY', conditions: [] },
      consequent: rule.consequent || { type: 'ENTITY', conditions: [] },
      confidence: rule.confidence || 0.8,
      weight: rule.weight || 1.0,
      active: rule.active !== undefined ? rule.active : true,
      created: new Date()
    };
    
    this.inferenceRules.push(newRule);
    this.emit('ruleAdded', newRule);
    return newRule;
  }

  // ============================================================================
  // CONTEXTUAL INTELLIGENCE
  // ============================================================================

  /**
   * Creates an intelligence profile for a user
   */
  public createIntelligenceProfile(userId: string): IntelligenceProfile {
    const profile: IntelligenceProfile = {
      id: this.generateId(),
      userId: userId,
      interests: [],
      expertise: [],
      relationships: [],
      activityPatterns: [],
      preferences: {},
      temporalContext: {
        currentTime: new Date(),
        timezone: 'UTC',
        schedule: [],
        deadlines: [],
        availability: []
      },
      spatialContext: {
        currentLocation: {
          latitude: 0,
          longitude: 0,
          accuracy: 0,
          timestamp: new Date()
        },
        frequentlyVisited: [],
        commutePatterns: [],
        boundaries: {
          home: { latitude: 0, longitude: 0, accuracy: 0, timestamp: new Date() },
          campus: { latitude: 0, longitude: 0, accuracy: 0, timestamp: new Date() },
          city: { latitude: 0, longitude: 0, accuracy: 0, timestamp: new Date() }
        }
      },
      socialContext: {
        connections: [],
        groups: [],
        collaborations: [],
        socialActivity: []
      },
      academicContext: {
        enrolledCourses: [],
        grades: [],
        major: '',
        minor: [],
        academicYear: 1,
        gpa: 0,
        creditsEarned: 0,
        progress: {
          degree: '',
          totalCreditsRequired: 120,
          creditsCompleted: 0,
          completionPercentage: 0,
          expectedGraduation: new Date(),
          requirementsMet: [],
          requirementsPending: []
        }
      },
      updated: new Date()
    };
    
    this.profiles.set(userId, profile);
    this.emit('profileCreated', profile);
    return profile;
  }

  /**
   * Updates an intelligence profile
   */
  public updateIntelligenceProfile(
    userId: string,
    updates: Partial<IntelligenceProfile>
  ): IntelligenceProfile | null {
    const profile = this.profiles.get(userId);
    if (!profile) return null;
    
    const updated = {
      ...profile,
      ...updates,
      updated: new Date()
    };
    
    this.profiles.set(userId, updated);
    this.emit('profileUpdated', updated);
    return updated;
  }

  /**
   * Gets an intelligence profile
   */
  public getIntelligenceProfile(userId: string): IntelligenceProfile | null {
    return this.profiles.get(userId) || null;
  }

  /**
   * Generates contextual insights for a user
   */
  public generateContextualInsights(userId: string): Insight[] {
    const profile = this.profiles.get(userId);
    if (!profile) return [];
    
    const insights: Insight[] = [];
    
    // Academic insights
    insights.push(...this.generateAcademicInsights(profile));
    
    // Social insights
    insights.push(...this.generateSocialInsights(profile));
    
    // Temporal insights
    insights.push(...this.generateTemporalInsights(profile));
    
    // Spatial insights
    insights.push(...this.generateSpatialInsights(profile));
    
    // Activity insights
    insights.push(...this.generateActivityInsights(profile));
    
    // Store insights
    this.insights.push(...insights);
    this.insightHistory.push(...insights);
    
    return insights;
  }

  /**
   * Generates academic insights
   */
  private generateAcademicInsights(profile: IntelligenceProfile): Insight[] {
    const insights: Insight[] = [];
    const academic = profile.academicContext;
    
    // Check academic progress
    if (academic.progress.completionPercentage < 25) {
      insights.push({
        id: this.generateId(),
        type: InsightType.RECOMMENDATION,
        title: 'Early Academic Planning',
        description: 'Consider planning your academic path early to ensure timely graduation',
        confidence: 0.9,
        entities: [profile.userId],
        relationships: [],
        evidence: [
          `Currently ${academic.progress.creditsCompleted}/${academic.progress.totalCreditsRequired} credits completed`,
          `Expected graduation: ${academic.progress.expectedGraduation.toDateString()}`
        ],
        implications: [
          'Plan courses strategically',
          'Consider summer sessions to accelerate progress'
        ],
        recommendations: [
          'Schedule academic advising appointment',
          'Review degree requirements',
          'Plan next semester courses'
        ],
        severity: 'MEDIUM',
        category: ['ACADEMIC', 'PLANNING'],
        created: new Date(),
        metadata: {}
      });
    }
    
    // GPA insights
    if (academic.gpa < 2.0) {
      insights.push({
        id: this.generateId(),
        type: InsightType.RISK,
        title: 'Academic Warning: Low GPA',
        description: 'Current GPA is below 2.0, which may affect academic standing',
        confidence: 0.95,
        entities: [profile.userId],
        relationships: [],
        evidence: [`Current GPA: ${academic.gpa.toFixed(2)}`],
        implications: [
          'May be placed on academic probation',
          'May lose financial aid eligibility'
        ],
        recommendations: [
          'Meet with academic advisor',
          'Utilize tutoring services',
          'Reduce course load if needed'
        ],
        severity: 'HIGH',
        category: ['ACADEMIC', 'RISK'],
        created: new Date(),
        metadata: {}
      });
    }
    
    return insights;
  }

  /**
   * Generates social insights
   */
  private generateSocialInsights(profile: IntelligenceProfile): Insight[] {
    const insights: Insight[] = [];
    const social = profile.socialContext;
    
    // Check social engagement
    if (social.connections.length < 5) {
      insights.push({
        id: this.generateId(),
        type: InsightType.RECOMMENDATION,
        title: 'Build Social Network',
        description: 'Consider expanding your social connections on campus',
        confidence: 0.7,
        entities: [profile.userId],
        relationships: [],
        evidence: [`Currently has ${social.connections.length} connections`],
        implications: [
          'Stronger support network',
          'Better access to resources and opportunities'
        ],
        recommendations: [
          'Join campus clubs and organizations',
          'Attend campus events',
          'Participate in study groups'
        ],
        severity: 'LOW',
        category: ['SOCIAL', 'WELLNESS'],
        created: new Date(),
        metadata: {}
      });
    }
    
    return insights;
  }

  /**
   * Generates temporal insights
   */
  private generateTemporalInsights(profile: IntelligenceProfile): Insight[] {
    const insights: Insight[] = [];
    const temporal = profile.temporalContext;
    
    // Check for upcoming deadlines
    const now = new Date();
    const upcomingDeadlines = temporal.deadlines
      .filter(d => !d.completed)
      .filter(d => d.dueDate > now)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 3);
    
    if (upcomingDeadlines.length > 0) {
      insights.push({
        id: this.generateId(),
        type: InsightType.RISK,
        title: 'Upcoming Deadlines',
        description: `${upcomingDeadlines.length} deadline${upcomingDeadlines.length > 1 ? 's' : ''} approaching`,
        confidence: 0.9,
        entities: [profile.userId],
        relationships: [],
        evidence: upcomingDeadlines.map(d => `${d.title}: ${d.dueDate.toDateString()}`),
        implications: [
          'Time management required',
          'Potential stress from approaching deadlines'
        ],
        recommendations: [
          'Prioritize tasks',
          'Create study schedule',
          'Reach out for help if needed'
        ],
        severity: upcomingDeadlines.some(d => d.priority === 'CRITICAL') ? 'HIGH' : 'MEDIUM',
        category: ['TEMPORAL', 'DEADLINE'],
        created: new Date(),
        metadata: {}
      });
    }
    
    return insights;
  }

  /**
   * Generates spatial insights
   */
  private generateSpatialInsights(profile: IntelligenceProfile): Insight[] {
    const insights: Insight[] = [];
    const spatial = profile.spatialContext;
    
    // Check commute patterns
    if (spatial.commutePatterns.length > 0) {
      const avgDuration = spatial.commutePatterns.reduce((sum, p) => sum + p.duration, 0) / spatial.commutePatterns.length;
      if (avgDuration > 30) {
        insights.push({
          id: this.generateId(),
          type: InsightType.PATTERN,
          title: 'Long Commute Detected',
          description: 'Your average commute time is significant',
          confidence: 0.8,
          entities: [profile.userId],
          relationships: [],
          evidence: [`Average commute: ${avgDuration.toFixed(0)} minutes`],
          implications: [
            'Consider optimizing commute route',
            'Potential time and energy drain'
          ],
          recommendations: [
            'Explore carpool options',
            'Consider campus housing',
            'Adjust schedule to avoid peak traffic'
          ],
          severity: 'MEDIUM',
          category: ['SPATIAL', 'WELLNESS'],
          created: new Date(),
          metadata: {}
        });
      }
    }
    
    return insights;
  }

  /**
   * Generates activity insights
   */
  private generateActivityInsights(profile: IntelligenceProfile): Insight[] {
    const insights: Insight[] = [];
    const patterns = profile.activityPatterns;
    
    // Analyze activity patterns
    for (const pattern of patterns) {
      if (pattern.frequency > 5 && pattern.confidence > 0.8) {
        insights.push({
          id: this.generateId(),
          type: InsightType.PATTERN,
          title: `Recurring Activity: ${pattern.pattern}`,
          description: `You frequently engage in ${pattern.pattern} activities`,
          confidence: pattern.confidence,
          entities: [...pattern.entities, profile.userId],
          relationships: pattern.relationships.map(id => id),
          evidence: [
            `Frequency: ${pattern.frequency} times per ${pattern.recurrence.toLowerCase()}`
          ],
          implications: [
            'Established routine',
            'Potential area of strength or interest'
          ],
          recommendations: [
            'Consider building on this pattern',
            'Connect with others who share similar patterns'
          ],
          severity: 'LOW',
          category: ['ACTIVITY', 'PATTERN'],
          created: new Date(),
          metadata: {}
        });
      }
    }
    
    return insights;
  }

  // ============================================================================
  // SEMANTIC SEARCH AND REASONING
  // ============================================================================

  /**
   * Executes a semantic search query
   */
  public semanticSearch(query: string, context: QueryContext): QueryResult {
    // Convert query to embedding
    const queryEmbedding = this.generateTextEmbedding(query);
    
    // Find similar entities
    const similarEntities = this.findSimilarEntities(queryEmbedding, 10);
    
    // Generate insights
    const insights = this.generateInsightsFromEntities(similarEntities, context);
    
    // Build result
    return {
      id: this.generateId(),
      entities: similarEntities,
      relationships: this.getEntityRelationshipsBatch(similarEntities.map(e => e.id)),
      insights: insights,
      confidence: 0.8,
      explanation: 'Semantic similarity search based on query embedding',
      timestamp: new Date(),
      metadata: {
        query: query,
        context: context
      }
    };
  }

  /**
   * Generates text embedding (simplified)
   */
  private generateTextEmbedding(text: string): number[] {
    // Simplified embedding generation
    // In production, use a proper embedding model (e.g., BERT, Word2Vec)
    const dimension = this.config.embeddingDimension;
    const embedding = new Array(dimension).fill(0);
    
    // Simple hash-based embedding
    const words = text.split(' ');
    for (const word of words) {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i);
        hash = hash & hash;
      }
      const index = Math.abs(hash) % dimension;
      embedding[index] += 1;
    }
    
    // Normalize
    const sum = embedding.reduce((a, b) => a + b * b, 0);
    if (sum > 0) {
      const norm = Math.sqrt(sum);
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }
    
    return embedding;
  }

  /**
   * Finds similar entities based on embedding
   */
  private findSimilarEntities(embedding: number[], limit: number): Entity[] {
    const results: Array<{ entity: Entity; similarity: number }> = [];
    
    for (const entity of this.entities.values()) {
      if (!entity.active) continue;
      
      // Get or generate entity embedding
      let entityEmbedding = this.embeddings.get(entity.id);
      if (!entityEmbedding) {
        // Generate from entity properties
        const text = `${entity.name} ${entity.type} ${entity.description || ''}`;
        entityEmbedding = {
          id: this.generateId(),
          entityId: entity.id,
          vector: this.generateTextEmbedding(text),
          dimension: this.config.embeddingDimension,
          model: 'simple',
          created: new Date()
        };
        this.embeddings.set(entity.id, entityEmbedding);
      }
      
      const similarity = this.cosineSimilarity(embedding, entityEmbedding.vector);
      if (similarity > this.config.similarityThreshold) {
        results.push({ entity, similarity });
      }
    }
    
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(r => r.entity);
  }

  /**
   * Calculates cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Calculates string similarity (Levenshtein distance based)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0;
    
    // Levenshtein distance
    const matrix: number[][] = [];
    for (let i = 0; i <= s1.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= s2.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + 1
          );
        }
      }
    }
    
    const distance = matrix[s1.length][s2.length];
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - (distance / maxLength);
  }

  /**
   * Generates insights from entities
   */
  private generateInsightsFromEntities(entities: Entity[], context: QueryContext): Insight[] {
    const insights: Insight[] = [];
    
    // Group entities by type
    const entityGroups = new Map<EntityType, Entity[]>();
    for (const entity of entities) {
      if (!entityGroups.has(entity.type)) {
        entityGroups.set(entity.type, []);
      }
      entityGroups.get(entity.type)!.push(entity);
    }
    
    // Generate insights for each group
    for (const [type, entitiesOfType] of entityGroups) {
      if (entitiesOfType.length > 1) {
        insights.push({
          id: this.generateId(),
          type: InsightType.PATTERN,
          title: `Multiple ${type}s Found`,
          description: `Found ${entitiesOfType.length} entities of type ${type}`,
          confidence: 0.7,
          entities: entitiesOfType.map(e => e.id),
          relationships: [],
          evidence: entitiesOfType.map(e => `- ${e.name}`),
          implications: [
            `Potential relationship between these ${type}s`
          ],
          recommendations: [
            `Explore connections between these ${type}s`
          ],
          severity: 'LOW',
          category: ['SEMANTIC', 'PATTERN'],
          created: new Date(),
          metadata: {}
        });
      }
    }
    
    return insights;
  }

  /**
   * Gets relationships for multiple entities
   */
  private getEntityRelationshipsBatch(entityIds: string[]): Relationship[] {
    const result: Relationship[] = [];
    const seen = new Set<string>();
    
    for (const id of entityIds) {
      const rels = this.getEntityRelationships(id);
      for (const rel of rels) {
        if (!seen.has(rel.id)) {
          seen.add(rel.id);
          result.push(rel);
        }
      }
    }
    
    return result;
  }

  // ============================================================================
  // KNOWLEDGE GRAPH ANALYTICS
  // ============================================================================

  /**
   * Updates graph statistics
   */
  private updateStatistics(): void {
    this.statistics.totalEntities = this.entities.size;
    this.statistics.totalRelationships = this.relationships.size;
    this.statistics.lastUpdated = new Date();
    
    // Entity type distribution
    const entityTypeDist = new Map<EntityType, number>();
    for (const entity of this.entities.values()) {
      const count = entityTypeDist.get(entity.type) || 0;
      entityTypeDist.set(entity.type, count + 1);
    }
    this.statistics.entityTypeDistribution = entityTypeDist;
    
    // Relationship type distribution
    const relTypeDist = new Map<RelationshipType, number>();
    for (const rel of this.relationships.values()) {
      const count = relTypeDist.get(rel.type) || 0;
      relTypeDist.set(rel.type, count + 1);
    }
    this.statistics.relationshipTypeDistribution = relTypeDist;
    
    // Calculate average degree
    let totalDegree = 0;
    for (const entity of this.entities.values()) {
      totalDegree += this.getEntityDegree(entity.id);
    }
    this.statistics.averageDegree = totalDegree / Math.max(1, this.entities.size);
    
    // Calculate density
    const n = this.entities.size;
    const maxEdges = n * (n - 1) / 2;
    this.statistics.density = maxEdges > 0 ? this.relationships.size / maxEdges : 0;
  }

  /**
   * Gets graph statistics
   */
  public getStatistics(): GraphStatistics {
    this.updateStatistics();
    return { ...this.statistics };
  }

  /**
   * Gets the most connected entities
   */
  public getMostConnectedEntities(limit: number = 10): Array<{ entity: Entity; degree: number }> {
    const degrees: Array<{ entity: Entity; degree: number }> = [];
    
    for (const entity of this.entities.values()) {
      if (!entity.active) continue;
      degrees.push({
        entity,
        degree: this.getEntityDegree(entity.id)
      });
    }
    
    return degrees
      .sort((a, b) => b.degree - a.degree)
      .slice(0, limit);
  }

  /**
   * Gets entity clusters
   */
  public getEntityClusters(minSize: number = 3): Array<Entity[]> {
    const visited = new Set<string>();
    const clusters: Entity[][] = [];
    
    for (const entity of this.entities.values()) {
      if (!entity.active || visited.has(entity.id)) continue;
      
      const cluster = this.getConnectedComponent(entity.id);
      if (cluster.length >= minSize) {
        clusters.push(cluster);
      }
      
      for (const e of cluster) {
        visited.add(e.id);
      }
    }
    
    return clusters.sort((a, b) => b.length - a.length);
  }

  /**
   * Gets connected component for an entity
   */
  private getConnectedComponent(startId: string): Entity[] {
    const visited = new Set<string>();
    const queue: string[] = [startId];
    const component: Entity[] = [];
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      
      const entity = this.entities.get(currentId);
      if (!entity || !entity.active) continue;
      
      visited.add(currentId);
      component.push(entity);
      
      const neighbors = this.getNeighbors(currentId);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.id)) {
          queue.push(neighbor.id);
        }
      }
    }
    
    return component;
  }

  // ============================================================================
  // RECOMMENDATION ENGINE
  // ============================================================================

  /**
   * Generates recommendations for a user
   */
  public generateRecommendations(
    userId: string,
    type: 'COURSE' | 'RESOURCE' | 'EVENT' | 'CONNECTION' | 'GENERAL',
    limit: number = 10
  ): any[] {
    const profile = this.profiles.get(userId);
    if (!profile) return [];
    
    switch (type) {
      case 'COURSE':
        return this.recommendCourses(profile, limit);
      case 'RESOURCE':
        return this.recommendResources(profile, limit);
      case 'EVENT':
        return this.recommendEvents(profile, limit);
      case 'CONNECTION':
        return this.recommendConnections(profile, limit);
      default:
        return this.recommendGeneral(profile, limit);
    }
  }

  /**
   * Recommends courses based on profile
   */
  private recommendCourses(profile: IntelligenceProfile, limit: number): any[] {
    const recommendations: any[] = [];
    const academic = profile.academicContext;
    
    // Find courses related to major
    const majorCourses = this.findEntitiesByProperty('major', academic.major);
    
    // Find courses not yet taken
    const takenCourseIds = new Set(academic.enrolledCourses.map(c => c.id));
    const availableCourses = majorCourses.filter(c => !takenCourseIds.has(c.id));
    
    // Score recommendations
    for (const course of availableCourses) {
      let score = 0.5;
      
      // Check prerequisites
      const prerequisites = course.properties.get('prerequisites')?.value || [];
      const hasPrereqs = prerequisites.every((p: string) => takenCourseIds.has(p));
      if (hasPrereqs) score += 0.3;
      
      // Check schedule compatibility
      const schedule = course.properties.get('schedule')?.value;
      if (schedule) {
        // Simplified schedule check
        score += 0.2;
      }
      
      recommendations.push({
        entity: course,
        score: score,
        reason: hasPrereqs ? 'Prerequisites satisfied' : 'Interest alignment'
      });
    }
    
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Recommends resources based on profile
   */
  private recommendResources(profile: IntelligenceProfile, limit: number): any[] {
    const recommendations: any[] = [];
    const academic = profile.academicContext;
    
    // Find resources related to enrolled courses
    for (const course of academic.enrolledCourses) {
      const resources = this.findEntitiesByProperty('courseId', course.id);
      for (const resource of resources) {
        recommendations.push({
          entity: resource,
          score: 0.7,
          reason: `Related to ${course.title}`
        });
      }
    }
    
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Recommends events based on profile
   */
  private recommendEvents(profile: IntelligenceProfile, limit: number): any[] {
    const recommendations: any[] = [];
    
    // Find upcoming events
    const events = this.findEntitiesByType(EntityType.EVENT);
    const now = new Date();
    
    for (const event of events) {
      const eventDate = event.properties.get('date')?.value;
      if (!eventDate) continue;
      
      const date = new Date(eventDate);
      if (date < now) continue;
      
      let score = 0.3;
      const daysUntil = Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      if (daysUntil < 7) score += 0.3;
      if (daysUntil < 3) score += 0.2;
      
      // Check interest match
      const tags = event.metadata.tags || [];
      const interestMatch = tags.some(tag => profile.interests.includes(tag));
      if (interestMatch) score += 0.2;
      
      recommendations.push({
        entity: event,
        score: score,
        reason: interestMatch ? 'Matches your interests' : 'Upcoming event'
      });
    }
    
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Recommends connections based on profile
   */
  private recommendConnections(profile: IntelligenceProfile, limit: number): any[] {
    const recommendations: any[] = [];
    const social = profile.socialContext;
    const existingConnections = new Set(social.connections.map(c => c.userId));
    
    // Find potential connections
    // 1. People in same courses
    const academic = profile.academicContext;
    for (const course of academic.enrolledCourses) {
      const students = this.findEntitiesByProperty('courseId', course.id);
      for (const student of students) {
        if (student.id === profile.userId) continue;
        if (existingConnections.has(student.id)) continue;
        
        recommendations.push({
          entity: student,
          score: 0.6,
          reason: `Same course: ${course.title}`
        });
      }
    }
    
    // 2. People with similar interests
    for (const entity of this.entities.values()) {
      if (entity.id === profile.userId) continue;
      if (existingConnections.has(entity.id)) continue;
      
      const tags = entity.metadata.tags || [];
      const commonInterests = tags.filter(tag => profile.interests.includes(tag));
      if (commonInterests.length > 0) {
        recommendations.push({
          entity: entity,
          score: 0.5 + (commonInterests.length * 0.1),
          reason: `Shared interests: ${commonInterests.join(', ')}`
        });
      }
    }
    
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * General recommendations
   */
  private recommendGeneral(profile: IntelligenceProfile, limit: number): any[] {
    // Combine all recommendations
    const allRecommendations = [
      ...this.recommendCourses(profile, 3),
      ...this.recommendResources(profile, 3),
      ...this.recommendEvents(profile, 2),
      ...this.recommendConnections(profile, 2)
    ];
    
    return allRecommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ============================================================================
  // EVENT SYSTEM
  // ============================================================================

  /**
   * Registers an event listener
   */
  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Emits an event
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (!listeners) return;
    
    for (const listener of listeners) {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Generates a unique ID
   */
  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Validates an entity
   */
  public validateEntity(entity: Entity): string[] {
    const errors: string[] = [];
    
    if (!entity.id) errors.push('Entity ID is required');
    if (!entity.type) errors.push('Entity type is required');
    if (!entity.name) errors.push('Entity name is required');
    
    return errors;
  }

  /**
   * Validates a relationship
   */
  public validateRelationship(relationship: Relationship): string[] {
    const errors: string[] = [];
    
    if (!relationship.id) errors.push('Relationship ID is required');
    if (!relationship.sourceId) errors.push('Source entity ID is required');
    if (!relationship.targetId) errors.push('Target entity ID is required');
    if (!relationship.type) errors.push('Relationship type is required');
    
    return errors;
  }

  /**
   * Exports the knowledge graph to JSON
   */
  public exportGraph(): any {
    return {
      entities: Array.from(this.entities.values()),
      relationships: Array.from(this.relationships.values()),
      statistics: this.statistics,
      insights: this.insights,
      timestamp: new Date()
    };
  }

  /**
   * Imports a knowledge graph from JSON
   */
  public importGraph(data: any): void {
    // Clear existing data
    this.entities.clear();
    this.relationships.clear();
    this.entityRelationships.clear();
    this.inverseRelationships.clear();
    
    // Import entities
    for (const entity of data.entities) {
      entity.properties = new Map(entity.properties);
      this.entities.set(entity.id, entity);
    }
    
    // Import relationships
    for (const rel of data.relationships) {
      rel.properties = new Map(rel.properties);
      this.relationships.set(rel.id, rel);
      
      // Update indices
      if (!this.entityRelationships.has(rel.sourceId)) {
        this.entityRelationships.set(rel.sourceId, []);
      }
      this.entityRelationships.get(rel.sourceId)!.push(rel.id);
      
      if (!this.inverseRelationships.has(rel.targetId)) {
        this.inverseRelationships.set(rel.targetId, []);
      }
      this.inverseRelationships.get(rel.targetId)!.push(rel.id);
    }
    
    this.updateStatistics();
    this.emit('graphImported', data);
  }

  /**
   * Performs maintenance on the knowledge graph
   */
  public performMaintenance(): void {
    // Remove inactive entities
    for (const [id, entity] of this.entities) {
      if (!entity.active) {
        this.deleteEntity(id);
      }
    }
    
    // Remove inactive relationships
    for (const [id, rel] of this.relationships) {
      if (!rel.active) {
        this.deleteRelationship(id);
      }
    }
    
    // Clean up old insights
    const now = new Date();
    this.insights = this.insights.filter(i => {
      const age = (now.getTime() - i.created.getTime()) / (24 * 60 * 60 * 1000);
      return age < 30; // Keep insights younger than 30 days
    });
    
    // Update statistics
    this.updateStatistics();
    this.lastMaintenance = now;
    
    this.emit('maintenanceCompleted', {
      timestamp: now,
      entities: this.entities.size,
      relationships: this.relationships.size
    });
  }

  /**
   * Gets system health
   */
  public getHealth(): any {
    return {
      initialized: this.isInitialized,
      entities: this.entities.size,
      relationships: this.relationships.size,
      profiles: this.profiles.size,
      insights: this.insights.length,
      inferenceRules: this.inferenceRules.length,
      embeddings: this.embeddings.size,
      lastMaintenance: this.lastMaintenance,
      statistics: this.statistics,
      uptime: this.isInitialized ? process.uptime() : 0
    };
  }

  /**
   * Initializes the engine
   */
  public initialize(): void {
    if (this.isInitialized) return;
    
    this.isInitialized = true;
    this.updateStatistics();
    this.emit('initialized', { timestamp: new Date() });
  }

  /**
   * Shuts down the engine
   */
  public shutdown(): void {
    if (!this.isInitialized) return;
    
    this.performMaintenance();
    this.isInitialized = false;
    this.emit('shutdown', { timestamp: new Date() });
  }
}

// ============================================================================
// EXPORT MODULE
// ============================================================================

export default CampusKnowledgeGraphEngine;
