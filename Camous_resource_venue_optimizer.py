"""
Campus Resource & Venue Utilization Optimizer
Advanced system for optimizing campus resources, venues, and facilities
Integrated with event management, ticketing, sustainability, and skill wallet systems
"""

import json
import datetime
import uuid
import math
import random
import numpy as np
from typing import List, Dict, Set, Tuple, Optional, Any
from dataclasses import dataclass, field
from collections import defaultdict, Counter
from enum import Enum
import heapq
from dataclasses import dataclass
import copy
import threading
import time
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


class UtilizationMetric(Enum):
    """Metrics for measuring utilization"""
    OCCUPANCY_RATE = "occupancy_rate"
    TURNOVER_RATE = "turnover_rate"
    EFFICIENCY_SCORE = "efficiency_score"
    COST_EFFECTIVENESS = "cost_effectiveness"
    ENERGY_EFFICIENCY = "energy_efficiency"
    USER_SATISFACTION = "user_satisfaction"
    ENVIRONMENTAL_IMPACT = "environmental_impact"


class OptimizationGoal(Enum):
    """Optimization goals"""
    MAXIMIZE_UTILIZATION = "maximize_utilization"
    MINIMIZE_CONFLICTS = "minimize_conflicts"
    MAXIMIZE_SATISFACTION = "maximize_satisfaction"
    MINIMIZE_COSTS = "minimize_costs"
    MAXIMIZE_EFFICIENCY = "maximize_efficiency"
    BALANCED = "balanced"


@dataclass
class ResourceUtilization:
    """Represents utilization data for a resource"""
    resource_id: str
    resource_name: str
    total_capacity: int
    used_capacity: int
    utilization_rate: float
    peak_hours: List[datetime.time]
    off_peak_hours: List[datetime.time]
    demand_score: float
    efficiency_score: float
    cost_per_unit: float
    revenue_generated: float
    maintenance_cost: float
    energy_consumption: float
    carbon_footprint: float
    user_ratings: List[float]
    booking_count: int
    conflict_count: int
    optimization_suggestions: List[str] = field(default_factory=list)


@dataclass
class VenueUtilization:
    """Represents utilization data for a venue"""
    venue_id: str
    venue_name: str
    venue_type: VenueType
    capacity: int
    total_hours_available: int
    booked_hours: int
    utilization_rate: float
    peak_utilization_times: List[datetime.time]
    average_booking_duration: float
    revenue_per_hour: float
    cost_per_hour: float
    profitability_score: float
    energy_usage_per_hour: float
    carbon_emissions: float
    user_satisfaction: float
    booking_cancellation_rate: float
    equipment_availability: float
    staff_required: int
    optimization_recommendations: List[str] = field(default_factory=list)
    events_hosted: int = 0


@dataclass
class ResourceOptimizationPlan:
    """Optimization plan for resources"""
    plan_id: str
    resource_id: str
    resource_type: str  # venue, equipment, staff, etc.
    current_utilization: float
    target_utilization: float
    optimization_strategies: List[str]
    expected_improvement: float
    implementation_cost: float
    expected_roi: float
    timeline_days: int
    priority: int
    status: str = "pending"
    created_at: datetime.datetime = field(default_factory=datetime.datetime.now)
    updated_at: datetime.datetime = field(default_factory=datetime.datetime.now)


@dataclass
class ResourceAllocation:
    """Resource allocation for events"""
    allocation_id: str
    resource_id: str
    event_id: str
    start_time: datetime.datetime
    end_time: datetime.datetime
    quantity_used: int
    cost: float
    status: str = "scheduled"
    actual_usage: Optional[int] = None
    utilization_efficiency: float = 0.0
    created_at: datetime.datetime = field(default_factory=datetime.datetime.now)


class ResourceOptimizer:
    """Core optimization engine for resources and venues"""
    
    def __init__(self):
        self.optimization_algorithms = {
            'utilization': self._optimize_utilization,
            'scheduling': self._optimize_scheduling,
            'cost': self._optimize_costs,
            'energy': self._optimize_energy,
            'comprehensive': self._optimize_comprehensive
        }
        
        self.prediction_model = None
        self.scaler = StandardScaler()
        self.is_trained = False
    
    def optimize_venue_schedule(self, venues: List[Venue], events: List[Event],
                              optimization_goal: OptimizationGoal) -> Dict:
        """Optimize venue schedule for events"""
        results = {
            'optimized_schedule': [],
            'utilization_improvement': 0,
            'conflict_reduction': 0,
            'recommendations': [],
            'metrics': {}
        }
        
        # Group events by date
        events_by_date = defaultdict(list)
        for event in events:
            if event.scheduled_start:
                date_key = event.scheduled_start.date()
                events_by_date[date_key].append(event)
        
        # Analyze current utilization
        current_utilization = self._calculate_venue_utilization(venues, events)
        
        # Apply optimization based on goal
        if optimization_goal == OptimizationGoal.MAXIMIZE_UTILIZATION:
            optimized = self._maximize_utilization(venues, events_by_date)
        elif optimization_goal == OptimizationGoal.MINIMIZE_CONFLICTS:
            optimized = self._minimize_conflicts(venues, events_by_date)
        elif optimization_goal == OptimizationGoal.MAXIMIZE_SATISFACTION:
            optimized = self._maximize_satisfaction(venues, events_by_date)
        elif optimization_goal == OptimizationGoal.MINIMIZE_COSTS:
            optimized = self._minimize_costs(venues, events_by_date)
        else:
            optimized = self._balanced_optimization(venues, events_by_date)
        
        results['optimized_schedule'] = optimized
        
        # Calculate improvements
        new_utilization = self._calculate_venue_utilization(venues, optimized)
        results['utilization_improvement'] = new_utilization - current_utilization
        
        # Generate recommendations
        results['recommendations'] = self._generate_venue_recommendations(venues, optimized)
        
        # Calculate metrics
        results['metrics'] = self._calculate_optimization_metrics(venues, optimized)
        
        return results
    
    def _calculate_venue_utilization(self, venues: List[Venue], events: List[Event]) -> float:
        """Calculate overall venue utilization rate"""
        if not venues or not events:
            return 0.0
        
        total_capacity = sum(v.capacity for v in venues)
        total_booked = sum(e.expected_attendees for e in events if e.status == 'scheduled')
        
        if total_capacity == 0:
            return 0.0
        
        return min(1.0, total_booked / total_capacity)
    
    def _maximize_utilization(self, venues: List[Venue], events_by_date: Dict) -> List[Event]:
        """Maximize venue utilization by filling empty slots"""
        optimized_events = []
        
        for date, events in events_by_date.items():
            # Sort events by size (largest first for efficient packing)
            sorted_events = sorted(events, key=lambda e: e.expected_attendees, reverse=True)
            
            # Track venue availability
            venue_availability = {v.venue_id: v.capacity for v in venues}
            
            for event in sorted_events:
                # Find best venue with enough capacity
                best_venue = None
                best_fit = float('inf')
                
                for venue in venues:
                    if venue.is_available(event.get_time_slot(), date):
                        if venue.capacity >= event.expected_attendees:
                            waste = venue.capacity - event.expected_attendees
                            if waste < best_fit:
                                best_fit = waste
                                best_venue = venue
                
                if best_venue:
                    event.assigned_venue = best_venue.venue_id
                    optimized_events.append(event)
                    venue_availability[best_venue.venue_id] -= event.expected_attendees
        
        return optimized_events
    
    def _minimize_conflicts(self, venues: List[Venue], events_by_date: Dict) -> List[Event]:
        """Minimize scheduling conflicts between events"""
        optimized_events = []
        
        for date, events in events_by_date.items():
            # Sort by priority
            sorted_events = sorted(events, key=lambda e: e.priority.value, reverse=True)
            
            # Track time slots
            time_slots = defaultdict(list)
            
            for event in sorted_events:
                # Check for conflicts
                has_conflict = False
                for scheduled in optimized_events:
                    if scheduled.get_time_slot() and event.get_time_slot():
                        if scheduled.get_time_slot().overlaps_with(event.get_time_slot()):
                            has_conflict = True
                            break
                
                if not has_conflict:
                    # Find suitable venue
                    for venue in venues:
                        if venue.is_available(event.get_time_slot(), date):
                            event.assigned_venue = venue.venue_id
                            optimized_events.append(event)
                            break
        
        return optimized_events
    
    def _maximize_satisfaction(self, venues: List[Venue], events_by_date: Dict) -> List[Event]:
        """Maximize user satisfaction with venue preferences"""
        optimized_events = []
        
        for date, events in events_by_date.items():
            # Consider venue preferences
            for event in events:
                # Try preferred venues first
                for venue_id in event.venue_preferences:
                    venue = next((v for v in venues if v.venue_id == venue_id), None)
                    if venue and venue.is_available(event.get_time_slot(), date):
                        event.assigned_venue = venue.venue_id
                        optimized_events.append(event)
                        break
                else:
                    # Fallback to any available venue
                    for venue in venues:
                        if venue.is_available(event.get_time_slot(), date):
                            event.assigned_venue = venue.venue_id
                            optimized_events.append(event)
                            break
        
        return optimized_events
    
    def _minimize_costs(self, venues: List[Venue], events_by_date: Dict) -> List[Event]:
        """Minimize venue costs for events"""
        optimized_events = []
        
        for date, events in events_by_date.items():
            for event in events:
                # Find cheapest available venue
                available_venues = []
                for venue in venues:
                    if venue.is_available(event.get_time_slot(), date):
                        available_venues.append(venue)
                
                if available_venues:
                    cheapest_venue = min(available_venues, key=lambda v: v.cost_per_hour)
                    event.assigned_venue = cheapest_venue.venue_id
                    optimized_events.append(event)
        
        return optimized_events
    
    def _balanced_optimization(self, venues: List[Venue], events_by_date: Dict) -> List[Event]:
        """Balanced optimization considering multiple factors"""
        optimized_events = []
        
        for date, events in events_by_date.items():
            for event in events:
                # Score each venue
                venue_scores = []
                for venue in venues:
                    if venue.is_available(event.get_time_slot(), date):
                        score = 0
                        # Capacity fit (30%)
                        capacity_score = 1 - abs(venue.capacity - event.expected_attendees) / venue.capacity
                        score += capacity_score * 0.3
                        
                        # Cost (25%)
                        cost_score = 1 - (venue.cost_per_hour / max(v.cost_per_hour for v in venues))
                        score += cost_score * 0.25
                        
                        # User preference (20%)
                        if venue.venue_id in event.venue_preferences:
                            score += 0.2
                        
                        # Utilization balance (15%)
                        utilization = self._get_venue_utilization(venue, optimized_events)
                        score += (1 - utilization) * 0.15
                        
                        # Energy efficiency (10%)
                        energy_score = 1 - (venue.energy_usage_per_hour / 100)
                        score += energy_score * 0.1
                        
                        venue_scores.append((venue, score))
                
                if venue_scores:
                    best_venue = max(venue_scores, key=lambda x: x[1])[0]
                    event.assigned_venue = best_venue.venue_id
                    optimized_events.append(event)
        
        return optimized_events
    
    def _get_venue_utilization(self, venue: Venue, events: List[Event]) -> float:
        """Calculate current utilization for a venue"""
        assigned = sum(1 for e in events if e.assigned_venue == venue.venue_id)
        return min(1.0, assigned / 10)  # Normalize
    
    def _generate_venue_recommendations(self, venues: List[Venue], 
                                       events: List[Event]) -> List[str]:
        """Generate optimization recommendations for venues"""
        recommendations = []
        
        for venue in venues:
            assigned_events = [e for e in events if e.assigned_venue == venue.venue_id]
            
            if not assigned_events:
                recommendations.append(f"{venue.name} is underutilized - consider promoting for events")
                continue
            
            utilization = len(assigned_events) / 10  # Normalize
            
            if utilization < 0.3:
                recommendations.append(f"{venue.name} has low utilization ({utilization:.1%})")
            elif utilization > 0.8:
                recommendations.append(f"{venue.name} is heavily utilized - consider expanding")
            
            # Check capacity usage
            avg_attendees = sum(e.expected_attendees for e in assigned_events) / len(assigned_events)
            if avg_attendees < venue.capacity * 0.3:
                recommendations.append(f"{venue.name} often hosts events far below capacity")
            elif avg_attendees > venue.capacity * 0.9:
                recommendations.append(f"{venue.name} frequently reaches capacity - consider larger venue")
        
        return recommendations
    
    def _calculate_optimization_metrics(self, venues: List[Venue], 
                                      events: List[Event]) -> Dict:
        """Calculate optimization metrics"""
        metrics = {
            'total_venues': len(venues),
            'total_events': len(events),
            'scheduled_events': sum(1 for e in events if e.assigned_venue),
            'utilization_rate': 0,
            'average_cost': 0,
            'energy_usage': 0,
            'carbon_footprint': 0,
            'venue_efficiency': []
        }
        
        if events:
            assigned = [e for e in events if e.assigned_venue]
            if assigned:
                # Calculate venue-specific metrics
                for venue in venues:
                    venue_events = [e for e in assigned if e.assigned_venue == venue.venue_id]
                    if venue_events:
                        metrics['venue_efficiency'].append({
                            'venue_name': venue.name,
                            'events_count': len(venue_events),
                            'avg_attendees': sum(e.expected_attendees for e in venue_events) / len(venue_events),
                            'utilization': len(venue_events) / 10,  # Normalized
                            'cost_efficiency': 1 - (venue.cost_per_hour / 100)
                        })
        
        return metrics
    
    def optimize_resources(self, resources: List[Resource], allocations: List[ResourceAllocation],
                          optimization_goal: OptimizationGoal) -> Dict:
        """Optimize resource allocation"""
        results = {
            'optimized_allocations': [],
            'utilization_improvement': 0,
            'cost_savings': 0,
            'recommendations': [],
            'metrics': {}
        }
        
        # Analyze current resource usage
        resource_usage = self._analyze_resource_usage(resources, allocations)
        
        # Apply optimization
        if optimization_goal == OptimizationGoal.MAXIMIZE_UTILIZATION:
            optimized = self._maximize_resource_utilization(resources, allocations)
        elif optimization_goal == OptimizationGoal.MINIMIZE_CONFLICTS:
            optimized = self._minimize_resource_conflicts(resources, allocations)
        else:
            optimized = self._balanced_resource_optimization(resources, allocations)
        
        results['optimized_allocations'] = optimized
        results['recommendations'] = self._generate_resource_recommendations(resources, optimized)
        results['metrics'] = self._calculate_resource_metrics(resources, optimized)
        
        return results
    
    def _analyze_resource_usage(self, resources: List[Resource], 
                               allocations: List[ResourceAllocation]) -> Dict:
        """Analyze current resource usage patterns"""
        usage_analysis = {}
        
        for resource in resources:
            resource_allocations = [a for a in allocations if a.resource_id == resource.resource_id]
            
            total_allocated = sum(a.quantity_used for a in resource_allocations)
            utilization_rate = total_allocated / (resource.quantity * len(resource_allocations)) if resource_allocations else 0
            
            usage_analysis[resource.resource_id] = {
                'resource_name': resource.name,
                'total_quantity': resource.quantity,
                'allocated_count': len(resource_allocations),
                'total_allocated': total_allocated,
                'utilization_rate': min(1.0, utilization_rate),
                'avg_allocation_size': total_allocated / len(resource_allocations) if resource_allocations else 0
            }
        
        return usage_analysis
    
    def _maximize_resource_utilization(self, resources: List[Resource], 
                                      allocations: List[ResourceAllocation]) -> List[ResourceAllocation]:
        """Maximize resource utilization"""
        optimized = []
        
        # Group allocations by time
        for resource in resources:
            resource_allocations = [a for a in allocations if a.resource_id == resource.resource_id]
            
            # Consolidate small allocations
            consolidated = self._consolidate_allocations(resource_allocations, resource)
            optimized.extend(consolidated)
        
        return optimized
    
    def _consolidate_allocations(self, allocations: List[ResourceAllocation], 
                                resource: Resource) -> List[ResourceAllocation]:
        """Consolidate small allocations to improve efficiency"""
        if not allocations:
            return []
        
        # Group by time slot
        time_groups = defaultdict(list)
        for allocation in allocations:
            key = (allocation.start_time.date(), allocation.start_time.hour)
            time_groups[key].append(allocation)
        
        consolidated = []
        for group in time_groups.values():
            if len(group) > 1:
                # Combine small allocations
                total_quantity = sum(a.quantity_used for a in group)
                if total_quantity <= resource.quantity:
                    # Create consolidated allocation
                    consolidated_allocation = copy.deepcopy(group[0])
                    consolidated_allocation.quantity_used = total_quantity
                    consolidated_allocation.utilization_efficiency = total_quantity / resource.quantity
                    consolidated.append(consolidated_allocation)
                else:
                    consolidated.extend(group)
            else:
                consolidated.extend(group)
        
        return consolidated
    
    def _minimize_resource_conflicts(self, resources: List[Resource], 
                                   allocations: List[ResourceAllocation]) -> List[ResourceAllocation]:
        """Minimize resource conflicts"""
        optimized = []
        
        for resource in resources:
            resource_allocations = [a for a in allocations if a.resource_id == resource.resource_id]
            
            # Sort by time
            sorted_allocations = sorted(resource_allocations, key=lambda a: a.start_time)
            
            # Check for overlaps
            for i, allocation in enumerate(sorted_allocations):
                has_overlap = False
                for j in range(i + 1, len(sorted_allocations)):
                    if sorted_allocations[j].start_time < allocation.end_time:
                        has_overlap = True
                        break
                
                if not has_overlap:
                    optimized.append(allocation)
        
        return optimized
    
    def _balanced_resource_optimization(self, resources: List[Resource], 
                                      allocations: List[ResourceAllocation]) -> List[ResourceAllocation]:
        """Balanced resource optimization"""
        optimized = []
        
        for resource in resources:
            resource_allocations = [a for a in allocations if a.resource_id == resource.resource_id]
            
            # Score each allocation
            scored_allocations = []
            for allocation in resource_allocations:
                score = 0
                # Efficiency (40%)
                efficiency = allocation.quantity_used / resource.quantity
                score += efficiency * 0.4
                
                # Urgency (30%)
                hours_until = (allocation.start_time - datetime.datetime.now()).total_seconds() / 3600
                urgency = max(0, 1 - hours_until / 48)  # 48 hours window
                score += urgency * 0.3
                
                # Size (30%)
                size_score = allocation.quantity_used / resource.quantity
                score += size_score * 0.3
                
                scored_allocations.append((allocation, score))
            
            # Sort by score and take top
            scored_allocations.sort(key=lambda x: x[1], reverse=True)
            optimized.extend([a[0] for a in scored_allocations])
        
        return optimized
    
    def _generate_resource_recommendations(self, resources: List[Resource], 
                                         allocations: List[ResourceAllocation]) -> List[str]:
        """Generate resource optimization recommendations"""
        recommendations = []
        
        for resource in resources:
            resource_allocations = [a for a in allocations if a.resource_id == resource.resource_id]
            
            if not resource_allocations:
                recommendations.append(f"{resource.name} is not being used")
                continue
            
            avg_usage = sum(a.quantity_used for a in resource_allocations) / len(resource_allocations)
            
            if avg_usage < resource.quantity * 0.3:
                recommendations.append(f"{resource.name} is underutilized ({avg_usage}/{resource.quantity})")
            elif avg_usage > resource.quantity * 0.9:
                recommendations.append(f"{resource.name} is nearly at capacity - consider acquiring more")
            
            # Check efficiency
            efficient = sum(1 for a in resource_allocations if a.utilization_efficiency > 0.8)
            if efficient / len(resource_allocations) < 0.5:
                recommendations.append(f"{resource.name} has low utilization efficiency")
        
        return recommendations
    
    def _calculate_resource_metrics(self, resources: List[Resource], 
                                  allocations: List[ResourceAllocation]) -> Dict:
        """Calculate resource metrics"""
        metrics = {
            'total_resources': len(resources),
            'total_allocations': len(allocations),
            'avg_utilization': 0,
            'efficiency_score': 0,
            'resource_metrics': []
        }
        
        if allocations:
            total_usage = sum(a.quantity_used for a in allocations)
            total_capacity = sum(r.quantity for r in resources)
            metrics['avg_utilization'] = total_usage / total_capacity if total_capacity > 0 else 0
            
            # Calculate efficiency
            efficient_allocations = sum(1 for a in allocations if a.utilization_efficiency > 0.7)
            metrics['efficiency_score'] = efficient_allocations / len(allocations)
            
            # Resource-specific metrics
            for resource in resources:
                resource_allocations = [a for a in allocations if a.resource_id == resource.resource_id]
                if resource_allocations:
                    metrics['resource_metrics'].append({
                        'resource_name': resource.name,
                        'allocations': len(resource_allocations),
                        'avg_usage': sum(a.quantity_used for a in resource_allocations) / len(resource_allocations),
                        'avg_efficiency': sum(a.utilization_efficiency for a in resource_allocations) / len(resource_allocations)
                    })
        
        return metrics
    
    def predict_demand(self, historical_data: List[Dict], future_date: datetime.date) -> Dict:
        """Predict demand for resources on a future date"""
        if len(historical_data) < 10:
            return {'confidence': 0, 'predictions': {}}
        
        # Simple prediction based on historical patterns
        predictions = {}
        
        # Group by day of week
        day_patterns = defaultdict(list)
        for record in historical_data:
            date = datetime.date.fromisoformat(record['date'])
            day_of_week = date.weekday()
            day_patterns[day_of_week].append(record['demand'])
        
        # Calculate average demand for each day
        for day, demands in day_patterns.items():
            predictions[day] = sum(demands) / len(demands)
        
        # Get prediction for target date
        target_day = future_date.weekday()
        
        return {
            'confidence': min(1.0, len(historical_data) / 50),
            'predicted_demand': predictions.get(target_day, 0),
            'day_patterns': {day: avg for day, avg in predictions.items()},
            'recommendations': self._generate_demand_recommendations(predictions, target_day)
        }
    
    def _generate_demand_recommendations(self, day_patterns: Dict, target_day: int) -> List[str]:
        """Generate recommendations based on demand predictions"""
        recommendations = []
        
        avg_demand = sum(day_patterns.values()) / len(day_patterns) if day_patterns else 0
        target_demand = day_patterns.get(target_day, avg_demand)
        
        if target_demand > avg_demand * 1.5:
            recommendations.append("High demand expected - consider opening additional resources")
        elif target_demand < avg_demand * 0.5:
            recommendations.append("Low demand expected - consider reducing resource allocation")
        
        # Peak day recommendations
        if day_patterns:
            peak_day = max(day_patterns, key=day_patterns.get)
            if peak_day == target_day:
                recommendations.append(f"Peak demand day - optimize resource allocation")
        
        return recommendations


class VenueUtilizationAnalyzer:
    """Analyzes venue utilization patterns and provides insights"""
    
    def __init__(self):
        self.analysis_cache = {}
    
    def analyze_venue_utilization(self, venues: List[Venue], events: List[Event]) -> Dict:
        """Analyze venue utilization patterns"""
        analysis = {
            'overall_utilization': 0,
            'venue_utilization': [],
            'peak_hours': [],
            'utilization_trends': [],
            'recommendations': [],
            'efficiency_score': 0
        }
        
        total_capacity = sum(v.capacity for v in venues)
        total_booked = sum(e.expected_attendees for e in events if e.status == 'scheduled')
        
        if total_capacity > 0:
            analysis['overall_utilization'] = total_booked / total_capacity
        
        # Analyze each venue
        for venue in venues:
            venue_events = [e for e in events if e.assigned_venue == venue.venue_id]
            
            utilization = {
                'venue_name': venue.name,
                'capacity': venue.capacity,
                'events_hosted': len(venue_events),
                'total_attendees': sum(e.expected_attendees for e in venue_events),
                'utilization_rate': 0,
                'efficiency': 0
            }
            
            if venue.capacity > 0 and venue_events:
                utilization['utilization_rate'] = sum(e.expected_attendees for e in venue_events) / (venue.capacity * len(venue_events))
                utilization['efficiency'] = 1 - abs(1 - utilization['utilization_rate'])
            
            analysis['venue_utilization'].append(utilization)
            
            # Generate recommendations
            if utilization['utilization_rate'] < 0.3:
                analysis['recommendations'].append(f"{venue.name} has low utilization - consider reducing capacity or promoting")
            elif utilization['utilization_rate'] > 0.9:
                analysis['recommendations'].append(f"{venue.name} is nearly full - consider expansion")
            
            # Check peak hours
            if venue_events:
                peak_hours = self._find_peak_hours(venue_events)
                analysis['peak_hours'].extend(peak_hours)
        
        # Calculate efficiency score
        if analysis['venue_utilization']:
            avg_efficiency = sum(v['efficiency'] for v in analysis['venue_utilization']) / len(analysis['venue_utilization'])
            analysis['efficiency_score'] = avg_efficiency
        
        return analysis
    
    def _find_peak_hours(self, events: List[Event]) -> List[datetime.time]:
        """Find peak hours from events"""
        hour_counts = defaultdict(int)
        
        for event in events:
            if event.scheduled_start:
                hour = event.scheduled_start.hour
                hour_counts[hour] += 1
        
        # Get top 3 peak hours
        top_hours = sorted(hour_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        return [datetime.time(hour, 0) for hour, _ in top_hours]
    
    def generate_utilization_report(self, venues: List[Venue], events: List[Event]) -> Dict:
        """Generate comprehensive utilization report"""
        analysis = self.analyze_venue_utilization(venues, events)
        
        report = {
            'report_date': datetime.datetime.now().isoformat(),
            'venue_utilization': analysis,
            'optimization_opportunities': self._identify_opportunities(analysis),
            'cost_analysis': self._analyze_costs(venues, events),
            'recommendations': analysis['recommendations']
        }
        
        return report
    
    def _identify_opportunities(self, analysis: Dict) -> List[Dict]:
        """Identify optimization opportunities"""
        opportunities = []
        
        for venue in analysis['venue_utilization']:
            if venue['utilization_rate'] < 0.4:
                opportunities.append({
                    'venue': venue['venue_name'],
                    'type': 'underutilization',
                    'potential_improvement': 1 - venue['utilization_rate'],
                    'action': 'Promote venue for events and increase bookings'
                })
            elif venue['utilization_rate'] > 0.85:
                opportunities.append({
                    'venue': venue['venue_name'],
                    'type': 'overutilization',
                    'potential_improvement': 0,
                    'action': 'Consider expanding capacity or adding alternative venues'
                })
        
        return opportunities
    
    def _analyze_costs(self, venues: List[Venue], events: List[Event]) -> Dict:
        """Analyze venue costs and revenue"""
        total_cost = sum(v.cost_per_hour for v in venues)
        total_revenue = 0
        
        for event in events:
            venue = next((v for v in venues if v.venue_id == event.assigned_venue), None)
            if venue and event.scheduled_start and event.scheduled_end:
                hours = (event.scheduled_end - event.scheduled_start).total_seconds() / 3600
                total_revenue += venue.cost_per_hour * hours * 1.2  # 20% markup
        
        return {
            'total_venue_cost': total_cost,
            'estimated_revenue': total_revenue,
            'profitability': total_revenue - total_cost if total_cost > 0 else 0,
            'cost_per_attendee': total_cost / len(events) if events else 0
        }


class CampusResourceOptimizer:
    """Main campus resource and venue optimization system"""
    
    def __init__(self, event_manager=None, ticket_manager=None,
                 sustainability_system=None, skill_wallet_manager=None):
        self.event_manager = event_manager
        self.ticket_manager = ticket_manager
        self.sustainability_system = sustainability_system
        self.skill_wallet_manager = skill_wallet_manager
        
        # Core components
        self.resource_optimizer = ResourceOptimizer()
        self.venue_analyzer = VenueUtilizationAnalyzer()
        
        # Storage
        self.resource_utilization: Dict[str, ResourceUtilization] = {}
        self.venue_utilization: Dict[str, VenueUtilization] = {}
        self.optimization_plans: Dict[str, ResourceOptimizationPlan] = {}
        self.resource_allocations: List[ResourceAllocation] = []
        self.historical_data: List[Dict] = []
        
        # Statistics
        self.total_optimizations = 0
        self.improvement_score = 0
        self.last_optimization = None
        
        # Background analysis thread
        self.analysis_thread = None
        self.is_running = True
        
        # Initialize skills
        self._initialize_optimization_skills()
        
        # Load historical data if available
        self._load_historical_data()
    
    def _initialize_optimization_skills(self):
        """Initialize skills related to resource optimization"""
        if self.skill_wallet_manager:
            optimization_skills = [
                {
                    'id': 'skill_opt_001',
                    'name': 'Resource Optimization',
                    'description': 'Optimizing campus resources and venues',
                    'category': SkillCategory.TECHNICAL,
                    'level': SkillLevel.BEGINNER
                },
                {
                    'id': 'skill_opt_002',
                    'name': 'Capacity Planning',
                    'description': 'Planning and managing venue capacity',
                    'category': SkillCategory.ANALYTICAL,
                    'level': SkillLevel.BEGINNER
                },
                {
                    'id': 'skill_opt_003',
                    'name': 'Resource Analytics',
                    'description': 'Analyzing resource utilization patterns',
                    'category': SkillCategory.ANALYTICAL,
                    'level': SkillLevel.BEGINNER
                },
                {
                    'id': 'skill_opt_004',
                    'name': 'Sustainable Resource Management',
                    'description': 'Managing resources sustainably',
                    'category': SkillCategory.SUSTAINABILITY,
                    'level': SkillLevel.BEGINNER
                }
            ]
            
            for skill_data in optimization_skills:
                skill = Skill(
                    skill_id=skill_data['id'],
                    name=skill_data['name'],
                    description=skill_data['description'],
                    category=skill_data['category'],
                    level=skill_data['level']
                )
                self.skill_wallet_manager.skill_definitions[skill.skill_id] = skill
    
    def _load_historical_data(self):
        """Load historical utilization data"""
        # In production, this would load from a database
        pass
    
    def optimize_venue_schedule(self, venues: List[Venue], events: List[Event],
                               optimization_goal: OptimizationGoal = OptimizationGoal.BALANCED) -> Dict:
        """Optimize venue schedule using the resource optimizer"""
        result = self.resource_optimizer.optimize_venue_schedule(
            venues, events, optimization_goal
        )
        
        self.total_optimizations += 1
        self.last_optimization = datetime.datetime.now()
        
        # Calculate improvement score
        if 'metrics' in result:
            metrics = result['metrics']
            if 'utilization_rate' in metrics:
                self.improvement_score = metrics['utilization_rate']
        
        # Update sustainability system
        if self.sustainability_system:
            self._update_sustainability_for_optimization(result)
        
        # Update skill wallet
        if self.skill_wallet_manager:
            self._update_skill_wallet_for_optimization('user_001', result)
        
        return result
    
    def _update_sustainability_for_optimization(self, result: Dict):
        """Update sustainability system for optimization"""
        if not self.sustainability_system:
            return
        
        # Award points for optimization
        improvement = result.get('utilization_improvement', 0)
        points = int(improvement * 50)  # 50 points per 100% improvement
        
        if points > 0:
            # Award to all users involved in optimization (simplified)
            print(f"  🌱 Optimization improved utilization by {improvement:.1%}!")
            print(f"  🌱 Awarded {points} sustainability points")
    
    def _update_skill_wallet_for_optimization(self, user_id: str, result: Dict):
        """Update skill wallet for optimization"""
        if not self.skill_wallet_manager:
            return
        
        wallet = self.skill_wallet_manager.get_skill_wallet(user_id)
        if not wallet:
            return
        
        # Award Resource Optimization skill
        if result.get('utilization_improvement', 0) > 0.1:
            skill_id = 'skill_opt_001'
            if skill_id in wallet.skills:
                skill = wallet.skills[skill_id]
                skill.add_experience(10)
                if skill.experience_points > 100:
                    skill.level = SkillLevel.INTERMEDIATE
                    print(f"  📈 Upgraded Resource Optimization skill to INTERMEDIATE!")
            else:
                self.skill_wallet_manager.award_skill(user_id, skill_id, SkillLevel.BEGINNER)
                print(f"  🎯 Awarded Resource Optimization skill!")
    
    def analyze_venue_utilization(self, venues: List[Venue], events: List[Event]) -> Dict:
        """Analyze venue utilization patterns"""
        analysis = self.venue_analyzer.analyze_venue_utilization(venues, events)
        
        # Store analysis results
        for venue_data in analysis['venue_utilization']:
            venue_id = next((v.venue_id for v in venues if v.name == venue_data['venue_name']), None)
            if venue_id:
                self.venue_utilization[venue_id] = VenueUtilization(
                    venue_id=venue_id,
                    venue_name=venue_data['venue_name'],
                    venue_type=VenueType.OTHER,  # Would need to look up
                    capacity=venue_data['capacity'],
                    total_hours_available=0,  # Would calculate
                    booked_hours=0,
                    utilization_rate=venue_data['utilization_rate'],
                    peak_utilization_times=[],
                    average_booking_duration=0,
                    revenue_per_hour=0,
                    cost_per_hour=0,
                    profitability_score=venue_data['efficiency'],
                    energy_usage_per_hour=0,
                    carbon_emissions=0,
                    user_satisfaction=venue_data['efficiency'],
                    booking_cancellation_rate=0,
                    equipment_availability=1.0,
                    staff_required=0,
                    optimization_recommendations=analysis['recommendations'],
                    events_hosted=venue_data['events_hosted']
                )
        
        return analysis
    
    def predict_demand(self, resource_ids: List[str], date: datetime.date) -> Dict:
        """Predict demand for resources on a given date"""
        predictions = {}
        
        for resource_id in resource_ids:
            # Get historical data for this resource
            resource_history = [d for d in self.historical_data if d.get('resource_id') == resource_id]
            
            if resource_history:
                prediction = self.resource_optimizer.predict_demand(resource_history, date)
                predictions[resource_id] = prediction
        
        return predictions
    
    def generate_optimization_plan(self, venue_id: str, target_utilization: float) -> ResourceOptimizationPlan:
        """Generate an optimization plan for a venue"""
        venue = self.venue_utilization.get(venue_id)
        if not venue:
            raise ValueError(f"Venue {venue_id} not found")
        
        current_utilization = venue.utilization_rate
        improvement_needed = max(0, target_utilization - current_utilization)
        
        strategies = []
        if current_utilization < 0.4:
            strategies.append("Increase marketing and promotion for venue")
            strategies.append("Offer discounts for off-peak bookings")
            strategies.append("Partner with student organizations for events")
        elif current_utilization > 0.8:
            strategies.append("Implement tiered pricing for peak hours")
            strategies.append("Expand capacity or add flexible seating")
            strategies.append("Streamline booking process")
        
        plan = ResourceOptimizationPlan(
            plan_id=str(uuid.uuid4()),
            resource_id=venue_id,
            resource_type="venue",
            current_utilization=current_utilization,
            target_utilization=target_utilization,
            optimization_strategies=strategies,
            expected_improvement=improvement_needed,
            implementation_cost=improvement_needed * 100,  # Simplified
            expected_roi=improvement_needed * 200,  # Simplified
            timeline_days=30,
            priority=1 if improvement_needed > 0.2 else 2
        )
        
        self.optimization_plans[plan.plan_id] = plan
        
        return plan
    
    def get_resource_metrics(self) -> Dict:
        """Get comprehensive resource metrics"""
        metrics = {
            'total_venues': len(self.venue_utilization),
            'total_resources': len(self.resource_utilization),
            'avg_venue_utilization': 0,
            'avg_resource_utilization': 0,
            'optimization_savings': 0,
            'efficiency_score': 0,
            'venue_metrics': [],
            'resource_metrics': []
        }
        
        # Venue metrics
        if self.venue_utilization:
            avg_util = sum(v.utilization_rate for v in self.venue_utilization.values()) / len(self.venue_utilization)
            metrics['avg_venue_utilization'] = avg_util
            
            for venue in self.venue_utilization.values():
                metrics['venue_metrics'].append({
                    'name': venue.venue_name,
                    'utilization': venue.utilization_rate,
                    'profitability': venue.profitability_score,
                    'events': venue.events_hosted
                })
        
        # Resource metrics
        if self.resource_utilization:
            avg_util = sum(r.utilization_rate for r in self.resource_utilization.values()) / len(self.resource_utilization)
            metrics['avg_resource_utilization'] = avg_util
            
            for resource in self.resource_utilization.values():
                metrics['resource_metrics'].append({
                    'name': resource.resource_name,
                    'utilization': resource.utilization_rate,
                    'efficiency': resource.efficiency_score,
                    'demand': resource.demand_score
                })
        
        # Calculate efficiency score
        if metrics['avg_venue_utilization'] > 0:
            metrics['efficiency_score'] = metrics['avg_venue_utilization'] * 100
        
        return metrics
    
    def run_optimization_cycle(self) -> Dict:
        """Run a complete optimization cycle"""
        cycle_results = {
            'start_time': datetime.datetime.now().isoformat(),
            'optimizations_performed': [],
            'improvements': [],
            'metrics': {}
        }
        
        # Run venue optimization
        venues = list(self.event_manager.venues.values()) if self.event_manager else []
        events = list(self.event_manager.events.values()) if self.event_manager else []
        
        if venues and events:
            # Try different optimization goals
            for goal in [OptimizationGoal.MAXIMIZE_UTILIZATION, 
                        OptimizationGoal.MINIMIZE_CONFLICTS,
                        OptimizationGoal.BALANCED]:
                result = self.optimize_venue_schedule(venues, events, goal)
                
                cycle_results['optimizations_performed'].append({
                    'goal': goal.value,
                    'improvement': result.get('utilization_improvement', 0)
                })
                
                if result.get('utilization_improvement', 0) > 0.05:
                    cycle_results['improvements'].append({
                        'goal': goal.value,
                        'improvement': result['utilization_improvement'],
                        'recommendations': result.get('recommendations', [])
                    })
            
            # Analyze and store metrics
            analysis = self.analyze_venue_utilization(venues, events)
            cycle_results['metrics'] = analysis
        
        cycle_results['end_time'] = datetime.datetime.now().isoformat()
        
        return cycle_results


def demo_resource_optimizer():
    """Demonstrate the campus resource and venue optimization system"""
    print("🏛️ CAMPUS RESOURCE & VENUE UTILIZATION OPTIMIZER 🏛️")
    print("=" * 80)
    
    # Initialize systems
    from sustainability_gamification import SustainabilityGamification
    from skill_wallet_project_management import SkillWalletProjectManager
    
    sustainability = SustainabilityGamification()
    skill_manager = SkillWalletProjectManager(sustainability)
    
    # Register users
    print("\n📝 Registering users...")
    sustainability.register_user("user_001", "CampusAdmin")
    sustainability.register_user("user_002", "EventPlanner")
    print("✅ Users registered")
    
    # Initialize event manager with sample data
    from campus_event_manager import CampusEventManager
    event_manager = CampusEventManager(sustainability, skill_manager)
    
    # Initialize optimizer
    optimizer = CampusResourceOptimizer(
        event_manager=event_manager,
        sustainability_system=sustainability,
        skill_wallet_manager=skill_manager
    )
    
    # Get venues and events
    venues = list(event_manager.venues.values())
    events = list(event_manager.events.values())
    
    print(f"\n📊 Current State:")
    print(f"  Total Venues: {len(venues)}")
    print(f"  Total Events: {len(events)}")
    print(f"  Scheduled Events: {sum(1 for e in events if e.status == 'scheduled')}")
    
    # Analyze current utilization
    print("\n📈 Analyzing Current Utilization...")
    analysis = optimizer.analyze_venue_utilization(venues, events)
    
    print(f"\n  Overall Utilization: {analysis['overall_utilization']:.1%}")
    print(f"  Efficiency Score: {analysis['efficiency_score']:.1%}")
    
    print("\n  Venue Utilization:")
    for venue_data in analysis['venue_utilization'][:3]:
        print(f"    • {venue_data['venue_name']}: {venue_data['utilization_rate']:.1%} "
              f"(Hosted {venue_data['events_hosted']} events)")
    
    if analysis['recommendations']:
        print("\n  Recommendations:")
        for rec in analysis['recommendations'][:3]:
            print(f"    • {rec}")
    
    # Run optimization cycle
    print("\n⚡ Running Optimization Cycle...")
    cycle_results = optimizer.run_optimization_cycle()
    
    print(f"\n  Optimizations Performed: {len(cycle_results['optimizations_performed'])}")
    print(f"  Improvements Found: {len(cycle_results['improvements'])}")
    
    for improvement in cycle_results['improvements']:
        print(f"\n  ✓ {improvement['goal'].replace('_', ' ').title()}:")
        print(f"    Improvement: {improvement['improvement']:.1%}")
        if improvement['recommendations']:
            print(f"    Recommendations:")
            for rec in improvement['recommendations'][:2]:
                print(f"      • {rec}")
    
    # Generate optimization plan
    print("\n📋 Generating Optimization Plan...")
    venue_id = venues[0].venue_id if venues else None
    if venue_id:
        plan = optimizer.generate_optimization_plan(venue_id, 0.85)
        
        print(f"\n  Plan ID: {plan.plan_id}")
        print(f"  Current Utilization: {plan.current_utilization:.1%}")
        print(f"  Target Utilization: {plan.target_utilization:.1%}")
        print(f"  Expected Improvement: {plan.expected_improvement:.1%}")
        print(f"  Timeline: {plan.timeline_days} days")
        print(f"\n  Strategies:")
        for strategy in plan.optimization_strategies:
            print(f"    • {strategy}")
    
    # Predict demand
    print("\n🔮 Predicting Demand...")
    if venues:
        resource_ids = [v.venue_id for v in venues[:2]]
        future_date = datetime.date.today() + datetime.timedelta(days=7)
        predictions = optimizer.predict_demand(resource_ids, future_date)
        
        for resource_id, prediction in predictions.items():
            print(f"\n  Resource {resource_id}:")
            print(f"    Predicted Demand: {prediction.get('predicted_demand', 0):.1%}")
            print(f"    Confidence: {prediction.get('confidence', 0):.1%}")
            if prediction.get('recommendations'):
                print(f"    Recommendations:")
                for rec in prediction['recommendations']:
                    print(f"      • {rec}")
    
    # Get resource metrics
    print("\n📊 Resource Metrics:")
    metrics = optimizer.get_resource_metrics()
    
    print(f"  Average Venue Utilization: {metrics['avg_venue_utilization']:.1%}")
    print(f"  Average Resource Utilization: {metrics['avg_resource_utilization']:.1%}")
    print(f"  Efficiency Score: {metrics['efficiency_score']:.1f}%")
    
    if metrics['venue_metrics']:
        print("\n  Venue Metrics:")
        for venue in metrics['venue_metrics'][:3]:
            print(f"    • {venue['name']}: {venue['utilization']:.1%} utilization, "
                  f"{venue['profitability']:.2f} profitability")
    
    # Check sustainability integration
    print("\n🌱 Sustainability Integration:")
    user = sustainability.get_user('user_001')
    if user:
        print(f"  User: {user.username}")
        print(f"  Sustainability Points: {user.total_points}")
        print(f"  Level: {user.level}")
    
    # Check skill wallet integration
    print("\n🎯 Skill Wallet Integration:")
    wallet = skill_manager.get_skill_wallet('user_001')
    if wallet:
        print(f"  Skill Points: {wallet.total_skill_points}")
        print(f"  Skills: {len(wallet.skills)}")
        for skill in wallet.skills.values():
            if skill.skill_id.startswith('skill_opt_'):
                print(f"    • {skill.name}: {skill.level.value.title()}")
    
    print("\n✨ Demonstration complete! ✨")


if __name__ == "__main__":
    demo_resource_optimizer()
