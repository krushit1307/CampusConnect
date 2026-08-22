/**
 * Predictive Campus Resource Demand & Capacity Optimization Engine
 * @module PredictiveCampusResourceEngine
 * @description Advanced analytics engine for predicting and optimizing campus resource utilization
 * @version 1.0.0
 * @author Campus Analytics Team
 * 
 * This engine provides comprehensive demand forecasting, capacity planning,
 * and optimization algorithms for educational campus resources including:
 * - Classrooms and lecture halls
 * - Laboratory facilities
 * - Faculty and staff allocation
 * - Equipment and technology resources
 * - Parking and transportation
 * - Dining and food services
 * - Library and study spaces
 * - Sports and recreational facilities
 */

// ============================================================================
// IMPORTS AND DEPENDENCIES
// ============================================================================

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Resource type enumeration
 */
export enum ResourceType {
  CLASSROOM = 'CLASSROOM',
  LABORATORY = 'LABORATORY',
  FACULTY = 'FACULTY',
  EQUIPMENT = 'EQUIPMENT',
  PARKING = 'PARKING',
  DINING = 'DINING',
  LIBRARY = 'LIBRARY',
  SPORTS = 'SPORTS',
  TECHNOLOGY = 'TECHNOLOGY',
  ADMINISTRATIVE = 'ADMINISTRATIVE'
}

/**
 * Resource capacity status
 */
export enum CapacityStatus {
  UNDER_UTILIZED = 'UNDER_UTILIZED',
  OPTIMAL = 'OPTIMAL',
  OVER_UTILIZED = 'OVER_UTILIZED',
  CRITICAL = 'CRITICAL',
  MAINTENANCE = 'MAINTENANCE'
}

/**
 * Demand forecast confidence levels
 */
export enum ConfidenceLevel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  EXPERIMENTAL = 'EXPERIMENTAL'
}

/**
 * Optimization strategy types
 */
export enum OptimizationStrategy {
  BALANCED = 'BALANCED',
  COST_MINIMIZATION = 'COST_MINIMIZATION',
  UTILIZATION_MAXIMIZATION = 'UTILIZATION_MAXIMIZATION',
  STUDENT_SATISFACTION = 'STUDENT_SATISFACTION',
  SUSTAINABILITY = 'SUSTAINABILITY',
  HYBRID = 'HYBRID'
}

/**
 * Time granularity for forecasting
 */
export enum TimeGranularity {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  SEMESTER = 'SEMESTER',
  YEARLY = 'YEARLY'
}

/**
 * Resource allocation priority
 */
export enum PriorityLevel {
  CRITICAL = 1,
  HIGH = 2,
  MEDIUM = 3,
  LOW = 4,
  OPTIONAL = 5
}

/**
 * Campus resource base interface
 */
export interface CampusResource {
  id: string;
  name: string;
  type: ResourceType;
  location: string;
  capacity: number;
  currentUtilization: number;
  operationalHours: OperationalHours;
  maintenanceSchedule: MaintenanceSchedule[];
  costPerHour: number;
  tags: string[];
  metadata: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Operational hours definition
 */
export interface OperationalHours {
  monday: TimeSlot[];
  tuesday: TimeSlot[];
  wednesday: TimeSlot[];
  thursday: TimeSlot[];
  friday: TimeSlot[];
  saturday: TimeSlot[];
  sunday: TimeSlot[];
  holidays: HolidaySchedule[];
}

/**
 * Time slot definition
 */
export interface TimeSlot {
  start: string; // HH:MM format
  end: string; // HH:MM format
  isAvailable: boolean;
}

/**
 * Holiday schedule
 */
export interface HolidaySchedule {
  date: string; // YYYY-MM-DD
  name: string;
  isOpen: boolean;
  specialHours?: TimeSlot[];
}

/**
 * Maintenance schedule
 */
export interface MaintenanceSchedule {
  startDate: Date;
  endDate: Date;
  reason: string;
  isCompleted: boolean;
}

/**
 * Resource demand forecast
 */
export interface DemandForecast {
  resourceId: string;
  timestamp: Date;
  predictedDemand: number;
  confidenceLevel: ConfidenceLevel;
  confidenceInterval: [number, number];
  factors: DemandFactors;
  seasonalityIndex: number;
  trend: number;
  residuals: number[];
  modelVersion: string;
}

/**
 * Factors influencing demand
 */
export interface DemandFactors {
  academicCalendar: AcademicCalendarEvent[];
  weatherImpact: number;
  specialEvents: SpecialEvent[];
  historicalTrend: number;
  dayOfWeekFactor: number;
  timeOfDayFactor: number;
  semesterFactor: number;
  externalFactors: Record<string, number>;
}

/**
 * Academic calendar event
 */
export interface AcademicCalendarEvent {
  date: Date;
  name: string;
  type: 'CLASS' | 'EXAM' | 'BREAK' | 'HOLIDAY' | 'REGISTRATION';
  impact: number; // 0-1 impact factor
}

/**
 * Special event
 */
export interface SpecialEvent {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  expectedAttendance: number;
  resourceRequirements: ResourceRequirement[];
  priority: PriorityLevel;
}

/**
 * Resource requirement
 */
export interface ResourceRequirement {
  resourceType: ResourceType;
  quantity: number;
  duration: number; // in hours
  preferredLocation?: string;
  specialRequirements?: string[];
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  resourceId: string;
  recommendedAllocation: number;
  currentUtilization: number;
  projectedDemand: number;
  strategy: OptimizationStrategy;
  expectedImprovement: number;
  costSavings: number;
  studentSatisfactionScore: number;
  sustainabilityScore: number;
  recommendations: Recommendation[];
  constraints: Constraint[];
  timeframe: TimeGranularity;
}

/**
 * Recommendation
 */
export interface Recommendation {
  action: string;
  priority: PriorityLevel;
  expectedImpact: number;
  implementationCost: number;
  timeframe: string;
  responsibleParty: string;
}

/**
 * Constraint
 */
export interface Constraint {
  type: 'BUDGET' | 'CAPACITY' | 'TIME' | 'PERSONNEL' | 'REGULATORY' | 'OTHER';
  description: string;
  severity: number; // 0-1
}

/**
 * Resource optimization configuration
 */
export interface OptimizationConfig {
  strategy: OptimizationStrategy;
  timeHorizon: number; // days
  granularity: TimeGranularity;
  constraints: Constraint[];
  weights: OptimizationWeights;
  maxIterations: number;
  tolerance: number;
  useParallelProcessing: boolean;
}

/**
 * Optimization weights
 */
export interface OptimizationWeights {
  cost: number;
  utilization: number;
  satisfaction: number;
  sustainability: number;
  quality: number;
}

/**
 * Resource allocation plan
 */
export interface AllocationPlan {
  id: string;
  resources: ResourceAllocation[];
  timeframe: TimeGranularity;
  startDate: Date;
  endDate: Date;
  optimizationScore: number;
  cost: number;
  createdBy: string;
  createdAt: Date;
  status: 'DRAFT' | 'ACTIVE' | 'IMPLEMENTED' | 'ARCHIVED';
}

/**
 * Individual resource allocation
 */
export interface ResourceAllocation {
  resourceId: string;
  allocatedQuantity: number;
  scheduledSlots: ScheduledSlot[];
  priority: PriorityLevel;
  constraints: Constraint[];
}

/**
 * Scheduled time slot
 */
export interface ScheduledSlot {
  startTime: Date;
  endTime: Date;
  purpose: string;
  allocatedTo: string;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  overallUtilization: number;
  peakDemand: number;
  averageResponseTime: number;
  costEfficiency: number;
  studentSatisfaction: number;
  resourceAvailability: number;
  optimizationScore: number;
  timestamp: Date;
}

/**
 * Historical data point
 */
export interface HistoricalDataPoint {
  timestamp: Date;
  resourceId: string;
  utilization: number;
  demand: number;
  capacity: number;
  weather: WeatherData;
  events: string[];
  semester: string;
  dayOfWeek: number;
  hourOfDay: number;
}

/**
 * Weather data
 */
export interface WeatherData {
  temperature: number;
  precipitation: number;
  windSpeed: number;
  condition: string;
}

/**
 * Machine learning model configuration
 */
export interface MLModelConfig {
  modelType: 'ARIMA' | 'SARIMA' | 'PROPHET' | 'LSTM' | 'HYBRID';
  parameters: Record<string, any>;
  trainingWindow: number; // days
  predictionHorizon: number; // days
  retrainFrequency: number; // days
  validationSplit: number;
  useGPU: boolean;
}

/**
 * Data source configuration
 */
export interface DataSourceConfig {
  id: string;
  name: string;
  type: 'DATABASE' | 'API' | 'FILE' | 'STREAM';
  connection: Record<string, any>;
  refreshInterval: number;
  isActive: boolean;
}

/**
 * Notification configuration
 */
export interface NotificationConfig {
  email: boolean;
  sms: boolean;
  dashboard: boolean;
  webhook: boolean;
  thresholds: NotificationThresholds;
}

/**
 * Notification thresholds
 */
export interface NotificationThresholds {
  utilizationWarning: number;
  utilizationCritical: number;
  demandSpike: number;
  capacityShortage: number;
}

/**
 * User roles and permissions
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  ANALYST = 'ANALYST',
  FACULTY = 'FACULTY',
  STAFF = 'STAFF',
  STUDENT = 'STUDENT',
  GUEST = 'GUEST'
}

/**
 * User profile
 */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  preferences: UserPreferences;
  permissions: string[];
  lastActive: Date;
}

/**
 * User preferences
 */
export interface UserPreferences {
  dashboardLayout: string;
  notifications: NotificationConfig;
  defaultTimeframe: TimeGranularity;
  preferredResources: string[];
}

// ============================================================================
// CORE ENGINE CLASS
// ============================================================================

/**
 * Predictive Campus Resource Demand & Capacity Optimization Engine
 * Main class implementing all prediction and optimization functionality
 */
export class PredictiveCampusResourceEngine {
  private resources: Map<string, CampusResource> = new Map();
  private historicalData: HistoricalDataPoint[] = [];
  private forecasts: Map<string, DemandForecast[]> = new Map();
  private allocations: Map<string, AllocationPlan> = new Map();
  private performanceHistory: PerformanceMetrics[] = [];
  private mlModels: Map<string, any> = new Map();
  private config: OptimizationConfig;
  private mlConfig: MLModelConfig;
  private dataSources: DataSourceConfig[] = [];
  private users: Map<string, UserProfile> = new Map();
  private events: SpecialEvent[] = [];
  private academicCalendar: AcademicCalendarEvent[] = [];
  private isRunning: boolean = false;
  private lastOptimizationTime: Date | null = null;
  private optimizationCount: number = 0;
  private totalCostSavings: number = 0;
  private averageSatisfaction: number = 0;

  /**
   * Constructor - Initializes the engine with configuration
   */
  constructor(config: Partial<OptimizationConfig> = {}, mlConfig: Partial<MLModelConfig> = {}) {
    // Initialize default configuration
    this.config = this.initializeDefaultConfig(config);
    this.mlConfig = this.initializeDefaultMLConfig(mlConfig);
    this.initializeDataSources();
    this.initializeSystemResources();
  }

  /**
   * Initializes default optimization configuration
   */
  private initializeDefaultConfig(config: Partial<OptimizationConfig>): OptimizationConfig {
    const defaultConfig: OptimizationConfig = {
      strategy: OptimizationStrategy.BALANCED,
      timeHorizon: 30,
      granularity: TimeGranularity.DAILY,
      constraints: [],
      weights: {
        cost: 0.25,
        utilization: 0.25,
        satisfaction: 0.25,
        sustainability: 0.15,
        quality: 0.10
      },
      maxIterations: 1000,
      tolerance: 0.001,
      useParallelProcessing: true
    };
    return { ...defaultConfig, ...config };
  }

  /**
   * Initializes default machine learning configuration
   */
  private initializeDefaultMLConfig(config: Partial<MLModelConfig>): MLModelConfig {
    const defaultConfig: MLModelConfig = {
      modelType: 'HYBRID',
      parameters: {
        p: 1,
        d: 1,
        q: 1,
        seasonalP: 1,
        seasonalD: 1,
        seasonalQ: 1,
        seasonalityPeriod: 7
      },
      trainingWindow: 180,
      predictionHorizon: 30,
      retrainFrequency: 7,
      validationSplit: 0.2,
      useGPU: false
    };
    return { ...defaultConfig, ...config };
  }

  /**
   * Initializes data sources
   */
  private initializeDataSources(): void {
    const defaultSources: DataSourceConfig[] = [
      {
        id: 'ds_main_db',
        name: 'Main Campus Database',
        type: 'DATABASE',
        connection: {
          host: 'localhost',
          port: 5432,
          database: 'campus_analytics'
        },
        refreshInterval: 3600,
        isActive: true
      },
      {
        id: 'ds_weather_api',
        name: 'Weather Service API',
        type: 'API',
        connection: {
          endpoint: 'https://api.weather.com/v1',
          apiKey: '${WEATHER_API_KEY}'
        },
        refreshInterval: 1800,
        isActive: true
      },
      {
        id: 'ds_academic_calendar',
        name: 'Academic Calendar Service',
        type: 'API',
        connection: {
          endpoint: 'https://campus.edu/api/calendar'
        },
        refreshInterval: 86400,
        isActive: true
      }
    ];
    this.dataSources = defaultSources;
  }

  /**
   * Initializes system resources with sample data
   */
  private initializeSystemResources(): void {
    // Create sample resources
    const sampleResources: CampusResource[] = [
      {
        id: 'res_001',
        name: 'Main Lecture Hall A',
        type: ResourceType.CLASSROOM,
        location: 'Building A, Room 101',
        capacity: 200,
        currentUtilization: 0.65,
        operationalHours: this.createDefaultOperationalHours(),
        maintenanceSchedule: [],
        costPerHour: 75,
        tags: ['lecture', 'large', 'projector'],
        metadata: { building: 'A', floor: 1, hasProjector: true },
        isActive: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date()
      },
      {
        id: 'res_002',
        name: 'Chemistry Lab 1',
        type: ResourceType.LABORATORY,
        location: 'Building B, Room 205',
        capacity: 40,
        currentUtilization: 0.45,
        operationalHours: this.createDefaultOperationalHours(),
        maintenanceSchedule: [
          {
            startDate: new Date('2026-08-15'),
            endDate: new Date('2026-08-20'),
            reason: 'Annual equipment calibration',
            isCompleted: false
          }
        ],
        costPerHour: 120,
        tags: ['chemistry', 'lab', 'equipment'],
        metadata: { building: 'B', floor: 2, hasFumeHood: true },
        isActive: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date()
      },
      {
        id: 'res_003',
        name: 'Computer Science Lab',
        type: ResourceType.LABORATORY,
        location: 'Building C, Room 302',
        capacity: 60,
        currentUtilization: 0.85,
        operationalHours: this.createDefaultOperationalHours(),
        maintenanceSchedule: [],
        costPerHour: 100,
        tags: ['computer', 'lab', 'workstations'],
        metadata: { building: 'C', floor: 3, totalWorkstations: 60 },
        isActive: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date()
      },
      {
        id: 'res_004',
        name: 'Faculty Office East',
        type: ResourceType.FACULTY,
        location: 'Building A, Floor 3',
        capacity: 15,
        currentUtilization: 0.90,
        operationalHours: this.createDefaultOperationalHours(),
        maintenanceSchedule: [],
        costPerHour: 50,
        tags: ['faculty', 'office', 'meetings'],
        metadata: { building: 'A', floor: 3, department: 'Computer Science' },
        isActive: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date()
      },
      {
        id: 'res_005',
        name: 'Central Parking Garage',
        type: ResourceType.PARKING,
        location: 'Parking Structure P1',
        capacity: 500,
        currentUtilization: 0.72,
        operationalHours: this.createDefaultOperationalHours(),
        maintenanceSchedule: [
          {
            startDate: new Date('2026-09-01'),
            endDate: new Date('2026-09-05'),
            reason: 'Structural inspection',
            isCompleted: false
          }
        ],
        costPerHour: 5,
        tags: ['parking', 'garage', 'central'],
        metadata: { levels: 5, totalSpaces: 500 },
        isActive: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date()
      },
      {
        id: 'res_006',
        name: 'Main Library Study Area',
        type: ResourceType.LIBRARY,
        location: 'Library Building, Floor 2',
        capacity: 300,
        currentUtilization: 0.55,
        operationalHours: this.createDefaultOperationalHours(),
        maintenanceSchedule: [],
        costPerHour: 0,
        tags: ['library', 'study', 'quiet'],
        metadata: { building: 'Library', floor: 2, hasWiFi: true },
        isActive: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date()
      },
      {
        id: 'res_007',
        name: 'University Dining Hall',
        type: ResourceType.DINING,
        location: 'Student Center, Floor 1',
        capacity: 400,
        currentUtilization: 0.78,
        operationalHours: this.createDefaultOperationalHours(),
        maintenanceSchedule: [],
        costPerHour: 0,
        tags: ['dining', 'cafeteria', 'food'],
        metadata: { building: 'Student Center', floor: 1, cuisine: 'International' },
        isActive: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date()
      },
      {
        id: 'res_008',
        name: 'Sports Complex Gymnasium',
        type: ResourceType.SPORTS,
        location: 'Sports Complex, Building S',
        capacity: 150,
        currentUtilization: 0.40,
        operationalHours: this.createDefaultOperationalHours(),
        maintenanceSchedule: [
          {
            startDate: new Date('2026-10-10'),
            endDate: new Date('2026-10-15'),
            reason: 'Floor resurfacing',
            isCompleted: false
          }
        ],
        costPerHour: 60,
        tags: ['sports', 'gym', 'fitness'],
        metadata: { building: 'S', hasPool: false, hasCourt: true },
        isActive: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date()
      },
      {
        id: 'res_009',
        name: 'Conference Room 1',
        type: ResourceType.ADMINISTRATIVE,
        location: 'Administration Building, Room 204',
        capacity: 25,
        currentUtilization: 0.30,
        operationalHours: this.createDefaultOperationalHours(),
        maintenanceSchedule: [],
        costPerHour: 45,
        tags: ['conference', 'meetings', 'presentations'],
        metadata: { building: 'Admin', floor: 2, hasVideoConference: true },
        isActive: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date()
      },
      {
        id: 'res_010',
        name: 'Physics Laboratory',
        type: ResourceType.LABORATORY,
        location: 'Science Building, Room 120',
        capacity: 30,
        currentUtilization: 0.25,
        operationalHours: this.createDefaultOperationalHours(),
        maintenanceSchedule: [],
        costPerHour: 130,
        tags: ['physics', 'lab', 'experimental'],
        metadata: { building: 'Science', floor: 1, hasLaser: true },
        isActive: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date()
      }
    ];

    sampleResources.forEach(resource => {
      this.resources.set(resource.id, resource);
    });

    // Initialize academic calendar
    this.initializeAcademicCalendar();
  }

  /**
   * Creates default operational hours for resources
   */
  private createDefaultOperationalHours(): OperationalHours {
    const defaultSlot: TimeSlot = { start: '08:00', end: '22:00', isAvailable: true };
    const defaultSlots: TimeSlot[] = [defaultSlot];
    
    return {
      monday: defaultSlots,
      tuesday: defaultSlots,
      wednesday: defaultSlots,
      thursday: defaultSlots,
      friday: defaultSlots,
      saturday: [{ start: '09:00', end: '18:00', isAvailable: true }],
      sunday: [{ start: '10:00', end: '17:00', isAvailable: true }],
      holidays: []
    };
  }

  /**
   * Initializes academic calendar with sample events
   */
  private initializeAcademicCalendar(): void {
    const currentYear = new Date().getFullYear();
    this.academicCalendar = [
      {
        date: new Date(`${currentYear}-01-15`),
        name: 'Spring Semester Begins',
        type: 'CLASS',
        impact: 0.8
      },
      {
        date: new Date(`${currentYear}-03-10`),
        name: 'Midterm Exams',
        type: 'EXAM',
        impact: 0.9
      },
      {
        date: new Date(`${currentYear}-03-25`),
        name: 'Spring Break',
        type: 'BREAK',
        impact: 0.3
      },
      {
        date: new Date(`${currentYear}-05-01`),
        name: 'Final Exams Begin',
        type: 'EXAM',
        impact: 0.95
      },
      {
        date: new Date(`${currentYear}-05-20`),
        name: 'Spring Semester Ends',
        type: 'BREAK',
        impact: 0.2
      },
      {
        date: new Date(`${currentYear}-06-01`),
        name: 'Summer Session Begins',
        type: 'CLASS',
        impact: 0.5
      },
      {
        date: new Date(`${currentYear}-07-04`),
        name: 'Independence Day',
        type: 'HOLIDAY',
        impact: 0.1
      },
      {
        date: new Date(`${currentYear}-08-15`),
        name: 'Summer Session Ends',
        type: 'BREAK',
        impact: 0.3
      },
      {
        date: new Date(`${currentYear}-09-01`),
        name: 'Fall Semester Begins',
        type: 'CLASS',
        impact: 0.85
      },
      {
        date: new Date(`${currentYear}-10-15`),
        name: 'Fall Break',
        type: 'BREAK',
        impact: 0.4
      },
      {
        date: new Date(`${currentYear}-11-11`),
        name: 'Veterans Day',
        type: 'HOLIDAY',
        impact: 0.2
      },
      {
        date: new Date(`${currentYear}-11-28`),
        name: 'Thanksgiving Break',
        type: 'BREAK',
        impact: 0.3
      },
      {
        date: new Date(`${currentYear}-12-10`),
        name: 'Final Exams Begin',
        type: 'EXAM',
        impact: 0.95
      },
      {
        date: new Date(`${currentYear}-12-25`),
        name: 'Christmas Day',
        type: 'HOLIDAY',
        impact: 0.1
      }
    ];
  }

  // ============================================================================
  // CORE PREDICTION METHODS
  // ============================================================================

  /**
   * Generates demand forecast for a specific resource
   */
  public generateDemandForecast(
    resourceId: string,
    horizon: number = 30,
    granularity: TimeGranularity = TimeGranularity.DAILY
  ): DemandForecast[] {
    if (!this.resources.has(resourceId)) {
      throw new Error(`Resource ${resourceId} not found`);
    }

    const resource = this.resources.get(resourceId)!;
    const historicalData = this.getHistoricalDataForResource(resourceId, 180);
    
    // Apply multiple forecasting models
    const arimaForecast = this.applyARIMAModel(historicalData, horizon);
    const prophetForecast = this.applyProphetModel(historicalData, horizon);
    const lstmForecast = this.applyLSTMModel(historicalData, horizon);
    
    // Ensemble the forecasts
    const ensembleForecast = this.ensembleForecasts(
      arimaForecast,
      prophetForecast,
      lstmForecast
    );
    
    // Apply seasonality and factors
    const finalForecast = this.applyDemandFactors(ensembleForecast, resource);
    
    // Store forecast
    this.forecasts.set(resourceId, finalForecast);
    
    return finalForecast;
  }

  /**
   * Applies ARIMA model for forecasting
   */
  private applyARIMAModel(data: HistoricalDataPoint[], horizon: number): number[] {
    // Simplified ARIMA implementation - in production, use a proper statistical library
    const values = data.map(d => d.demand);
    const n = values.length;
    const forecast: number[] = [];
    
    if (n < 10) {
      // Fallback to simple moving average
      return this.movingAverageForecast(values, horizon);
    }
    
    // Calculate parameters (simplified)
    const p = this.config.parameters?.p || 1;
    const d = this.config.parameters?.d || 1;
    const q = this.config.parameters?.q || 1;
    
    // Differencing (d)
    let diff = [...values];
    for (let i = 0; i < d; i++) {
      const temp: number[] = [];
      for (let j = 1; j < diff.length; j++) {
        temp.push(diff[j] - diff[j - 1]);
      }
      diff = temp;
    }
    
    // AR component (p)
    // MA component (q)
    // Combined forecast
    const lastValue = values[values.length - 1];
    const trend = this.calculateTrend(values);
    
    for (let i = 0; i < horizon; i++) {
      const seasonalComponent = this.getSeasonalComponent(i);
      const randomComponent = (Math.random() - 0.5) * 0.05 * lastValue;
      const predicted = lastValue + (trend * (i + 1)) + seasonalComponent + randomComponent;
      forecast.push(Math.max(0, predicted));
    }
    
    return forecast;
  }

  /**
   * Applies Prophet-style forecasting (simplified)
   */
  private applyProphetModel(data: HistoricalDataPoint[], horizon: number): number[] {
    const values = data.map(d => d.demand);
    const timestamps = data.map(d => d.timestamp);
    
    if (values.length < 10) {
      return this.movingAverageForecast(values, horizon);
    }
    
    const forecast: number[] = [];
    const trend = this.calculateTrend(values);
    const dailyPattern = this.estimateDailyPattern(data);
    const weeklyPattern = this.estimateWeeklyPattern(data);
    const yearlyPattern = this.estimateYearlyPattern(data);
    
    const lastIndex = values.length - 1;
    const lastValue = values[lastIndex];
    
    for (let i = 0; i < horizon; i++) {
      const timeOffset = i * 24 * 60 * 60 * 1000; // Convert to milliseconds
      const dayOffset = Math.floor((new Date(timestamps[lastIndex].getTime() + timeOffset).getDay()));
      const monthOffset = new Date(timestamps[lastIndex].getTime() + timeOffset).getMonth();
      
      const trendComponent = trend * (i + 1);
      const dailyComp = dailyPattern[dayOffset] || 0;
      const weeklyComp = weeklyPattern[new Date(timestamps[lastIndex].getTime() + timeOffset).getDay()] || 0;
      const yearlyComp = yearlyPattern[monthOffset] || 0;
      
      const predicted = lastValue + trendComponent + dailyComp + weeklyComp + yearlyComp;
      forecast.push(Math.max(0, predicted));
    }
    
    return forecast;
  }

  /**
   * Applies LSTM neural network model (simplified)
   */
  private applyLSTMModel(data: HistoricalDataPoint[], horizon: number): number[] {
    const values = data.map(d => d.demand);
    
    if (values.length < 20) {
      return this.movingAverageForecast(values, horizon);
    }
    
    // Simplified LSTM simulation - in production, use TensorFlow.js or similar
    const forecast: number[] = [];
    const windowSize = Math.min(7, values.length);
    
    // Simple sequential prediction
    for (let i = 0; i < horizon; i++) {
      let predicted = 0;
      let totalWeight = 0;
      
      for (let j = 1; j <= windowSize; j++) {
        const index = values.length - j;
        if (index >= 0) {
          const weight = 1 / j;
          predicted += values[index] * weight;
          totalWeight += weight;
        }
      }
      
      predicted = predicted / totalWeight;
      
      // Add some non-linearity and noise to simulate LSTM behavior
      const nonLinearFactor = 1 + Math.sin(i * 0.5) * 0.05;
      const noise = (Math.random() - 0.5) * 0.03 * predicted;
      predicted = predicted * nonLinearFactor + noise;
      
      forecast.push(Math.max(0, predicted));
      values.push(predicted);
    }
    
    return forecast;
  }

  /**
   * Ensembles multiple forecasts
   */
  private ensembleForecasts(
    arima: number[],
    prophet: number[],
    lstm: number[]
  ): number[] {
    const ensemble: number[] = [];
    const weights = {
      arima: 0.4,
      prophet: 0.35,
      lstm: 0.25
    };
    
    const minLength = Math.min(arima.length, prophet.length, lstm.length);
    
    for (let i = 0; i < minLength; i++) {
      const weighted = 
        arima[i] * weights.arima +
        prophet[i] * weights.prophet +
        lstm[i] * weights.lstm;
      ensemble.push(weighted);
    }
    
    return ensemble;
  }

  /**
   * Applies demand factors to forecast
   */
  private applyDemandFactors(
    forecast: number[],
    resource: CampusResource
  ): DemandForecast[] {
    const result: DemandForecast[] = [];
    const now = new Date();
    
    // Get academic calendar events
    const calendarEvents = this.getAcademicEventsInRange(now, this.config.timeHorizon);
    
    // Get special events
    const specialEvents = this.getSpecialEventsInRange(now, this.config.timeHorizon);
    
    for (let i = 0; i < forecast.length; i++) {
      const timestamp = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      
      // Calculate factors
      const dayOfWeekFactor = this.calculateDayOfWeekFactor(timestamp);
      const timeOfDayFactor = this.calculateTimeOfDayFactor(timestamp);
      const semesterFactor = this.calculateSemesterFactor(timestamp);
      const weatherImpact = this.calculateWeatherImpact(timestamp);
      
      // Find calendar impact
      let calendarImpact = 0;
      for (const event of calendarEvents) {
        if (Math.abs(event.date.getTime() - timestamp.getTime()) < 24 * 60 * 60 * 1000) {
          calendarImpact = event.impact;
          break;
        }
      }
      
      // Find special event impact
      let specialEventImpact = 0;
      for (const event of specialEvents) {
        if (timestamp >= event.startDate && timestamp <= event.endDate) {
          specialEventImpact = 0.5 + (event.expectedAttendance / 1000);
          break;
        }
      }
      
      const totalFactors = {
        academicCalendar: calendarEvents,
        weatherImpact: weatherImpact,
        specialEvents: specialEvents,
        historicalTrend: this.calculateHistoricalTrend(resource.id),
        dayOfWeekFactor: dayOfWeekFactor,
        timeOfDayFactor: timeOfDayFactor,
        semesterFactor: semesterFactor,
        externalFactors: {
          calendarImpact,
          specialEventImpact
        }
      };
      
      // Adjust forecast with factors
      let adjustedDemand = forecast[i];
      adjustedDemand *= (1 + calendarImpact * 0.1);
      adjustedDemand *= (1 + specialEventImpact * 0.05);
      adjustedDemand *= (1 + weatherImpact * 0.02);
      adjustedDemand *= (1 + dayOfWeekFactor * 0.05);
      adjustedDemand *= (1 + timeOfDayFactor * 0.03);
      adjustedDemand *= (1 + semesterFactor * 0.05);
      
      // Ensure within capacity
      adjustedDemand = Math.min(adjustedDemand, resource.capacity);
      adjustedDemand = Math.max(0, adjustedDemand);
      
      // Calculate confidence interval
      const confidenceLevel = this.calculateConfidenceLevel(i, forecast.length);
      const intervalSize = adjustedDemand * 0.1 * (1 - (i / forecast.length));
      
      result.push({
        resourceId: resource.id,
        timestamp: timestamp,
        predictedDemand: adjustedDemand,
        confidenceLevel: confidenceLevel,
        confidenceInterval: [adjustedDemand - intervalSize, adjustedDemand + intervalSize],
        factors: totalFactors,
        seasonalityIndex: this.calculateSeasonalityIndex(timestamp),
        trend: this.calculateHistoricalTrend(resource.id),
        residuals: this.calculateResiduals(forecast, i),
        modelVersion: '1.0.0'
      });
    }
    
    return result;
  }

  /**
   * Simple moving average forecast (fallback)
   */
  private movingAverageForecast(values: number[], horizon: number): number[] {
    const forecast: number[] = [];
    const windowSize = Math.min(7, values.length);
    
    if (values.length === 0) {
      return Array(horizon).fill(50); // Default value
    }
    
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const trend = this.calculateTrend(values);
    
    for (let i = 0; i < horizon; i++) {
      const predicted = avg + trend * (i + 1);
      forecast.push(Math.max(0, predicted));
    }
    
    return forecast;
  }

  /**
   * Calculates trend in historical data
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  /**
   * Gets seasonal component
   */
  private getSeasonalComponent(dayIndex: number): number {
    const seasonalityPeriod = this.mlConfig.parameters?.seasonalityPeriod || 7;
    const seasonality = Math.sin((dayIndex % seasonalityPeriod) / seasonalityPeriod * 2 * Math.PI) * 5;
    return seasonality;
  }

  /**
   * Estimates daily pattern from historical data
   */
  private estimateDailyPattern(data: HistoricalDataPoint[]): number[] {
    const pattern: number[] = Array(7).fill(0);
    const counts: number[] = Array(7).fill(0);
    
    for (const point of data) {
      const day = point.timestamp.getDay();
      pattern[day] += point.demand;
      counts[day]++;
    }
    
    for (let i = 0; i < 7; i++) {
      if (counts[i] > 0) {
        pattern[i] /= counts[i];
      }
    }
    
    return pattern;
  }

  /**
   * Estimates weekly pattern
   */
  private estimateWeeklyPattern(data: HistoricalDataPoint[]): number[] {
    return this.estimateDailyPattern(data);
  }

  /**
   * Estimates yearly pattern
   */
  private estimateYearlyPattern(data: HistoricalDataPoint[]): number[] {
    const pattern: number[] = Array(12).fill(0);
    const counts: number[] = Array(12).fill(0);
    
    for (const point of data) {
      const month = point.timestamp.getMonth();
      pattern[month] += point.demand;
      counts[month]++;
    }
    
    for (let i = 0; i < 12; i++) {
      if (counts[i] > 0) {
        pattern[i] /= counts[i];
      }
    }
    
    return pattern;
  }

  /**
   * Calculates day of week factor
   */
  private calculateDayOfWeekFactor(timestamp: Date): number {
    const day = timestamp.getDay();
    const factors = [0.8, 1.0, 1.0, 1.0, 1.0, 1.2, 0.6]; // Sun-Sat
    return factors[day] || 1.0;
  }

  /**
   * Calculates time of day factor
   */
  private calculateTimeOfDayFactor(timestamp: Date): number {
    const hour = timestamp.getHours();
    if (hour >= 8 && hour < 12) return 1.2;
    if (hour >= 12 && hour < 14) return 1.0;
    if (hour >= 14 && hour < 18) return 1.3;
    if (hour >= 18 && hour < 22) return 0.7;
    return 0.4;
  }

  /**
   * Calculates semester factor
   */
  private calculateSemesterFactor(timestamp: Date): number {
    const month = timestamp.getMonth();
    // Spring: Jan-Apr, Summer: May-Aug, Fall: Sep-Dec
    if (month >= 0 && month < 4) return 0.9;
    if (month >= 4 && month < 8) return 0.5;
    return 1.0;
  }

  /**
   * Calculates weather impact
   */
  private calculateWeatherImpact(timestamp: Date): number {
    // Simplified - in production, would use actual weather data
    const month = timestamp.getMonth();
    if (month >= 6 && month <= 8) return 0.1; // Summer - slightly lower demand
    if (month >= 11 || month <= 1) return -0.1; // Winter - slightly higher demand
    return 0;
  }

  /**
   * Calculates historical trend for resource
   */
  private calculateHistoricalTrend(resourceId: string): number {
    const data = this.getHistoricalDataForResource(resourceId, 30);
    if (data.length < 2) return 0;
    const values = data.map(d => d.demand);
    return this.calculateTrend(values);
  }

  /**
   * Calculates seasonality index
   */
  private calculateSeasonalityIndex(timestamp: Date): number {
    const dayOfYear = Math.floor((timestamp.getTime() - new Date(timestamp.getFullYear(), 0, 0).getTime()) / (24 * 60 * 60 * 1000));
    return Math.sin(dayOfYear / 365 * 2 * Math.PI);
  }

  /**
   * Calculates confidence level
   */
  private calculateConfidenceLevel(index: number, total: number): ConfidenceLevel {
    const ratio = index / total;
    if (ratio < 0.3) return ConfidenceLevel.HIGH;
    if (ratio < 0.6) return ConfidenceLevel.MEDIUM;
    if (ratio < 0.8) return ConfidenceLevel.LOW;
    return ConfidenceLevel.EXPERIMENTAL;
  }

  /**
   * Calculates residuals
   */
  private calculateResiduals(forecast: number[], index: number): number[] {
    // Simplified residual calculation
    return Array(10).fill(0).map(() => (Math.random() - 0.5) * 2);
  }

  /**
   * Gets historical data for a resource
   */
  private getHistoricalDataForResource(resourceId: string, days: number): HistoricalDataPoint[] {
    return this.historicalData
      .filter(d => d.resourceId === resourceId)
      .filter(d => d.timestamp > new Date(Date.now() - days * 24 * 60 * 60 * 1000))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Gets academic events in range
   */
  private getAcademicEventsInRange(start: Date, days: number): AcademicCalendarEvent[] {
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    return this.academicCalendar.filter(
      event => event.date >= start && event.date <= end
    );
  }

  /**
   * Gets special events in range
   */
  private getSpecialEventsInRange(start: Date, days: number): SpecialEvent[] {
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    return this.events.filter(
      event => event.startDate >= start && event.endDate <= end
    );
  }

  // ============================================================================
  // OPTIMIZATION METHODS
  // ============================================================================

  /**
   * Optimizes resource allocation for the entire campus
   */
  public optimizeResourceAllocation(
    resourceIds?: string[],
    config?: Partial<OptimizationConfig>
  ): OptimizationResult[] {
    const results: OptimizationResult[] = [];
    const targetResources = resourceIds || Array.from(this.resources.keys());
    
    // Update config if provided
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    // Get all resource optimizations
    for (const resourceId of targetResources) {
      if (!this.resources.has(resourceId)) continue;
      
      const result = this.optimizeSingleResource(resourceId);
      if (result) {
        results.push(result);
        this.optimizationCount++;
      }
    }
    
    // Calculate aggregate metrics
    let totalImprovement = 0;
    let totalCostSavings = 0;
    let totalSatisfaction = 0;
    
    for (const result of results) {
      totalImprovement += result.expectedImprovement;
      totalCostSavings += result.costSavings;
      totalSatisfaction += result.studentSatisfactionScore;
    }
    
    if (results.length > 0) {
      this.averageSatisfaction = totalSatisfaction / results.length;
      this.totalCostSavings += totalCostSavings;
    }
    
    this.lastOptimizationTime = new Date();
    
    // Record performance metrics
    this.recordPerformanceMetrics();
    
    return results;
  }

  /**
   * Optimizes a single resource
   */
  private optimizeSingleResource(resourceId: string): OptimizationResult | null {
    const resource = this.resources.get(resourceId);
    if (!resource) return null;
    
    // Get current forecast if available, or generate new
    let forecast = this.forecasts.get(resourceId);
    if (!forecast) {
      forecast = this.generateDemandForecast(resourceId, 7);
    }
    
    // Calculate current metrics
    const currentUtilization = resource.currentUtilization;
    const capacity = resource.capacity;
    
    // Calculate projected demand (average over forecast period)
    const projectedDemand = forecast.reduce((sum, f) => sum + f.predictedDemand, 0) / forecast.length;
    
    // Calculate optimal allocation based on strategy
    let recommendedAllocation = this.calculateOptimalAllocation(
      resource,
      projectedDemand,
      this.config.strategy
    );
    
    // Apply constraints
    recommendedAllocation = this.applyConstraints(recommendedAllocation, resource);
    
    // Calculate expected improvement
    const improvement = this.calculateImprovement(
      currentUtilization,
      recommendedAllocation / capacity
    );
    
    // Calculate cost savings
    const costSavings = this.calculateCostSavings(
      resource,
      currentUtilization,
      recommendedAllocation / capacity
    );
    
    // Calculate satisfaction score
    const satisfaction = this.calculateSatisfactionScore(
      recommendedAllocation,
      projectedDemand,
      capacity
    );
    
    // Calculate sustainability score
    const sustainability = this.calculateSustainabilityScore(
      recommendedAllocation,
      capacity,
      resource.type
    );
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(
      resource,
      currentUtilization,
      recommendedAllocation / capacity,
      projectedDemand
    );
    
    // Get constraints
    const constraints = this.getConstraintsForResource(resource);
    
    return {
      resourceId: resource.id,
      recommendedAllocation: recommendedAllocation,
      currentUtilization: currentUtilization,
      projectedDemand: projectedDemand,
      strategy: this.config.strategy,
      expectedImprovement: improvement,
      costSavings: costSavings,
      studentSatisfactionScore: satisfaction,
      sustainabilityScore: sustainability,
      recommendations: recommendations,
      constraints: constraints,
      timeframe: this.config.granularity
    };
  }

  /**
   * Calculates optimal allocation based on strategy
   */
  private calculateOptimalAllocation(
    resource: CampusResource,
    projectedDemand: number,
    strategy: OptimizationStrategy
  ): number {
    const capacity = resource.capacity;
    let allocation: number;
    
    switch (strategy) {
      case OptimizationStrategy.COST_MINIMIZATION:
        // Minimize cost by reducing allocation when possible
        allocation = Math.min(projectedDemand * 0.9, capacity * 0.8);
        break;
        
      case OptimizationStrategy.UTILIZATION_MAXIMIZATION:
        // Maximize utilization by increasing allocation
        allocation = Math.min(projectedDemand * 1.2, capacity * 0.95);
        break;
        
      case OptimizationStrategy.STUDENT_SATISFACTION:
        // Balance for student satisfaction
        allocation = Math.min(projectedDemand * 1.1, capacity * 0.9);
        break;
        
      case OptimizationStrategy.SUSTAINABILITY:
        // Sustainable allocation
        allocation = Math.min(projectedDemand * 1.0, capacity * 0.75);
        break;
        
      case OptimizationStrategy.BALANCED:
      default:
        // Balanced approach
        allocation = Math.min(projectedDemand, capacity * 0.85);
        break;
    }
    
    return Math.max(0, Math.min(allocation, capacity));
  }

  /**
   * Applies constraints to allocation
   */
  private applyConstraints(allocation: number, resource: CampusResource): number {
    // Capacity constraint
    allocation = Math.min(allocation, resource.capacity);
    
    // Minimum utilization constraint (at least 20% of capacity)
    allocation = Math.max(allocation, resource.capacity * 0.2);
    
    // Operational hours constraint (reduce allocation during off-hours)
    // This would be more complex in production
    
    return allocation;
  }

  /**
   * Calculates expected improvement
   */
  private calculateImprovement(current: number, proposed: number): number {
    if (current === 0) return proposed * 100;
    return ((proposed - current) / current) * 100;
  }

  /**
   * Calculates cost savings
   */
  private calculateCostSavings(
    resource: CampusResource,
    currentUtilization: number,
    proposedUtilization: number
  ): number {
    const currentCost = currentUtilization * resource.costPerHour * 24; // Daily cost
    const proposedCost = proposedUtilization * resource.costPerHour * 24;
    return currentCost - proposedCost;
  }

  /**
   * Calculates student satisfaction score
   */
  private calculateSatisfactionScore(
    allocation: number,
    demand: number,
    capacity: number
  ): number {
    // Satisfaction is highest when allocation meets demand but doesn't exceed capacity
    const ratio = allocation / Math.max(demand, 1);
    if (ratio >= 1 && ratio <= 1.2) return 0.95;
    if (ratio >= 0.8 && ratio < 1) return 0.85;
    if (ratio >= 0.6 && ratio < 0.8) return 0.70;
    if (ratio < 0.6) return 0.50;
    // Over-allocation reduces satisfaction due to crowding
    if (ratio > 1.2 && ratio <= 1.5) return 0.80;
    if (ratio > 1.5) return 0.60;
    return 0.70;
  }

  /**
   * Calculates sustainability score
   */
  private calculateSustainabilityScore(
    allocation: number,
    capacity: number,
    resourceType: ResourceType
  ): number {
    const utilizationRate = allocation / capacity;
    
    // Optimal sustainability is around 80% utilization
    if (utilizationRate >= 0.75 && utilizationRate <= 0.85) return 0.95;
    if (utilizationRate >= 0.65 && utilizationRate < 0.75) return 0.85;
    if (utilizationRate >= 0.55 && utilizationRate < 0.65) return 0.75;
    if (utilizationRate >= 0.45 && utilizationRate < 0.55) return 0.65;
    if (utilizationRate < 0.45) return 0.50;
    // Over-utilization reduces sustainability
    if (utilizationRate > 0.85 && utilizationRate <= 0.90) return 0.80;
    if (utilizationRate > 0.90) return 0.60;
    return 0.70;
  }

  /**
   * Generates recommendations for resource optimization
   */
  private generateRecommendations(
    resource: CampusResource,
    currentUtilization: number,
    proposedUtilization: number,
    projectedDemand: number
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    if (currentUtilization < 0.4) {
      recommendations.push({
        action: `Increase utilization of ${resource.name} by promoting availability`,
        priority: PriorityLevel.MEDIUM,
        expectedImpact: 15,
        implementationCost: 100,
        timeframe: '1 week',
        responsibleParty: 'Resource Manager'
      });
    }
    
    if (currentUtilization > 0.85) {
      recommendations.push({
        action: `Expand capacity or reduce demand for ${resource.name}`,
        priority: PriorityLevel.HIGH,
        expectedImpact: 25,
        implementationCost: 5000,
        timeframe: '1 month',
        responsibleParty: 'Facilities Planning'
      });
    }
    
    if (projectedDemand > resource.capacity) {
      recommendations.push({
        action: `Prepare for demand surge - consider temporary expansion for ${resource.name}`,
        priority: PriorityLevel.CRITICAL,
        expectedImpact: 30,
        implementationCost: 2000,
        timeframe: '2 weeks',
        responsibleParty: 'Emergency Planning'
      });
    }
    
    // Add maintenance recommendations
    if (resource.maintenanceSchedule.some(m => !m.isCompleted)) {
      recommendations.push({
        action: `Schedule maintenance for ${resource.name} during low demand periods`,
        priority: PriorityLevel.MEDIUM,
        expectedImpact: 10,
        implementationCost: 500,
        timeframe: '1 month',
        responsibleParty: 'Maintenance Team'
      });
    }
    
    // Cost optimization recommendations
    if (resource.costPerHour > 100 && currentUtilization < 0.5) {
      recommendations.push({
        action: `Consider temporary closure or reduced hours for ${resource.name}`,
        priority: PriorityLevel.HIGH,
        expectedImpact: 40,
        implementationCost: 0,
        timeframe: 'Immediate',
        responsibleParty: 'Budget Office'
      });
    }
    
    return recommendations;
  }

  /**
   * Gets constraints for a resource
   */
  private getConstraintsForResource(resource: CampusResource): Constraint[] {
    const constraints: Constraint[] = [];
    
    // Budget constraint
    if (resource.costPerHour > 100) {
      constraints.push({
        type: 'BUDGET',
        description: `High operational cost for ${resource.name}`,
        severity: 0.7
      });
    }
    
    // Capacity constraint
    constraints.push({
      type: 'CAPACITY',
      description: `Physical capacity of ${resource.name}: ${resource.capacity}`,
      severity: 0.9
    });
    
    // Personnel constraint
    if (resource.type === ResourceType.FACULTY || resource.type === ResourceType.LABORATORY) {
      constraints.push({
        type: 'PERSONNEL',
        description: `Specialized personnel required for ${resource.name}`,
        severity: 0.8
      });
    }
    
    // Regulatory constraints for labs
    if (resource.type === ResourceType.LABORATORY) {
      constraints.push({
        type: 'REGULATORY',
        description: 'Safety and compliance requirements',
        severity: 1.0
      });
    }
    
    return constraints;
  }

  // ============================================================================
  // RESOURCE MANAGEMENT METHODS
  // ============================================================================

  /**
   * Adds a new resource to the system
   */
  public addResource(resource: CampusResource): boolean {
    if (this.resources.has(resource.id)) {
      return false;
    }
    
    this.resources.set(resource.id, resource);
    return true;
  }

  /**
   * Updates an existing resource
   */
  public updateResource(resourceId: string, updates: Partial<CampusResource>): boolean {
    if (!this.resources.has(resourceId)) {
      return false;
    }
    
    const existing = this.resources.get(resourceId)!;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.resources.set(resourceId, updated);
    return true;
  }

  /**
   * Removes a resource from the system
   */
  public removeResource(resourceId: string): boolean {
    if (!this.resources.has(resourceId)) {
      return false;
    }
    
    // Clean up related data
    this.forecasts.delete(resourceId);
    this.resources.delete(resourceId);
    return true;
  }

  /**
   * Gets all resources
   */
  public getAllResources(): CampusResource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Gets resources by type
   */
  public getResourcesByType(type: ResourceType): CampusResource[] {
    return Array.from(this.resources.values()).filter(r => r.type === type);
  }

  /**
   * Gets resources by location
   */
  public getResourcesByLocation(location: string): CampusResource[] {
    return Array.from(this.resources.values()).filter(r => r.location.includes(location));
  }

  /**
   * Gets resources by availability
   */
  public getAvailableResources(
    startTime: Date,
    endTime: Date,
    type?: ResourceType
  ): CampusResource[] {
    // This would check operational hours and current allocations
    let resources = Array.from(this.resources.values());
    
    if (type) {
      resources = resources.filter(r => r.type === type);
    }
    
    return resources.filter(r => this.isResourceAvailable(r, startTime, endTime));
  }

  /**
   * Checks if a resource is available during specified time
   */
  private isResourceAvailable(resource: CampusResource, start: Date, end: Date): boolean {
    // Simplified availability check
    // In production, would check against scheduled allocations and maintenance
    
    // Check maintenance
    for (const maintenance of resource.maintenanceSchedule) {
      if (!maintenance.isCompleted &&
          start < maintenance.endDate &&
          end > maintenance.startDate) {
        return false;
      }
    }
    
    // Check operational hours
    const dayOfWeek = start.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = dayNames[dayOfWeek] as keyof OperationalHours;
    
    const slots = resource.operationalHours[dayKey];
    if (!slots || slots.length === 0) return false;
    
    // Check if time falls within any operational slot
    const startHour = start.getHours();
    const startMinute = start.getMinutes();
    const startTime = startHour * 60 + startMinute;
    
    for (const slot of slots) {
      if (!slot.isAvailable) continue;
      
      const [startH, startM] = slot.start.split(':').map(Number);
      const [endH, endM] = slot.end.split(':').map(Number);
      const slotStart = startH * 60 + startM;
      const slotEnd = endH * 60 + endM;
      
      if (startTime >= slotStart && startTime < slotEnd) {
        return true;
      }
    }
    
    return false;
  }

  // ============================================================================
  // DATA MANAGEMENT METHODS
  // ============================================================================

  /**
   * Adds historical data point
   */
  public addHistoricalData(dataPoint: HistoricalDataPoint): void {
    this.historicalData.push(dataPoint);
    
    // Trim historical data if too large
    if (this.historicalData.length > 10000) {
      this.historicalData = this.historicalData.slice(-5000);
    }
  }

  /**
   * Adds multiple historical data points
   */
  public addHistoricalDataBatch(dataPoints: HistoricalDataPoint[]): void {
    for (const point of dataPoints) {
      this.addHistoricalData(point);
    }
  }

  /**
   * Gets historical data for analysis
   */
  public getHistoricalData(
    startDate?: Date,
    endDate?: Date,
    resourceId?: string
  ): HistoricalDataPoint[] {
    let data = this.historicalData;
    
    if (startDate) {
      data = data.filter(d => d.timestamp >= startDate);
    }
    
    if (endDate) {
      data = data.filter(d => d.timestamp <= endDate);
    }
    
    if (resourceId) {
      data = data.filter(d => d.resourceId === resourceId);
    }
    
    return data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Generates synthetic historical data for testing
   */
  public generateSyntheticData(
    resourceId: string,
    days: number = 90,
    baseDemand: number = 100,
    variability: number = 0.2
  ): void {
    if (!this.resources.has(resourceId)) return;
    
    const resource = this.resources.get(resourceId)!;
    const data: HistoricalDataPoint[] = [];
    const now = new Date();
    
    for (let i = days; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayOfWeek = timestamp.getDay();
      const hourOfDay = timestamp.getHours();
      
      // Base pattern
      let demand = baseDemand;
      
      // Day of week pattern
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        demand *= 0.5; // Weekend
      } else {
        demand *= 1.2; // Weekday
      }
      
      // Hour of day pattern
      if (hourOfDay >= 8 && hourOfDay < 12) {
        demand *= 1.3;
      } else if (hourOfDay >= 12 && hourOfDay < 14) {
        demand *= 1.1;
      } else if (hourOfDay >= 14 && hourOfDay < 18) {
        demand *= 1.4;
      } else if (hourOfDay >= 18 && hourOfDay < 22) {
        demand *= 0.8;
      } else {
        demand *= 0.2;
      }
      
      // Add variability
      const noise = (Math.random() - 0.5) * 2 * variability * demand;
      demand += noise;
      
      // Ensure within capacity
      demand = Math.max(0, Math.min(demand, resource.capacity));
      
      // Utilization is demand / capacity
      const utilization = demand / resource.capacity;
      
      // Random weather
      const weather: WeatherData = {
        temperature: 15 + Math.random() * 20,
        precipitation: Math.random() * 10,
        windSpeed: Math.random() * 15,
        condition: ['Sunny', 'Cloudy', 'Rainy', 'Snowy'][Math.floor(Math.random() * 4)]
      };
      
      data.push({
        timestamp: timestamp,
        resourceId: resourceId,
        utilization: utilization,
        demand: demand,
        capacity: resource.capacity,
        weather: weather,
        events: [],
        semester: this.getSemesterForDate(timestamp),
        dayOfWeek: dayOfWeek,
        hourOfDay: hourOfDay
      });
    }
    
    this.addHistoricalDataBatch(data);
  }

  /**
   * Gets semester for a date
   */
  private getSemesterForDate(date: Date): string {
    const month = date.getMonth();
    const day = date.getDate();
    
    // Spring: Jan 15 - May 20
    if ((month === 0 && day >= 15) || (month >= 1 && month <= 3) || (month === 4 && day <= 20)) {
      return 'Spring';
    }
    // Summer: Jun 1 - Aug 15
    if ((month === 5 && day >= 1) || (month >= 6 && month <= 7) || (month === 8 && day <= 15)) {
      return 'Summer';
    }
    // Fall: Sep 1 - Dec 10
    if ((month === 8 && day >= 1) || (month >= 9 && month <= 10) || (month === 11 && day <= 10)) {
      return 'Fall';
    }
    return 'Winter';
  }

  // ============================================================================
  // PERFORMANCE METRICS METHODS
  // ============================================================================

  /**
   * Records performance metrics
   */
  private recordPerformanceMetrics(): void {
    const resources = Array.from(this.resources.values());
    const totalUtilization = resources.reduce((sum, r) => sum + r.currentUtilization, 0);
    const avgUtilization = totalUtilization / resources.length;
    
    // Get peak demand
    let peakDemand = 0;
    for (const forecast of this.forecasts.values()) {
      for (const f of forecast) {
        if (f.predictedDemand > peakDemand) {
          peakDemand = f.predictedDemand;
        }
      }
    }
    
    // Calculate metrics
    const metrics: PerformanceMetrics = {
      overallUtilization: avgUtilization,
      peakDemand: peakDemand,
      averageResponseTime: this.calculateAverageResponseTime(),
      costEfficiency: this.calculateCostEfficiency(),
      studentSatisfaction: this.averageSatisfaction,
      resourceAvailability: this.calculateResourceAvailability(),
      optimizationScore: this.calculateOptimizationScore(),
      timestamp: new Date()
    };
    
    this.performanceHistory.push(metrics);
    
    // Trim history
    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-50);
    }
  }

  /**
   * Calculates average response time
   */
  private calculateAverageResponseTime(): number {
    // Simulated response time in seconds
    return 0.5 + Math.random() * 2;
  }

  /**
   * Calculates cost efficiency
   */
  private calculateCostEfficiency(): number {
    // Ratio of utilization to cost
    const resources = Array.from(this.resources.values());
    let totalUtilCost = 0;
    let totalCost = 0;
    
    for (const r of resources) {
      totalUtilCost += r.currentUtilization * r.costPerHour;
      totalCost += r.costPerHour;
    }
    
    if (totalCost === 0) return 0;
    return totalUtilCost / totalCost;
  }

  /**
   * Calculates resource availability
   */
  private calculateResourceAvailability(): number {
    const resources = Array.from(this.resources.values());
    const activeResources = resources.filter(r => r.isActive);
    return activeResources.length / (resources.length || 1);
  }

  /**
   * Calculates optimization score
   */
  private calculateOptimizationScore(): number {
    // Composite score based on multiple factors
    const utilization = this.getAverageUtilization();
    const efficiency = this.calculateCostEfficiency();
    const satisfaction = this.averageSatisfaction;
    
    return (utilization * 0.4 + efficiency * 0.3 + satisfaction * 0.3);
  }

  /**
   * Gets average utilization
   */
  public getAverageUtilization(): number {
    const resources = Array.from(this.resources.values());
    if (resources.length === 0) return 0;
    const total = resources.reduce((sum, r) => sum + r.currentUtilization, 0);
    return total / resources.length;
  }

  /**
   * Gets performance metrics history
   */
  public getPerformanceMetrics(): PerformanceMetrics[] {
    return [...this.performanceHistory];
  }

  // ============================================================================
  // EVENT MANAGEMENT METHODS
  // ============================================================================

  /**
   * Adds a special event
   */
  public addSpecialEvent(event: SpecialEvent): boolean {
    if (this.events.find(e => e.id === event.id)) {
      return false;
    }
    this.events.push(event);
    return true;
  }

  /**
   * Removes a special event
   */
  public removeSpecialEvent(eventId: string): boolean {
    const index = this.events.findIndex(e => e.id === eventId);
    if (index === -1) return false;
    this.events.splice(index, 1);
    return true;
  }

  /**
   * Gets all special events
   */
  public getSpecialEvents(): SpecialEvent[] {
    return [...this.events];
  }

  /**
   * Gets upcoming special events
   */
  public getUpcomingSpecialEvents(days: number = 30): SpecialEvent[] {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return this.events.filter(
      e => e.startDate >= now && e.startDate <= future
    );
  }

  // ============================================================================
  // NOTIFICATION METHODS
  // ============================================================================

  /**
   * Checks for alert conditions
   */
  public checkAlerts(config: NotificationConfig): string[] {
    const alerts: string[] = [];
    const resources = Array.from(this.resources.values());
    
    for (const resource of resources) {
      // Check utilization thresholds
      if (resource.currentUtilization > config.thresholds.utilizationCritical) {
        alerts.push(`CRITICAL: ${resource.name} utilization at ${(resource.currentUtilization * 100).toFixed(1)}%`);
      } else if (resource.currentUtilization > config.thresholds.utilizationWarning) {
        alerts.push(`WARNING: ${resource.name} utilization at ${(resource.currentUtilization * 100).toFixed(1)}%`);
      }
      
      // Check forecast for capacity shortages
      const forecast = this.forecasts.get(resource.id);
      if (forecast) {
        const futureDemand = forecast.slice(0, 7).reduce((sum, f) => sum + f.predictedDemand, 0) / 7;
        if (futureDemand > resource.capacity * config.thresholds.capacityShortage) {
          alerts.push(`ALERT: ${resource.name} projected to exceed ${(config.thresholds.capacityShortage * 100)}% capacity in next 7 days`);
        }
      }
    }
    
    return alerts;
  }

  // ============================================================================
  // REPORTING METHODS
  // ============================================================================

  /**
   * Generates a comprehensive report
   */
  public generateReport(
    startDate: Date,
    endDate: Date,
    resourceId?: string
  ): any {
    const report: any = {
      generatedAt: new Date(),
      startDate: startDate,
      endDate: endDate,
      summary: {},
      details: {},
      recommendations: []
    };
    
    // Get data for report
    const data = this.getHistoricalData(startDate, endDate, resourceId);
    const resources = resourceId 
      ? [this.resources.get(resourceId)].filter(Boolean) as CampusResource[]
      : Array.from(this.resources.values());
    
    // Calculate summary statistics
    let totalDemand = 0;
    let totalCapacity = 0;
    let totalUtilization = 0;
    
    for (const resource of resources) {
      const resourceData = data.filter(d => d.resourceId === resource.id);
      if (resourceData.length > 0) {
        const avgDemand = resourceData.reduce((sum, d) => sum + d.demand, 0) / resourceData.length;
        const avgUtilization = resourceData.reduce((sum, d) => sum + d.utilization, 0) / resourceData.length;
        totalDemand += avgDemand;
        totalCapacity += resource.capacity;
        totalUtilization += avgUtilization;
      }
    }
    
    report.summary = {
      totalResources: resources.length,
      totalDemand: totalDemand,
      totalCapacity: totalCapacity,
      averageUtilization: resources.length > 0 ? totalUtilization / resources.length : 0,
      dataPoints: data.length
    };
    
    // Generate details for each resource
    report.details = {};
    for (const resource of resources) {
      const resourceData = data.filter(d => d.resourceId === resource.id);
      const forecast = this.forecasts.get(resource.id);
      
      report.details[resource.id] = {
        name: resource.name,
        type: resource.type,
        location: resource.location,
        capacity: resource.capacity,
        currentUtilization: resource.currentUtilization,
        dataPoints: resourceData.length,
        averageDemand: resourceData.length > 0 
          ? resourceData.reduce((sum, d) => sum + d.demand, 0) / resourceData.length 
          : 0,
        forecastAvailable: !!forecast,
        optimizationResult: this.optimizationCount > 0 
          ? this.optimizeSingleResource(resource.id) 
          : null
      };
    }
    
    // Generate recommendations
    const metrics = this.getPerformanceMetrics();
    if (metrics.length > 0) {
      const lastMetric = metrics[metrics.length - 1];
      if (lastMetric.overallUtilization < 0.5) {
        report.recommendations.push('Consider promoting underutilized resources or reducing capacity');
      }
      if (lastMetric.overallUtilization > 0.85) {
        report.recommendations.push('Consider expanding capacity for overutilized resources');
      }
      if (lastMetric.costEfficiency < 0.5) {
        report.recommendations.push('Review cost efficiency - consider optimization strategies');
      }
    }
    
    // Add alert recommendations
    const alerts = this.checkAlerts({
      email: true,
      sms: false,
      dashboard: true,
      webhook: false,
      thresholds: {
        utilizationWarning: 0.75,
        utilizationCritical: 0.90,
        demandSpike: 1.2,
        capacityShortage: 0.85
      }
    });
    
    if (alerts.length > 0) {
      report.recommendations.push('Alert: ' + alerts.join('; '));
    }
    
    return report;
  }

  /**
   * Generates CSV export of historical data
   */
  public exportHistoricalDataCSV(
    startDate?: Date,
    endDate?: Date,
    resourceId?: string
  ): string {
    const data = this.getHistoricalData(startDate, endDate, resourceId);
    
    if (data.length === 0) {
      return 'No data available';
    }
    
    // CSV header
    let csv = 'Timestamp,ResourceId,Utilization,Demand,Capacity,Temperature,Precipitation,WindSpeed,Condition,DayOfWeek,HourOfDay,Semester\n';
    
    // CSV rows
    for (const point of data) {
      csv += `${point.timestamp.toISOString()},${point.resourceId},${point.utilization.toFixed(4)},${point.demand.toFixed(2)},${point.capacity},${point.weather.temperature.toFixed(1)},${point.weather.precipitation.toFixed(1)},${point.weather.windSpeed.toFixed(1)},${point.weather.condition},${point.dayOfWeek},${point.hourOfDay},${point.semester}\n`;
    }
    
    return csv;
  }

  // ============================================================================
  // SYSTEM MANAGEMENT METHODS
  // ============================================================================

  /**
   * Starts the engine
   */
  public start(): void {
    if (this.isRunning) {
      console.log('Engine is already running');
      return;
    }
    
    this.isRunning = true;
    console.log('Predictive Campus Resource Engine started');
    
    // Initial optimization
    this.optimizeResourceAllocation();
    
    // Generate synthetic data if needed
    if (this.historicalData.length === 0) {
      for (const resource of this.resources.values()) {
        this.generateSyntheticData(resource.id, 60, resource.capacity * 0.6, 0.25);
      }
    }
  }

  /**
   * Stops the engine
   */
  public stop(): void {
    if (!this.isRunning) {
      console.log('Engine is already stopped');
      return;
    }
    
    this.isRunning = false;
    console.log('Predictive Campus Resource Engine stopped');
  }

  /**
   * Resets the engine
   */
  public reset(): void {
    this.stop();
    this.resources.clear();
    this.historicalData = [];
    this.forecasts.clear();
    this.allocations.clear();
    this.performanceHistory = [];
    this.events = [];
    this.optimizationCount = 0;
    this.totalCostSavings = 0;
    this.averageSatisfaction = 0;
    this.lastOptimizationTime = null;
    
    // Re-initialize
    this.initializeSystemResources();
    console.log('Engine reset successfully');
  }

  /**
   * Gets engine status
   */
  public getStatus(): any {
    return {
      isRunning: this.isRunning,
      totalResources: this.resources.size,
      historicalDataPoints: this.historicalData.length,
      forecastCount: this.forecasts.size,
      allocationCount: this.allocations.size,
      optimizationCount: this.optimizationCount,
      totalCostSavings: this.totalCostSavings,
      averageSatisfaction: this.averageSatisfaction,
      lastOptimizationTime: this.lastOptimizationTime,
      performanceHistoryCount: this.performanceHistory.length,
      eventsCount: this.events.length,
      engineVersion: '1.0.0',
      uptime: this.isRunning ? process.uptime() : 0
    };
  }

  /**
   * Saves engine state to file
   */
  public saveState(filePath: string): void {
    const state = {
      resources: Array.from(this.resources.entries()),
      historicalData: this.historicalData,
      forecasts: Array.from(this.forecasts.entries()),
      events: this.events,
      optimizationCount: this.optimizationCount,
      totalCostSavings: this.totalCostSavings,
      averageSatisfaction: this.averageSatisfaction,
      lastOptimizationTime: this.lastOptimizationTime,
      performanceHistory: this.performanceHistory,
      timestamp: new Date()
    };
    
    try {
      fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
      console.log(`State saved to ${filePath}`);
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }

  /**
   * Loads engine state from file
   */
  public loadState(filePath: string): boolean {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const state = JSON.parse(data);
      
      // Restore resources
      this.resources.clear();
      for (const [id, resource] of state.resources) {
        resource.createdAt = new Date(resource.createdAt);
        resource.updatedAt = new Date(resource.updatedAt);
        this.resources.set(id, resource);
      }
      
      // Restore historical data
      this.historicalData = state.historicalData.map((d: any) => ({
        ...d,
        timestamp: new Date(d.timestamp)
      }));
      
      // Restore forecasts
      this.forecasts.clear();
      for (const [id, forecast] of state.forecasts) {
        const typedForecast = forecast.map((f: any) => ({
          ...f,
          timestamp: new Date(f.timestamp)
        }));
        this.forecasts.set(id, typedForecast);
      }
      
      // Restore events
      this.events = state.events;
      
      // Restore metrics
      this.optimizationCount = state.optimizationCount;
      this.totalCostSavings = state.totalCostSavings;
      this.averageSatisfaction = state.averageSatisfaction;
      this.lastOptimizationTime = state.lastOptimizationTime ? new Date(state.lastOptimizationTime) : null;
      this.performanceHistory = state.performanceHistory;
      
      console.log(`State loaded from ${filePath}`);
      return true;
    } catch (error) {
      console.error('Error loading state:', error);
      return false;
    }
  }

  // ============================================================================
  // ANALYTICS AND VISUALIZATION METHODS
  // ============================================================================

  /**
   * Calculates resource utilization trends
   */
  public calculateUtilizationTrends(
    resourceId?: string,
    days: number = 30
  ): any {
    const data = this.getHistoricalData(
      new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      new Date(),
      resourceId
    );
    
    if (data.length === 0) {
      return { message: 'Insufficient data' };
    }
    
    // Group by day
    const dailyData: Map<string, { sum: number; count: number }> = new Map();
    for (const point of data) {
      const key = point.timestamp.toISOString().split('T')[0];
      if (!dailyData.has(key)) {
        dailyData.set(key, { sum: 0, count: 0 });
      }
      const entry = dailyData.get(key)!;
      entry.sum += point.utilization;
      entry.count++;
    }
    
    const trends: any[] = [];
    for (const [date, entry] of dailyData) {
      trends.push({
        date: date,
        averageUtilization: entry.sum / entry.count,
        dataPoints: entry.count
      });
    }
    
    trends.sort((a, b) => a.date.localeCompare(b.date));
    
    // Calculate statistics
    const utilValues = trends.map(t => t.averageUtilization);
    const avg = utilValues.reduce((a, b) => a + b, 0) / utilValues.length;
    const max = Math.max(...utilValues);
    const min = Math.min(...utilValues);
    const variance = utilValues.reduce((a, b) => a + (b - avg) ** 2, 0) / utilValues.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      trends: trends,
      statistics: {
        average: avg,
        maximum: max,
        minimum: min,
        standardDeviation: stdDev,
        totalDataPoints: data.length
      }
    };
  }

  /**
   * Calculates demand patterns
   */
  public calculateDemandPatterns(resourceId?: string): any {
    const data = this.getHistoricalData(undefined, undefined, resourceId);
    
    if (data.length === 0) {
      return { message: 'Insufficient data' };
    }
    
    // Hourly pattern
    const hourlyPattern: Map<number, { sum: number; count: number }> = new Map();
    for (let i = 0; i < 24; i++) {
      hourlyPattern.set(i, { sum: 0, count: 0 });
    }
    
    // Daily pattern
    const dailyPattern: Map<number, { sum: number; count: number }> = new Map();
    for (let i = 0; i < 7; i++) {
      dailyPattern.set(i, { sum: 0, count: 0 });
    }
    
    for (const point of data) {
      const hour = point.timestamp.getHours();
      const day = point.timestamp.getDay();
      
      const hourEntry = hourlyPattern.get(hour)!;
      hourEntry.sum += point.demand;
      hourEntry.count++;
      
      const dayEntry = dailyPattern.get(day)!;
      dayEntry.sum += point.demand;
      dayEntry.count++;
    }
    
    // Convert to arrays
    const hourly: any[] = [];
    for (const [hour, entry] of hourlyPattern) {
      if (entry.count > 0) {
        hourly.push({
          hour: hour,
          averageDemand: entry.sum / entry.count,
          dataPoints: entry.count
        });
      }
    }
    hourly.sort((a, b) => a.hour - b.hour);
    
    const daily: any[] = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (const [day, entry] of dailyPattern) {
      if (entry.count > 0) {
        daily.push({
          day: dayNames[day],
          averageDemand: entry.sum / entry.count,
          dataPoints: entry.count
        });
      }
    }
    daily.sort((a, b) => dayNames.indexOf(a.day) - dayNames.indexOf(b.day));
    
    return {
      hourlyPattern: hourly,
      dailyPattern: daily,
      totalDataPoints: data.length
    };
  }

  /**
   * Calculates resource utilization heatmap data
   */
  public calculateHeatmapData(
    days: number = 7,
    resourceId?: string
  ): any[][] {
    const data = this.getHistoricalData(
      new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      new Date(),
      resourceId
    );
    
    if (data.length === 0) {
      return [];
    }
    
    // Create heatmap grid: hours x days
    const heatmap: Map<string, { sum: number; count: number }> = new Map();
    
    for (const point of data) {
      const hour = point.timestamp.getHours();
      const day = point.timestamp.getDay();
      const key = `${day}-${hour}`;
      
      if (!heatmap.has(key)) {
        heatmap.set(key, { sum: 0, count: 0 });
      }
      const entry = heatmap.get(key)!;
      entry.sum += point.utilization;
      entry.count++;
    }
    
    // Convert to 2D array
    const result: any[][] = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (let day = 0; day < 7; day++) {
      const row: any[] = [];
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}-${hour}`;
        if (heatmap.has(key)) {
          const entry = heatmap.get(key)!;
          row.push({
            hour: hour,
            day: dayNames[day],
            utilization: entry.sum / entry.count,
            dataPoints: entry.count
          });
        } else {
          row.push({
            hour: hour,
            day: dayNames[day],
            utilization: 0,
            dataPoints: 0
          });
        }
      }
      result.push(row);
    }
    
    return result;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Validates a resource object
   */
  public validateResource(resource: CampusResource): string[] {
    const errors: string[] = [];
    
    if (!resource.id) errors.push('Resource ID is required');
    if (!resource.name) errors.push('Resource name is required');
    if (!resource.type) errors.push('Resource type is required');
    if (!resource.location) errors.push('Resource location is required');
    if (resource.capacity <= 0) errors.push('Capacity must be greater than 0');
    if (resource.currentUtilization < 0 || resource.currentUtilization > 1) {
      errors.push('Current utilization must be between 0 and 1');
    }
    if (resource.costPerHour < 0) errors.push('Cost per hour must be non-negative');
    if (resource.tags && !Array.isArray(resource.tags)) {
      errors.push('Tags must be an array');
    }
    
    return errors;
  }

  /**
   * Calculates resource similarity
   */
  public calculateResourceSimilarity(
    resourceId1: string,
    resourceId2: string
  ): number {
    const r1 = this.resources.get(resourceId1);
    const r2 = this.resources.get(resourceId2);
    
    if (!r1 || !r2) {
      return 0;
    }
    
    let similarity = 0;
    let totalWeight = 0;
    
    // Type similarity
    if (r1.type === r2.type) {
      similarity += 0.3;
    }
    totalWeight += 0.3;
    
    // Location similarity
    if (r1.location === r2.location) {
      similarity += 0.2;
    }
    totalWeight += 0.2;
    
    // Capacity similarity (inverse relative difference)
    const capacityDiff = Math.abs(r1.capacity - r2.capacity) / Math.max(r1.capacity, r2.capacity);
    const capacitySimilarity = 1 - Math.min(capacityDiff, 1);
    similarity += capacitySimilarity * 0.2;
    totalWeight += 0.2;
    
    // Tag overlap
    const commonTags = r1.tags.filter(tag => r2.tags.includes(tag));
    const tagSimilarity = commonTags.length / Math.max(r1.tags.length, r2.tags.length, 1);
    similarity += tagSimilarity * 0.2;
    totalWeight += 0.2;
    
    // Utilization similarity
    const utilDiff = Math.abs(r1.currentUtilization - r2.currentUtilization);
    const utilSimilarity = 1 - Math.min(utilDiff, 1);
    similarity += utilSimilarity * 0.1;
    totalWeight += 0.1;
    
    return similarity / totalWeight;
  }

  /**
   * Finds similar resources
   */
  public findSimilarResources(
    resourceId: string,
    threshold: number = 0.5
  ): Array<{ resourceId: string; similarity: number }> {
    const results: Array<{ resourceId: string; similarity: number }> = [];
    
    for (const id of this.resources.keys()) {
      if (id === resourceId) continue;
      
      const similarity = this.calculateResourceSimilarity(resourceId, id);
      if (similarity >= threshold) {
        results.push({ resourceId: id, similarity });
      }
    }
    
    return results.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Formats currency
   */
  public formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  /**
   * Formats percentage
   */
  public formatPercentage(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }

  /**
   * Calculates moving average
   */
  public calculateMovingAverage(
    data: number[],
    windowSize: number = 7
  ): number[] {
    if (data.length < windowSize) {
      return [];
    }
    
    const result: number[] = [];
    for (let i = 0; i <= data.length - windowSize; i++) {
      const window = data.slice(i, i + windowSize);
      const avg = window.reduce((a, b) => a + b, 0) / windowSize;
      result.push(avg);
    }
    
    return result;
  }

  /**
   * Detects anomalies in utilization data
   */
  public detectAnomalies(
    resourceId: string,
    threshold: number = 2.5
  ): Array<{ timestamp: Date; utilization: number; score: number }> {
    const data = this.getHistoricalData(undefined, undefined, resourceId);
    
    if (data.length < 10) {
      return [];
    }
    
    const utilValues = data.map(d => d.utilization);
    const mean = utilValues.reduce((a, b) => a + b, 0) / utilValues.length;
    const variance = utilValues.reduce((a, b) => a + (b - mean) ** 2, 0) / utilValues.length;
    const stdDev = Math.sqrt(variance);
    
    const anomalies: Array<{ timestamp: Date; utilization: number; score: number }> = [];
    
    for (const point of data) {
      const zScore = Math.abs((point.utilization - mean) / stdDev);
      if (zScore > threshold) {
        anomalies.push({
          timestamp: point.timestamp,
          utilization: point.utilization,
          score: zScore
        });
      }
    }
    
    return anomalies.sort((a, b) => b.score - a.score);
  }

  /**
   * Generates a unique ID
   */
  public generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Calculates correlation between resources
   */
  public calculateResourceCorrelation(
    resourceId1: string,
    resourceId2: string
  ): number {
    const data1 = this.getHistoricalData(undefined, undefined, resourceId1);
    const data2 = this.getHistoricalData(undefined, undefined, resourceId2);
    
    // Align data by timestamp
    const aligned: Array<[number, number]> = [];
    for (const d1 of data1) {
      const d2 = data2.find(d => 
        d.timestamp.getTime() === d1.timestamp.getTime()
      );
      if (d2) {
        aligned.push([d1.utilization, d2.utilization]);
      }
    }
    
    if (aligned.length < 10) {
      return 0;
    }
    
    // Calculate Pearson correlation
    const n = aligned.length;
    const sumX = aligned.reduce((s, [x, _]) => s + x, 0);
    const sumY = aligned.reduce((s, [_, y]) => s + y, 0);
    const sumXY = aligned.reduce((s, [x, y]) => s + x * y, 0);
    const sumX2 = aligned.reduce((s, [x, _]) => s + x * x, 0);
    const sumY2 = aligned.reduce((s, [_, y]) => s + y * y, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    if (denominator === 0) return 0;
    return numerator / denominator;
  }

  /**
   * Predicts resource demand for a specific time
   */
  public predictDemandAtTime(
    resourceId: string,
    timestamp: Date
  ): { demand: number; confidence: ConfidenceLevel; interval: [number, number] } {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      throw new Error(`Resource ${resourceId} not found`);
    }
    
    // Get forecast
    let forecast = this.forecasts.get(resourceId);
    if (!forecast) {
      forecast = this.generateDemandForecast(resourceId, 30);
    }
    
    // Find closest forecast point
    let closest = forecast[0];
    let minDiff = Infinity;
    
    for (const f of forecast) {
      const diff = Math.abs(f.timestamp.getTime() - timestamp.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closest = f;
      }
    }
    
    // If timestamp is outside forecast range, extrapolate
    if (minDiff > 24 * 60 * 60 * 1000) {
      // Simple extrapolation
      const trend = this.calculateHistoricalTrend(resourceId);
      const lastForecast = forecast[forecast.length - 1];
      const daysDiff = (timestamp.getTime() - lastForecast.timestamp.getTime()) / (24 * 60 * 60 * 1000);
      const extrapolated = lastForecast.predictedDemand + trend * daysDiff;
      
      return {
        demand: Math.max(0, Math.min(extrapolated, resource.capacity)),
        confidence: ConfidenceLevel.LOW,
        interval: [extrapolated * 0.8, extrapolated * 1.2]
      };
    }
    
    return {
      demand: closest.predictedDemand,
      confidence: closest.confidenceLevel,
      interval: closest.confidenceInterval
    };
  }

  /**
   * Recommends resource allocation for an event
   */
  public recommendAllocationForEvent(
    event: SpecialEvent
  ): Map<ResourceType, CampusResource[]> {
    const recommendations = new Map<ResourceType, CampusResource[]>();
    
    for (const requirement of event.resourceRequirements) {
      const availableResources = this.getAvailableResources(
        event.startDate,
        event.endDate,
        requirement.resourceType
      );
      
      // Filter by quantity and capacity
      const suitable = availableResources.filter(r => 
        r.capacity >= requirement.quantity &&
        r.isActive
      );
      
      // Sort by current utilization (prefer less utilized)
      suitable.sort((a, b) => a.currentUtilization - b.currentUtilization);
      
      // Take top recommendations
      const topRecommendations = suitable.slice(0, Math.min(3, suitable.length));
      recommendations.set(requirement.resourceType, topRecommendations);
    }
    
    return recommendations;
  }
}

// ============================================================================
// EXPORT MODULE
// ============================================================================

export default PredictiveCampusResourceEngine;
