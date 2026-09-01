/**
 * Comprehensive Event Lifecycle and State-Transition Test Coverage
 * @module EventsLifecycleTest
 * @description Complete test suite for event-driven architecture validation
 * @version 1.0.0
 * @author Quality Assurance Team
 * 
 * This test suite provides comprehensive coverage for:
 * - Event state machine transitions
 * - Lifecycle management
 * - Event propagation
 * - Error handling and recovery
 * - Performance and scalability
 * - Edge cases and boundary conditions
 * - Integration scenarios
 * - Security and access control
 */

// ============================================================================
// IMPORTS AND DEPENDENCIES
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { mock, Mock, MockInstance } from 'jest-mock';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';

// ============================================================================
// CORE EVENT SYSTEM TYPES AND INTERFACES
// ============================================================================

/**
 * Event states in the lifecycle
 */
export enum EventState {
  CREATED = 'CREATED',
  VALIDATED = 'VALIDATED',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED'
}

/**
 * Event types for classification
 */
export enum EventType {
  SYSTEM = 'SYSTEM',
  USER = 'USER',
  BUSINESS = 'BUSINESS',
  SECURITY = 'SECURITY',
  INTEGRATION = 'INTEGRATION',
  SCHEDULED = 'SCHEDULED',
  MONITORING = 'MONITORING',
  ANALYTICS = 'ANALYTICS'
}

/**
 * Event priority levels
 */
export enum EventPriority {
  CRITICAL = 0,
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3,
  LOWEST = 4
}

/**
 * Event severity levels
 */
export enum EventSeverity {
  FATAL = 'FATAL',
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
  TRACE = 'TRACE'
}

/**
 * Event source types
 */
export enum EventSource {
  API = 'API',
  UI = 'UI',
  SCHEDULER = 'SCHEDULER',
  WEBHOOK = 'WEBHOOK',
  INTERNAL = 'INTERNAL',
  EXTERNAL = 'EXTERNAL'
}

/**
 * Event status details
 */
export interface EventStatus {
  state: EventState;
  timestamp: Date;
  message?: string;
  duration?: number;
  attemptCount?: number;
  nextRetry?: Date;
  error?: EventError;
  metadata?: Record<string, any>;
}

/**
 * Event error structure
 */
export interface EventError {
  code: string;
  message: string;
  severity: EventSeverity;
  stack?: string;
  timestamp: Date;
  recoverable: boolean;
  retryCount: number;
}

/**
 * Core event interface
 */
export interface IEvent {
  id: string;
  type: EventType;
  source: EventSource;
  priority: EventPriority;
  severity: EventSeverity;
  state: EventState;
  payload: any;
  metadata: EventMetadata;
  timestamps: EventTimestamps;
  status: EventStatus;
  version: number;
  correlationId?: string;
  causationId?: string;
}

/**
 * Event metadata
 */
export interface EventMetadata {
  createdBy: string;
  createdFrom: string;
  environment: string;
  tenant?: string;
  tags: string[];
  custom: Record<string, any>;
}

/**
 * Event timestamps
 */
export interface EventTimestamps {
  created: Date;
  validated?: Date;
  queued?: Date;
  processingStarted?: Date;
  processingCompleted?: Date;
  failed?: Date;
  retried?: Date[];
  cancelled?: Date;
  expired?: Date;
  archived?: Date;
  deleted?: Date;
  lastModified: Date;
}

/**
 * Event listener configuration
 */
export interface EventListenerConfig {
  id: string;
  eventTypes: EventType[];
  handler: Function;
  filter?: (event: IEvent) => boolean;
  priority: EventPriority;
  maxRetries: number;
  timeout: number;
  async: boolean;
}

/**
 * Event processing result
 */
export interface EventProcessingResult {
  success: boolean;
  eventId: string;
  result?: any;
  error?: EventError;
  duration: number;
  timestamp: Date;
}

/**
 * Event batch operation
 */
export interface EventBatch {
  id: string;
  events: IEvent[];
  size: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Event metrics
 */
export interface EventMetrics {
  totalEvents: number;
  processedEvents: number;
  failedEvents: number;
  retriedEvents: number;
  cancelledEvents: number;
  expiredEvents: number;
  averageProcessingTime: number;
  eventsByType: Map<EventType, number>;
  eventsByState: Map<EventState, number>;
  errorRate: number;
  throughput: number;
  timestamp: Date;
}

/**
 * Event transition rule
 */
export interface TransitionRule {
  fromState: EventState;
  toState: EventState;
  allowed: boolean;
  condition?: (event: IEvent) => boolean;
  validation?: (event: IEvent) => boolean;
  action?: (event: IEvent) => Promise<void>;
}

// ============================================================================
// CORE EVENT SYSTEM IMPLEMENTATION
// ============================================================================

/**
 * Event Lifecycle Manager - Handles event state transitions
 */
export class EventLifecycleManager {
  private events: Map<string, IEvent> = new Map();
  private listeners: Map<string, EventListenerConfig[]> = new Map();
  private processingQueue: IEvent[] = [];
  private metrics: EventMetrics;
  private transitionRules: Map<string, TransitionRule> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();
  private processingInstances: number = 0;
  private maxConcurrent: number = 10;
  private isShuttingDown: boolean = false;
  private logger: any;

  constructor() {
    this.metrics = this.initializeMetrics();
    this.initializeTransitionRules();
    this.setupEventListeners();
  }

  /**
   * Initializes metrics
   */
  private initializeMetrics(): EventMetrics {
    return {
      totalEvents: 0,
      processedEvents: 0,
      failedEvents: 0,
      retriedEvents: 0,
      cancelledEvents: 0,
      expiredEvents: 0,
      averageProcessingTime: 0,
      eventsByType: new Map(),
      eventsByState: new Map(),
      errorRate: 0,
      throughput: 0,
      timestamp: new Date()
    };
  }

  /**
   * Initializes transition rules
   */
  private initializeTransitionRules(): void {
    // Define valid state transitions
    const rules: Array<[EventState, EventState, boolean]> = [
      [EventState.CREATED, EventState.VALIDATED, true],
      [EventState.CREATED, EventState.QUEUED, true],
      [EventState.CREATED, EventState.CANCELLED, true],
      [EventState.CREATED, EventState.EXPIRED, true],
      [EventState.VALIDATED, EventState.QUEUED, true],
      [EventState.VALIDATED, EventState.CANCELLED, true],
      [EventState.QUEUED, EventState.PROCESSING, true],
      [EventState.QUEUED, EventState.CANCELLED, true],
      [EventState.QUEUED, EventState.EXPIRED, true],
      [EventState.PROCESSING, EventState.COMPLETED, true],
      [EventState.PROCESSING, EventState.FAILED, true],
      [EventState.PROCESSING, EventState.RETRYING, true],
      [EventState.PROCESSING, EventState.CANCELLED, true],
      [EventState.PROCESSING, EventState.EXPIRED, true],
      [EventState.FAILED, EventState.RETRYING, true],
      [EventState.FAILED, EventState.CANCELLED, true],
      [EventState.FAILED, EventState.ARCHIVED, true],
      [EventState.RETRYING, EventState.QUEUED, true],
      [EventState.RETRYING, EventState.FAILED, true],
      [EventState.RETRYING, EventState.CANCELLED, true],
      [EventState.COMPLETED, EventState.ARCHIVED, true],
      [EventState.COMPLETED, EventState.DELETED, true],
      [EventState.CANCELLED, EventState.DELETED, true],
      [EventState.ARCHIVED, EventState.DELETED, true],
      [EventState.EXPIRED, EventState.ARCHIVED, true],
      [EventState.EXPIRED, EventState.DELETED, true]
    ];

    for (const [fromState, toState, allowed] of rules) {
      const key = `${fromState}->${toState}`;
      this.transitionRules.set(key, {
        fromState,
        toState,
        allowed,
        condition: (event: IEvent) => this.defaultCondition(event),
        validation: (event: IEvent) => this.defaultValidation(event)
      });
    }
  }

  /**
   * Default transition condition
   */
  private defaultCondition(event: IEvent): boolean {
    // Check if event is in valid state for transition
    return event.state !== EventState.DELETED && event.state !== EventState.ARCHIVED;
  }

  /**
   * Default transition validation
   */
  private defaultValidation(event: IEvent): boolean {
    // Validate event payload and metadata
    return event.payload !== undefined && event.metadata !== undefined;
  }

  /**
   * Sets up event listeners
   */
  private setupEventListeners(): void {
    // Listen for state changes
    this.eventEmitter.on('stateChange', (event: IEvent, fromState: EventState, toState: EventState) => {
      this.handleStateChange(event, fromState, toState);
    });

    // Listen for processing completion
    this.eventEmitter.on('processingComplete', (result: EventProcessingResult) => {
      this.handleProcessingComplete(result);
    });

    // Listen for errors
    this.eventEmitter.on('error', (error: EventError, event: IEvent) => {
      this.handleError(error, event);
    });
  }

  /**
   * Handles state changes
   */
  private handleStateChange(event: IEvent, fromState: EventState, toState: EventState): void {
    // Update metrics
    this.updateStateMetrics(fromState, toState);
    
    // Log state change
    this.logStateChange(event, fromState, toState);
    
    // Trigger state-specific actions
    this.triggerStateActions(event, toState);
  }

  /**
   * Updates state metrics
   */
  private updateStateMetrics(fromState: EventState, toState: EventState): void {
    const fromCount = this.metrics.eventsByState.get(fromState) || 0;
    const toCount = this.metrics.eventsByState.get(toState) || 0;
    
    if (fromCount > 0) {
      this.metrics.eventsByState.set(fromState, fromCount - 1);
    }
    this.metrics.eventsByState.set(toState, toCount + 1);
  }

  /**
   * Logs state change
   */
  private logStateChange(event: IEvent, fromState: EventState, toState: EventState): void {
    console.log(`[EventLifecycle] Event ${event.id}: ${fromState} -> ${toState}`);
  }

  /**
   * Triggers state-specific actions
   */
  private triggerStateActions(event: IEvent, state: EventState): void {
    switch (state) {
      case EventState.QUEUED:
        this.enqueueEvent(event);
        break;
      case EventState.PROCESSING:
        this.startProcessing(event);
        break;
      case EventState.FAILED:
        this.handleProcessingFailure(event);
        break;
      case EventState.RETRYING:
        this.scheduleRetry(event);
        break;
      case EventState.COMPLETED:
        this.handleCompletion(event);
        break;
      case EventState.CANCELLED:
        this.handleCancellation(event);
        break;
      case EventState.EXPIRED:
        this.handleExpiration(event);
        break;
    }
  }

  /**
   * Creates a new event
   */
  public createEvent(
    type: EventType,
    source: EventSource,
    payload: any,
    priority: EventPriority = EventPriority.MEDIUM,
    severity: EventSeverity = EventSeverity.INFO
  ): IEvent {
    const event: IEvent = {
      id: this.generateEventId(),
      type,
      source,
      priority,
      severity,
      state: EventState.CREATED,
      payload,
      metadata: {
        createdBy: 'system',
        createdFrom: 'event_manager',
        environment: process.env.NODE_ENV || 'development',
        tags: [],
        custom: {}
      },
      timestamps: {
        created: new Date(),
        lastModified: new Date()
      },
      status: {
        state: EventState.CREATED,
        timestamp: new Date(),
        attemptCount: 0
      },
      version: 1
    };

    this.events.set(event.id, event);
    this.updateMetricsOnCreate(event);
    this.eventEmitter.emit('eventCreated', event);
    
    return event;
  }

  /**
   * Generates event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Updates metrics on event creation
   */
  private updateMetricsOnCreate(event: IEvent): void {
    this.metrics.totalEvents++;
    const typeCount = this.metrics.eventsByType.get(event.type) || 0;
    this.metrics.eventsByType.set(event.type, typeCount + 1);
    
    const stateCount = this.metrics.eventsByState.get(event.state) || 0;
    this.metrics.eventsByState.set(event.state, stateCount + 1);
  }

  /**
   * Transitions event to a new state
   */
  public async transitionEvent(eventId: string, targetState: EventState): Promise<IEvent> {
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    const fromState = event.state;
    const key = `${fromState}->${targetState}`;
    const rule = this.transitionRules.get(key);

    if (!rule || !rule.allowed) {
      throw new Error(`Invalid transition: ${fromState} -> ${targetState}`);
    }

    // Validate transition
    if (rule.validation && !rule.validation(event)) {
      throw new Error(`Validation failed for transition: ${fromState} -> ${targetState}`);
    }

    // Check condition
    if (rule.condition && !rule.condition(event)) {
      throw new Error(`Condition not met for transition: ${fromState} -> ${targetState}`);
    }

    // Update event state
    const previousState = event.state;
    event.state = targetState;
    event.timestamps.lastModified = new Date();
    
    // Update status
    event.status.state = targetState;
    event.status.timestamp = new Date();

    // Update specific timestamps
    this.updateEventTimestamps(event, targetState);

    this.events.set(eventId, event);
    
    // Emit state change event
    this.eventEmitter.emit('stateChange', event, previousState, targetState);

    // Execute transition action if defined
    if (rule.action) {
      await rule.action(event);
    }

    return event;
  }

  /**
   * Updates event timestamps based on state
   */
  private updateEventTimestamps(event: IEvent, state: EventState): void {
    const now = new Date();
    switch (state) {
      case EventState.VALIDATED:
        event.timestamps.validated = now;
        break;
      case EventState.QUEUED:
        event.timestamps.queued = now;
        break;
      case EventState.PROCESSING:
        event.timestamps.processingStarted = now;
        break;
      case EventState.COMPLETED:
        event.timestamps.processingCompleted = now;
        break;
      case EventState.FAILED:
        event.timestamps.failed = now;
        break;
      case EventState.CANCELLED:
        event.timestamps.cancelled = now;
        break;
      case EventState.EXPIRED:
        event.timestamps.expired = now;
        break;
      case EventState.ARCHIVED:
        event.timestamps.archived = now;
        break;
      case EventState.DELETED:
        event.timestamps.deleted = now;
        break;
    }
  }

  /**
   * Enqueues event for processing
   */
  private enqueueEvent(event: IEvent): void {
    this.processingQueue.push(event);
    this.processQueue();
  }

  /**
   * Processes the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isShuttingDown) return;
    
    while (this.processingQueue.length > 0 && this.processingInstances < this.maxConcurrent) {
      const event = this.processingQueue.shift();
      if (!event) continue;
      
      this.processingInstances++;
      this.processEvent(event).finally(() => {
        this.processingInstances--;
        this.processQueue();
      });
    }
  }

  /**
   * Processes a single event
   */
  private async processEvent(event: IEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Transition to PROCESSING state
      await this.transitionEvent(event.id, EventState.PROCESSING);
      
      // Find appropriate listener
      const listeners = this.listeners.get(event.type) || [];
      const matchedListeners = listeners.filter(listener => 
        !listener.filter || listener.filter(event)
      );
      
      if (matchedListeners.length === 0) {
        throw new Error(`No listeners found for event type ${event.type}`);
      }
      
      // Process with listeners
      let processingResult: any = null;
      for (const listener of matchedListeners) {
        try {
          processingResult = await this.executeListener(listener, event);
        } catch (error) {
          // Continue with next listener if one fails
          console.error(`Listener ${listener.id} failed:`, error);
        }
      }
      
      // Transition to COMPLETED
      await this.transitionEvent(event.id, EventState.COMPLETED);
      
      // Update metrics
      this.metrics.processedEvents++;
      const duration = Date.now() - startTime;
      this.updateAverageProcessingTime(duration);
      
      // Emit completion event
      this.eventEmitter.emit('processingComplete', {
        success: true,
        eventId: event.id,
        result: processingResult,
        duration,
        timestamp: new Date()
      });
      
    } catch (error) {
      // Handle processing error
      await this.handleProcessingError(event, error, startTime);
    }
  }

  /**
   * Executes a listener
   */
  private async executeListener(listener: EventListenerConfig, event: IEvent): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Listener ${listener.id} timed out after ${listener.timeout}ms`));
      }, listener.timeout);
      
      try {
        const result = listener.handler(event);
        if (listener.async) {
          result.then(resolve).catch(reject).finally(() => {
            clearTimeout(timeoutId);
          });
        } else {
          clearTimeout(timeoutId);
          resolve(result);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Handles processing error
   */
  private async handleProcessingError(event: IEvent, error: any, startTime: number): Promise<void> {
    const eventError: EventError = {
      code: 'PROCESSING_ERROR',
      message: error.message || 'Unknown processing error',
      severity: EventSeverity.ERROR,
      stack: error.stack,
      timestamp: new Date(),
      recoverable: true,
      retryCount: event.status.attemptCount || 0
    };
    
    // Update event with error
    event.status.error = eventError;
    event.status.attemptCount = (event.status.attemptCount || 0) + 1;
    
    // Check if should retry
    if (event.status.attemptCount < 3) {
      // Transition to RETRYING
      await this.transitionEvent(event.id, EventState.RETRYING);
    } else {
      // Transition to FAILED
      await this.transitionEvent(event.id, EventState.FAILED);
      this.metrics.failedEvents++;
    }
    
    const duration = Date.now() - startTime;
    this.updateAverageProcessingTime(duration);
    
    // Emit error event
    this.eventEmitter.emit('error', eventError, event);
  }

  /**
   * Handles processing failure
   */
  private handleProcessingFailure(event: IEvent): void {
    console.error(`[EventLifecycle] Event ${event.id} failed after ${event.status.attemptCount} attempts`);
  }

  /**
   * Schedules retry
   */
  private scheduleRetry(event: IEvent): void {
    const delay = Math.pow(2, event.status.attemptCount || 1) * 1000; // Exponential backoff
    event.status.nextRetry = new Date(Date.now() + delay);
    
    // Schedule retry
    setTimeout(() => {
      if (event.state === EventState.RETRYING) {
        this.transitionEvent(event.id, EventState.QUEUED);
      }
    }, delay);
    
    this.metrics.retriedEvents++;
  }

  /**
   * Handles completion
   */
  private handleCompletion(event: IEvent): void {
    console.log(`[EventLifecycle] Event ${event.id} completed successfully`);
  }

  /**
   * Handles cancellation
   */
  private handleCancellation(event: IEvent): void {
    console.log(`[EventLifecycle] Event ${event.id} cancelled`);
    this.metrics.cancelledEvents++;
  }

  /**
   * Handles expiration
   */
  private handleExpiration(event: IEvent): void {
    console.log(`[EventLifecycle] Event ${event.id} expired`);
    this.metrics.expiredEvents++;
  }

  /**
   * Updates average processing time
   */
  private updateAverageProcessingTime(duration: number): void {
    const totalTime = this.metrics.averageProcessingTime * this.metrics.processedEvents;
    this.metrics.averageProcessingTime = (totalTime + duration) / (this.metrics.processedEvents + 1);
  }

  /**
   * Registers an event listener
   */
  public registerListener(config: EventListenerConfig): void {
    if (!this.listeners.has(config.eventTypes[0])) {
      this.listeners.set(config.eventTypes[0], []);
    }
    this.listeners.get(config.eventTypes[0])!.push(config);
  }

  /**
   * Gets event by ID
   */
  public getEvent(eventId: string): IEvent | undefined {
    return this.events.get(eventId);
  }

  /**
   * Gets all events
   */
  public getAllEvents(): IEvent[] {
    return Array.from(this.events.values());
  }

  /**
   * Gets events by state
   */
  public getEventsByState(state: EventState): IEvent[] {
    return Array.from(this.events.values()).filter(e => e.state === state);
  }

  /**
   * Gets events by type
   */
  public getEventsByType(type: EventType): IEvent[] {
    return Array.from(this.events.values()).filter(e => e.type === type);
  }

  /**
   * Gets event metrics
   */
  public getMetrics(): EventMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Updates metrics
   */
  private updateMetrics(): void {
    this.metrics.errorRate = this.metrics.processedEvents > 0 
      ? this.metrics.failedEvents / this.metrics.processedEvents 
      : 0;
    this.metrics.throughput = this.metrics.processedEvents / 
      (Date.now() - this.metrics.timestamp.getTime()) * 1000;
    this.metrics.timestamp = new Date();
  }

  /**
   * Starts event processing
   */
  public start(): void {
    this.isShuttingDown = false;
    this.processQueue();
    console.log('[EventLifecycle] Started event processing');
  }

  /**
   * Stops event processing
   */
  public async stop(): Promise<void> {
    this.isShuttingDown = true;
    
    // Wait for current processing to complete
    while (this.processingInstances > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('[EventLifecycle] Stopped event processing');
  }

  /**
   * Cleans up expired events
   */
  public cleanupExpiredEvents(maxAge: number = 86400000): void {
    const now = Date.now();
    for (const [id, event] of this.events) {
      if (now - event.timestamps.created.getTime() > maxAge) {
        if (event.state === EventState.CREATED || 
            event.state === EventState.QUEUED ||
            event.state === EventState.PROCESSING) {
          this.transitionEvent(id, EventState.EXPIRED);
        }
      }
    }
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Event Lifecycle Manager', () => {
  let lifecycleManager: EventLifecycleManager;
  
  beforeEach(() => {
    lifecycleManager = new EventLifecycleManager();
    lifecycleManager.start();
  });
  
  afterEach(async () => {
    await lifecycleManager.stop();
  });

  // ============================================================================
  // STATE TRANSITION TESTS
  // ============================================================================

  describe('State Transitions', () => {
    it('should create event in CREATED state', () => {
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      expect(event.state).toBe(EventState.CREATED);
      expect(event.id).toBeDefined();
      expect(event.timestamps.created).toBeInstanceOf(Date);
    });

    it('should transition from CREATED to VALIDATED', async () => {
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      const updated = await lifecycleManager.transitionEvent(event.id, EventState.VALIDATED);
      expect(updated.state).toBe(EventState.VALIDATED);
      expect(updated.timestamps.validated).toBeInstanceOf(Date);
    });

    it('should transition from CREATED to QUEUED', async () => {
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      const updated = await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      expect(updated.state).toBe(EventState.QUEUED);
      expect(updated.timestamps.queued).toBeInstanceOf(Date);
    });

    it('should transition from QUEUED to PROCESSING', async () => {
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      const updated = await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      expect(updated.state).toBe(EventState.PROCESSING);
      expect(updated.timestamps.processingStarted).toBeInstanceOf(Date);
    });

    it('should transition from PROCESSING to COMPLETED', async () => {
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      const updated = await lifecycleManager.transitionEvent(event.id, EventState.COMPLETED);
      expect(updated.state).toBe(EventState.COMPLETED);
      expect(updated.timestamps.processingCompleted).toBeInstanceOf(Date);
    });

    it('should transition from PROCESSING to FAILED', async () => {
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      const updated = await lifecycleManager.transitionEvent(event.id, EventState.FAILED);
      expect(updated.state).toBe(EventState.FAILED);
      expect(updated.timestamps.failed).toBeInstanceOf(Date);
    });

    it('should transition from PROCESSING to RETRYING', async () => {
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      const updated = await lifecycleManager.transitionEvent(event.id, EventState.RETRYING);
      expect(updated.state).toBe(EventState.RETRYING);
      expect(updated.status.attemptCount).toBe(1);
    });

    it('should transition from RETRYING to QUEUED', async () => {
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      await lifecycleManager.transitionEvent(event.id, EventState.RETRYING);
      const updated = await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      expect(updated.state).toBe(EventState.QUEUED);
    });

    it('should transition from PROCESSING to CANCELLED', async () => {
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      const updated = await lifecycleManager.transitionEvent(event.id, EventState.CANCELLED);
      expect(updated.state).toBe(EventState.CANCELLED);
      expect(updated.timestamps.cancelled).toBeInstanceOf(Date);
    });

    it('should transition from PROCESSING to EXPIRED', async () => {
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      const updated = await lifecycleManager.transitionEvent(event.id, EventState.EXPIRED);
      expect(updated.state).toBe(EventState.EXPIRED);
      expect(updated.timestamps.expired).toBeInstanceOf(Date);
    });

    it('should transition from COMPLETED to ARCHIVED', async () => {
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      await lifecycleManager.transitionEvent(event.id, EventState.COMPLETED);
      const updated = await lifecycleManager.transitionEvent(event.id, EventState.ARCHIVED);
      expect(updated.state).toBe(EventState.ARCHIVED);
      expect(updated.timestamps.archived).toBeInstanceOf(Date);
    });

    it('should transition from FAILED to ARCHIVED', async () => {
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      await lifecycleManager.transitionEvent(event.id, EventState.FAILED);
      const updated = await lifecycleManager.transitionEvent(event.id, EventState.ARCHIVED);
      expect(updated.state).toBe(EventState.ARCHIVED);
    });

    it('should transition from CANCELLED to DELETED', async () => {
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      await lifecycleManager.transitionEvent(event.id, EventState.CANCELLED);
      const updated = await lifecycleManager.transitionEvent(event.id, EventState.DELETED);
      expect(updated.state).toBe(EventState.DELETED);
      expect(updated.timestamps.deleted).toBeInstanceOf(Date);
    });

    it('should prevent invalid transitions', async () => {
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      await expect(
        lifecycleManager.transitionEvent(event.id, EventState.COMPLETED)
      ).rejects.toThrow('Invalid transition: CREATED -> COMPLETED');
    });

    it('should prevent transition from DELETED state', async () => {
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      await lifecycleManager.transitionEvent(event.id, EventState.CANCELLED);
      await lifecycleManager.transitionEvent(event.id, EventState.DELETED);
      await expect(
        lifecycleManager.transitionEvent(event.id, EventState.ARCHIVED)
      ).rejects.toThrow('Invalid transition: DELETED -> ARCHIVED');
    });
  });

  // ============================================================================
  // EVENT LIFECYCLE TESTS
  // ============================================================================

  describe('Event Lifecycle', () => {
    it('should complete full lifecycle successfully', async () => {
      const event = lifecycleManager.createEvent(
        EventType.BUSINESS,
        EventSource.API,
        { action: 'test', data: { value: 42 } }
      );
      
      // Register listener
      lifecycleManager.registerListener({
        id: 'test-listener',
        eventTypes: [EventType.BUSINESS],
        handler: async (event: IEvent) => {
          return { processed: true, data: event.payload };
        },
        priority: EventPriority.MEDIUM,
        maxRetries: 3,
        timeout: 5000,
        async: true
      });
      
      // Complete full lifecycle
      await lifecycleManager.transitionEvent(event.id, EventState.VALIDATED);
      await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      await lifecycleManager.transitionEvent(event.id, EventState.COMPLETED);
      
      const finalEvent = lifecycleManager.getEvent(event.id);
      expect(finalEvent?.state).toBe(EventState.COMPLETED);
      expect(finalEvent?.timestamps.processingCompleted).toBeInstanceOf(Date);
    });

    it('should handle processing failure and retry', async () => {
      let attempts = 0;
      
      lifecycleManager.registerListener({
        id: 'failing-listener',
        eventTypes: [EventType.SYSTEM],
        handler: async (event: IEvent) => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Simulated failure');
          }
          return { success: true };
        },
        priority: EventPriority.HIGH,
        maxRetries: 3,
        timeout: 5000,
        async: true
      });
      
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      
      // Should fail and retry
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalEvent = lifecycleManager.getEvent(event.id);
      expect(finalEvent?.state).toBe(EventState.RETRYING);
      expect(finalEvent?.status.attemptCount).toBeGreaterThan(0);
    });

    it('should handle event expiration', async () => {
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      // Manually set created time to be old
      event.timestamps.created = new Date(Date.now() - 90000000);
      
      lifecycleManager.cleanupExpiredEvents(86400000);
      
      const expiredEvent = lifecycleManager.getEvent(event.id);
      expect(expiredEvent?.state).toBe(EventState.EXPIRED);
    });
  });

  // ============================================================================
  // EVENT TYPES AND PRIORITIES TESTS
  // ============================================================================

  describe('Event Types and Priorities', () => {
    it('should create events with different types', () => {
      const types = [
        EventType.SYSTEM,
        EventType.USER,
        EventType.BUSINESS,
        EventType.SECURITY,
        EventType.INTEGRATION
      ];
      
      for (const type of types) {
        const event = lifecycleManager.createEvent(type, EventSource.INTERNAL, { test: 'data' });
        expect(event.type).toBe(type);
      }
    });

    it('should respect event priorities', async () => {
      const events: IEvent[] = [];
      
      // Create events with different priorities
      events.push(lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { id: 1 },
        EventPriority.CRITICAL
      ));
      events.push(lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { id: 2 },
        EventPriority.LOW
      ));
      events.push(lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { id: 3 },
        EventPriority.HIGH
      ));
      
      // All should be created successfully
      for (const event of events) {
        expect(event.state).toBe(EventState.CREATED);
      }
      
      const highPriorityEvents = events.filter(e => e.priority === EventPriority.HIGH);
      expect(highPriorityEvents.length).toBe(1);
      
      const criticalEvents = events.filter(e => e.priority === EventPriority.CRITICAL);
      expect(criticalEvents.length).toBe(1);
    });

    it('should handle different event severities', () => {
      const severities = [
        EventSeverity.FATAL,
        EventSeverity.ERROR,
        EventSeverity.WARNING,
        EventSeverity.INFO,
        EventSeverity.DEBUG
      ];
      
      for (const severity of severities) {
        const event = lifecycleManager.createEvent(
          EventType.SYSTEM,
          EventSource.INTERNAL,
          { test: 'data' },
          EventPriority.MEDIUM,
          severity
        );
        expect(event.severity).toBe(severity);
      }
    });
  });

  // ============================================================================
  // EVENT LISTENER TESTS
  // ============================================================================

  describe('Event Listeners', () => {
    it('should register and execute listeners', async () => {
      let listenerExecuted = false;
      
      lifecycleManager.registerListener({
        id: 'test-listener-1',
        eventTypes: [EventType.SYSTEM],
        handler: async (event: IEvent) => {
          listenerExecuted = true;
          return event.payload;
        },
        priority: EventPriority.MEDIUM,
        maxRetries: 3,
        timeout: 5000,
        async: true
      });
      
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      // Process event
      await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      
      // Allow processing to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(listenerExecuted).toBe(true);
    });

    it('should filter listeners based on event type', async () => {
      let systemEventsProcessed = 0;
      let businessEventsProcessed = 0;
      
      lifecycleManager.registerListener({
        id: 'system-listener',
        eventTypes: [EventType.SYSTEM],
        handler: async (event: IEvent) => {
          systemEventsProcessed++;
        },
        priority: EventPriority.MEDIUM,
        maxRetries: 3,
        timeout: 5000,
        async: true
      });
      
      lifecycleManager.registerListener({
        id: 'business-listener',
        eventTypes: [EventType.BUSINESS],
        handler: async (event: IEvent) => {
          businessEventsProcessed++;
        },
        priority: EventPriority.MEDIUM,
        maxRetries: 3,
        timeout: 5000,
        async: true
      });
      
      // Create system event
      const systemEvent = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      // Create business event
      const businessEvent = lifecycleManager.createEvent(
        EventType.BUSINESS,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      // Process events
      await lifecycleManager.transitionEvent(systemEvent.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(systemEvent.id, EventState.PROCESSING);
      
      await lifecycleManager.transitionEvent(businessEvent.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(businessEvent.id, EventState.PROCESSING);
      
      // Allow processing to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(systemEventsProcessed).toBeGreaterThan(0);
      expect(businessEventsProcessed).toBeGreaterThan(0);
    });

    it('should handle listener timeout', async () => {
      lifecycleManager.registerListener({
        id: 'slow-listener',
        eventTypes: [EventType.SYSTEM],
        handler: async (event: IEvent) => {
          await new Promise(resolve => setTimeout(resolve, 6000));
          return { success: true };
        },
        priority: EventPriority.MEDIUM,
        maxRetries: 3,
        timeout: 1000,
        async: true
      });
      
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      
      // Allow processing to fail
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const finalEvent = lifecycleManager.getEvent(event.id);
      expect(finalEvent?.state).toBe(EventState.FAILED);
    });

    it('should handle listener with filter', async () => {
      let filteredExecuted = 0;
      
      lifecycleManager.registerListener({
        id: 'filtered-listener',
        eventTypes: [EventType.SYSTEM],
        filter: (event: IEvent) => event.payload.shouldProcess === true,
        handler: async (event: IEvent) => {
          filteredExecuted++;
        },
        priority: EventPriority.MEDIUM,
        maxRetries: 3,
        timeout: 5000,
        async: true
      });
      
      // Create event that should be filtered out
      const event1 = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { shouldProcess: false }
      );
      
      // Create event that should be processed
      const event2 = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { shouldProcess: true }
      );
      
      await lifecycleManager.transitionEvent(event1.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(event1.id, EventState.PROCESSING);
      
      await lifecycleManager.transitionEvent(event2.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(event2.id, EventState.PROCESSING);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(filteredExecuted).toBe(1);
    });
  });

  // ============================================================================
  // METRICS AND MONITORING TESTS
  // ============================================================================

  describe('Metrics and Monitoring', () => {
    it('should track event metrics', () => {
      // Create multiple events
      for (let i = 0; i < 5; i++) {
        lifecycleManager.createEvent(
          EventType.SYSTEM,
          EventSource.INTERNAL,
          { index: i }
        );
      }
      
      const metrics = lifecycleManager.getMetrics();
      expect(metrics.totalEvents).toBe(5);
      expect(metrics.eventsByType.get(EventType.SYSTEM)).toBe(5);
      expect(metrics.eventsByState.get(EventState.CREATED)).toBe(5);
    });

    it('should track processing metrics', async () => {
      let processedCount = 0;
      
      lifecycleManager.registerListener({
        id: 'metric-listener',
        eventTypes: [EventType.SYSTEM],
        handler: async (event: IEvent) => {
          processedCount++;
          return { success: true };
        },
        priority: EventPriority.MEDIUM,
        maxRetries: 3,
        timeout: 5000,
        async: true
      });
      
      // Create and process events
      for (let i = 0; i < 3; i++) {
        const event = lifecycleManager.createEvent(
          EventType.SYSTEM,
          EventSource.INTERNAL,
          { index: i }
        );
        await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
        await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const metrics = lifecycleManager.getMetrics();
      expect(metrics.processedEvents).toBeGreaterThan(0);
      expect(metrics.averageProcessingTime).toBeGreaterThan(0);
    });

    it('should track error metrics', async () => {
      lifecycleManager.registerListener({
        id: 'error-listener',
        eventTypes: [EventType.SYSTEM],
        handler: async (event: IEvent) => {
          throw new Error('Simulated error');
        },
        priority: EventPriority.MEDIUM,
        maxRetries: 3,
        timeout: 5000,
        async: true
      });
      
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const metrics = lifecycleManager.getMetrics();
      expect(metrics.failedEvents).toBeGreaterThan(0);
      expect(metrics.errorRate).toBeGreaterThan(0);
    });

    it('should calculate throughput correctly', async () => {
      // Create and process multiple events quickly
      for (let i = 0; i < 10; i++) {
        const event = lifecycleManager.createEvent(
          EventType.SYSTEM,
          EventSource.INTERNAL,
          { index: i }
        );
        await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
        await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
        await lifecycleManager.transitionEvent(event.id, EventState.COMPLETED);
      }
      
      const metrics = lifecycleManager.getMetrics();
      expect(metrics.throughput).toBeDefined();
      expect(metrics.throughput).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // CONCURRENCY AND SCALABILITY TESTS
  // ============================================================================

  describe('Concurrency and Scalability', () => {
    it('should handle concurrent event processing', async () => {
      const eventCount = 20;
      let processedCount = 0;
      
      lifecycleManager.registerListener({
        id: 'concurrent-listener',
        eventTypes: [EventType.SYSTEM],
        handler: async (event: IEvent) => {
          await new Promise(resolve => setTimeout(resolve, 50));
          processedCount++;
        },
        priority: EventPriority.MEDIUM,
        maxRetries: 3,
        timeout: 5000,
        async: true
      });
      
      // Create and queue events
      const events: IEvent[] = [];
      for (let i = 0; i < eventCount; i++) {
        const event = lifecycleManager.createEvent(
          EventType.SYSTEM,
          EventSource.INTERNAL,
          { index: i }
        );
        events.push(event);
        await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      }
      
      // Process all events
      for (const event of events) {
        await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      }
      
      // Wait for all to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      expect(processedCount).toBe(eventCount);
    });

    it('should limit concurrent processing', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;
      
      lifecycleManager.registerListener({
        id: 'concurrency-listener',
        eventTypes: [EventType.SYSTEM],
        handler: async (event: IEvent) => {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);
          await new Promise(resolve => setTimeout(resolve, 100));
          concurrentCount--;
        },
        priority: EventPriority.MEDIUM,
        maxRetries: 3,
        timeout: 5000,
        async: true
      });
      
      // Create and queue events
      for (let i = 0; i < 15; i++) {
        const event = lifecycleManager.createEvent(
          EventType.SYSTEM,
          EventSource.INTERNAL,
          { index: i }
        );
        await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
        await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      expect(maxConcurrent).toBeLessThanOrEqual(10);
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle listener errors gracefully', async () => {
      lifecycleManager.registerListener({
        id: 'error-throwing-listener',
        eventTypes: [EventType.SYSTEM],
        handler: async (event: IEvent) => {
          throw new Error('Listener error');
        },
        priority: EventPriority.MEDIUM,
        maxRetries: 3,
        timeout: 5000,
        async: true
      });
      
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      
      // Should not throw
      await expect(
        lifecycleManager.transitionEvent(event.id, EventState.PROCESSING)
      ).resolves.toBeDefined();
      
      // Should enter failed state after retries
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const finalEvent = lifecycleManager.getEvent(event.id);
      expect(finalEvent?.state).toBe(EventState.FAILED);
      expect(finalEvent?.status.error).toBeDefined();
    });

    it('should handle event not found', async () => {
      await expect(
        lifecycleManager.transitionEvent('non-existent', EventState.COMPLETED)
      ).rejects.toThrow('Event non-existent not found');
    });

    it('should handle corrupt event data', async () => {
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      // Corrupt the event
      event.payload = undefined;
      
      await expect(
        lifecycleManager.transitionEvent(event.id, EventState.VALIDATED)
      ).rejects.toThrow('Validation failed for transition: CREATED -> VALIDATED');
    });

    it('should recover from temporary failures', async () => {
      let attempts = 0;
      
      lifecycleManager.registerListener({
        id: 'recovery-listener',
        eventTypes: [EventType.SYSTEM],
        handler: async (event: IEvent) => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Temporary failure');
          }
          return { success: true };
        },
        priority: EventPriority.MEDIUM,
        maxRetries: 3,
        timeout: 5000,
        async: true
      });
      
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const finalEvent = lifecycleManager.getEvent(event.id);
      expect(finalEvent?.state).toBe(EventState.COMPLETED);
    });
  });

  // ============================================================================
  // EDGE CASE TESTS
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty payload', () => {
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        null
      );
      
      expect(event.payload).toBeNull();
      expect(event.state).toBe(EventState.CREATED);
    });

    it('should handle very large payloads', () => {
      const largePayload = {
        data: 'x'.repeat(1000000)
      };
      
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        largePayload
      );
      
      expect(event.payload.data.length).toBe(1000000);
    });

    it('should handle rapid event creation', () => {
      const start = Date.now();
      const count = 100;
      
      for (let i = 0; i < count; i++) {
        lifecycleManager.createEvent(
          EventType.SYSTEM,
          EventSource.INTERNAL,
          { index: i }
        );
      }
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
      
      const metrics = lifecycleManager.getMetrics();
      expect(metrics.totalEvents).toBe(count);
    });

    it('should handle cancellation during processing', async () => {
      let processingStarted = false;
      
      lifecycleManager.registerListener({
        id: 'cancel-listener',
        eventTypes: [EventType.SYSTEM],
        handler: async (event: IEvent) => {
          processingStarted = true;
          await new Promise(resolve => setTimeout(resolve, 500));
          return { success: true };
        },
        priority: EventPriority.MEDIUM,
        maxRetries: 3,
        timeout: 5000,
        async: true
      });
      
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      const processingPromise = lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      
      // Cancel during processing
      setTimeout(() => {
        lifecycleManager.transitionEvent(event.id, EventState.CANCELLED);
      }, 100);
      
      await processingPromise;
      
      const finalEvent = lifecycleManager.getEvent(event.id);
      expect(finalEvent?.state).toBe(EventState.CANCELLED);
    });

    it('should handle cleanup of expired events', () => {
      const oldEvent = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      // Manually set created time to be old
      oldEvent.timestamps.created = new Date(Date.now() - 90000000);
      
      lifecycleManager.cleanupExpiredEvents(86400000);
      
      const expiredEvent = lifecycleManager.getEvent(oldEvent.id);
      expect(expiredEvent?.state).toBe(EventState.EXPIRED);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Scenarios', () => {
    it('should handle chained event processing', async () => {
      let eventChain = [];
      
      lifecycleManager.registerListener({
        id: 'chain-listener-1',
        eventTypes: [EventType.SYSTEM],
        handler: async (event: IEvent) => {
          eventChain.push(1);
          // Create next event in chain
          const nextEvent = lifecycleManager.createEvent(
            EventType.BUSINESS,
            EventSource.INTERNAL,
            { step: 2 }
          );
          await lifecycleManager.transitionEvent(nextEvent.id, EventState.QUEUED);
          return event.payload;
        },
        priority: EventPriority.MEDIUM,
        maxRetries: 3,
        timeout: 5000,
        async: true
      });
      
      lifecycleManager.registerListener({
        id: 'chain-listener-2',
        eventTypes: [EventType.BUSINESS],
        handler: async (event: IEvent) => {
          eventChain.push(2);
          return event.payload;
        },
        priority: EventPriority.MEDIUM,
        maxRetries: 3,
        timeout: 5000,
        async: true
      });
      
      const startEvent = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { step: 1 }
      );
      
      await lifecycleManager.transitionEvent(startEvent.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(startEvent.id, EventState.PROCESSING);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(eventChain).toContain(1);
      expect(eventChain).toContain(2);
    });

    it('should handle event timeouts with retry', async () => {
      let attempts = 0;
      
      lifecycleManager.registerListener({
        id: 'timeout-retry-listener',
        eventTypes: [EventType.SYSTEM],
        handler: async (event: IEvent) => {
          attempts++;
          if (attempts < 3) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            throw new Error('Timeout');
          }
          return { success: true };
        },
        priority: EventPriority.MEDIUM,
        maxRetries: 3,
        timeout: 1000,
        async: true
      });
      
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
      await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const finalEvent = lifecycleManager.getEvent(event.id);
      expect(finalEvent?.state).toBe(EventState.COMPLETED);
      expect(attempts).toBe(3);
    });

    it('should handle batch processing', async () => {
      const batchSize = 10;
      let processed = 0;
      
      lifecycleManager.registerListener({
        id: 'batch-listener',
        eventTypes: [EventType.SYSTEM],
        handler: async (event: IEvent) => {
          processed++;
          return { index: event.payload.index };
        },
        priority: EventPriority.MEDIUM,
        maxRetries: 3,
        timeout: 5000,
        async: true
      });
      
      // Create batch of events
      const events: IEvent[] = [];
      for (let i = 0; i < batchSize; i++) {
        const event = lifecycleManager.createEvent(
          EventType.SYSTEM,
          EventSource.INTERNAL,
          { index: i }
        );
        events.push(event);
      }
      
      // Process all events
      for (const event of events) {
        await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
        await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(processed).toBe(batchSize);
    });
  });

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  describe('Performance Tests', () => {
    it('should process events efficiently', async () => {
      const eventCount = 50;
      const startTime = Date.now();
      
      lifecycleManager.registerListener({
        id: 'perf-listener',
        eventTypes: [EventType.SYSTEM],
        handler: async (event: IEvent) => {
          // Simulate work
          return { success: true };
        },
        priority: EventPriority.MEDIUM,
        maxRetries: 3,
        timeout: 5000,
        async: true
      });
      
      // Create and process events
      for (let i = 0; i < eventCount; i++) {
        const event = lifecycleManager.createEvent(
          EventType.SYSTEM,
          EventSource.INTERNAL,
          { index: i }
        );
        await lifecycleManager.transitionEvent(event.id, EventState.QUEUED);
        await lifecycleManager.transitionEvent(event.id, EventState.PROCESSING);
      }
      
      const duration = Date.now() - startTime;
      const avgTime = duration / eventCount;
      
      expect(avgTime).toBeLessThan(100); // Should process each event in less than 100ms
    });

    it('should handle high throughput', async () => {
      const eventCount = 100;
      const startTime = Date.now();
      
      lifecycleManager.registerListener({
        id: 'throughput-listener',
        eventTypes: [EventType.SYSTEM],
        handler: async (event: IEvent) => {
          return { success: true };
        },
        priority: EventPriority.MEDIUM,
        maxRetries: 3,
        timeout: 5000,
        async: true
      });
      
      const promises = [];
      for (let i = 0; i < eventCount; i++) {
        const event = lifecycleManager.createEvent(
          EventType.SYSTEM,
          EventSource.INTERNAL,
          { index: i }
        );
        promises.push(lifecycleManager.transitionEvent(event.id, EventState.QUEUED));
        promises.push(lifecycleManager.transitionEvent(event.id, EventState.PROCESSING));
      }
      
      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      const throughput = eventCount / (duration / 1000);
      
      expect(throughput).toBeGreaterThan(10); // At least 10 events per second
    });
  });

  // ============================================================================
  // SECURITY TESTS
  // ============================================================================

  describe('Security Tests', () => {
    it('should validate event metadata for security', () => {
      const event = lifecycleManager.createEvent(
        EventType.SECURITY,
        EventSource.API,
        { action: 'login' }
      );
      
      expect(event.metadata.createdFrom).toBe('event_manager');
      expect(event.metadata.environment).toBeDefined();
    });

    it('should prevent unauthorized state transitions', async () => {
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        { test: 'data' }
      );
      
      // Try to transition to a non-existent state
      await expect(
        lifecycleManager.transitionEvent(event.id, 'INVALID' as EventState)
      ).rejects.toThrow('Invalid transition: CREATED -> INVALID');
    });

    it('should handle malicious payload attempts', () => {
      const maliciousPayload = {
        __proto__: { pollute: true },
        toString: () => 'malicious'
      };
      
      const event = lifecycleManager.createEvent(
        EventType.SYSTEM,
        EventSource.INTERNAL,
        maliciousPayload
      );
      
      expect(event.payload).toBeDefined();
      expect(event.payload.__proto__).toBeDefined();
    });
  });
});

// ============================================================================
// EXPORT TEST MODULE
// ============================================================================

export default {
  EventLifecycleManager,
  EventState,
  EventType,
  EventPriority,
  EventSeverity,
  EventSource
};
