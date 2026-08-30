"""
Campus Event Conflict Detection & Smart Scheduling System
Comprehensive system for managing campus events, detecting conflicts, and optimizing schedules
Integrated with sustainability, skill wallet, plagiarism, AI detection, and citation systems
"""

import json
import datetime
import uuid
import math
import random
from typing import List, Dict, Set, Tuple, Optional, Any
from dataclasses import dataclass, field
from collections import defaultdict, Counter
from enum import Enum
import heapq
from dataclasses import dataclass
import copy


class EventType(Enum):
    """Types of campus events"""
    ACADEMIC = "academic"
    SOCIAL = "social"
    SPORTS = "sports"
    CULTURAL = "cultural"
    WORKSHOP = "workshop"
    SEMINAR = "seminar"
    CONFERENCE = "conference"
    CAREER = "career"
    HEALTH = "health"
    SUSTAINABILITY = "sustainability"
    CLUB = "club"
    OTHER = "other"


class EventPriority(Enum):
    """Priority levels for events"""
    CRITICAL = 5
    HIGH = 4
    MEDIUM = 3
    LOW = 2
    OPTIONAL = 1


class VenueType(Enum):
    """Types of venues"""
    CLASSROOM = "classroom"
    AUDITORIUM = "auditorium"
    LABORATORY = "laboratory"
    LIBRARY = "library"
    OUTDOOR = "outdoor"
    GYM = "gym"
    STUDIO = "studio"
    CONFERENCE_ROOM = "conference_room"
    COMMON_AREA = "common_area"
    OTHER = "other"


class ConflictType(Enum):
    """Types of conflicts"""
    TIME_CONFLICT = "time_conflict"
    VENUE_CONFLICT = "venue_conflict"
    RESOURCE_CONFLICT = "resource_conflict"
    ATTENDEE_CONFLICT = "attendee_conflict"
    ORGANIZER_CONFLICT = "organizer_conflict"
    EQUIPMENT_CONFLICT = "equipment_conflict"
    BUDGET_CONFLICT = "budget_conflict"


@dataclass
class TimeSlot:
    """Represents a time slot"""
    start_time: datetime.datetime
    end_time: datetime.datetime
    duration_minutes: int = 0
    
    def __post_init__(self):
        if self.duration_minutes == 0:
            self.duration_minutes = int((self.end_time - self.start_time).total_seconds() / 60)
    
    def overlaps_with(self, other: 'TimeSlot') -> bool:
        """Check if this time slot overlaps with another"""
        return (self.start_time < other.end_time and other.start_time < self.end_time)
    
    def contains(self, time: datetime.datetime) -> bool:
        """Check if a time is within this slot"""
        return self.start_time <= time <= self.end_time
    
    def duration_intersection(self, other: 'TimeSlot') -> int:
        """Calculate duration of overlap in minutes"""
        if not self.overlaps_with(other):
            return 0
        overlap_start = max(self.start_time, other.start_time)
        overlap_end = min(self.end_time, other.end_time)
        return int((overlap_end - overlap_start).total_seconds() / 60)


@dataclass
class Venue:
    """Represents a venue on campus"""
    venue_id: str
    name: str
    venue_type: VenueType
    capacity: int
    location: str
    facilities: List[str] = field(default_factory=list)
    equipment: List[str] = field(default_factory=list)
    availability: Dict[str, List[TimeSlot]] = field(default_factory=dict)
    cost_per_hour: float = 0.0
    requires_booking: bool = True
    accessibility_features: List[str] = field(default_factory=list)
    rating: float = 0.0
    reviews: List[Dict] = field(default_factory=list)
    is_active: bool = True
    
    def is_available(self, time_slot: TimeSlot, date: datetime.date) -> bool:
        """Check if venue is available for a given time slot"""
        date_key = date.isoformat()
        if date_key not in self.availability:
            return True
        
        for booked_slot in self.availability[date_key]:
            if booked_slot.overlaps_with(time_slot):
                return False
        return True
    
    def book(self, time_slot: TimeSlot, date: datetime.date) -> bool:
        """Book the venue for a given time slot"""
        if not self.is_available(time_slot, date):
            return False
        
        date_key = date.isoformat()
        if date_key not in self.availability:
            self.availability[date_key] = []
        
        self.availability[date_key].append(time_slot)
        return True


@dataclass
class Resource:
    """Represents a resource needed for events"""
    resource_id: str
    name: str
    resource_type: str
    quantity: int
    available_quantity: int
    booking_required: bool = True
    cost_per_unit: float = 0.0
    restrictions: List[str] = field(default_factory=list)
    bookings: Dict[str, List[TimeSlot]] = field(default_factory=dict)
    
    def is_available(self, time_slot: TimeSlot, date: datetime.date, quantity: int = 1) -> bool:
        """Check if resource is available"""
        if quantity > self.available_quantity:
            return False
        
        date_key = date.isoformat()
        if date_key not in self.bookings:
            return True
        
        # Check if already booked for this time
        for booked_slot in self.bookings[date_key]:
            if booked_slot.overlaps_with(time_slot):
                return False
        return True
    
    def book(self, time_slot: TimeSlot, date: datetime.date, quantity: int = 1) -> bool:
        """Book the resource"""
        if not self.is_available(time_slot, date, quantity):
            return False
        
        date_key = date.isoformat()
        if date_key not in self.bookings:
            self.bookings[date_key] = []
        
        self.bookings[date_key].append(time_slot)
        self.available_quantity -= quantity
        return True


@dataclass
class Attendee:
    """Represents an event attendee"""
    attendee_id: str
    name: str
    email: str
    department: str
    role: str  # Student, Faculty, Staff, External
    interests: List[str] = field(default_factory=list)
    availability: Dict[str, List[TimeSlot]] = field(default_factory=dict)
    registered_events: List[str] = field(default_factory=list)
    preferences: Dict[str, Any] = field(default_factory=dict)
    is_active: bool = True


@dataclass
class Event:
    """Represents a campus event"""
    event_id: str
    name: str
    description: str
    event_type: EventType
    priority: EventPriority
    organizer_id: str
    organizer_name: str
    department: str
    expected_attendees: int
    venue_preferences: List[str] = field(default_factory=list)
    resources_needed: List[Dict] = field(default_factory=list)
    speaker: str = ""
    budget: float = 0.0
    status: str = "pending"  # pending, approved, scheduled, cancelled, completed
    recurring: bool = False
    recurrence_pattern: Optional[Dict] = None
    tags: List[str] = field(default_factory=list)
    created_at: datetime.datetime = field(default_factory=datetime.datetime.now)
    updated_at: datetime.datetime = field(default_factory=datetime.datetime.now)
    
    # Scheduling fields
    scheduled_start: Optional[datetime.datetime] = None
    scheduled_end: Optional[datetime.datetime] = None
    assigned_venue: Optional[str] = None
    assigned_resources: List[str] = field(default_factory=list)
    
    # Tracking
    conflicts: List[Dict] = field(default_factory=list)
    alternatives: List[Dict] = field(default_factory=list)
    is_confirmed: bool = False
    confirmation_date: Optional[datetime.datetime] = None
    
    def get_time_slot(self) -> Optional[TimeSlot]:
        """Get the time slot of the event"""
        if self.scheduled_start and self.scheduled_end:
            return TimeSlot(self.scheduled_start, self.scheduled_end)
        return None
    
    def has_conflict_with(self, other: 'Event') -> List[ConflictType]:
        """Check for conflicts with another event"""
        conflicts = []
        
        # Time conflict
        if self.scheduled_start and self.scheduled_end and other.scheduled_start and other.scheduled_end:
            slot1 = TimeSlot(self.scheduled_start, self.scheduled_end)
            slot2 = TimeSlot(other.scheduled_start, other.scheduled_end)
            if slot1.overlaps_with(slot2):
                conflicts.append(ConflictType.TIME_CONFLICT)
        
        # Venue conflict
        if self.assigned_venue and other.assigned_venue and self.assigned_venue == other.assigned_venue:
            if self.scheduled_start and other.scheduled_start:
                slot1 = TimeSlot(self.scheduled_start, self.scheduled_end)
                slot2 = TimeSlot(other.scheduled_start, other.scheduled_end)
                if slot1.overlaps_with(slot2):
                    conflicts.append(ConflictType.VENUE_CONFLICT)
        
        # Organizer conflict
        if self.organizer_id == other.organizer_id:
            if self.scheduled_start and other.scheduled_start:
                slot1 = TimeSlot(self.scheduled_start, self.scheduled_end)
                slot2 = TimeSlot(other.scheduled_start, other.scheduled_end)
                if slot1.overlaps_with(slot2):
                    conflicts.append(ConflictType.ORGANIZER_CONFLICT)
        
        # Resource conflict
        resource_ids_self = {r['resource_id'] for r in self.resources_needed}
        resource_ids_other = {r['resource_id'] for r in other.resources_needed}
        if resource_ids_self.intersection(resource_ids_other):
            conflicts.append(ConflictType.RESOURCE_CONFLICT)
        
        return conflicts


@dataclass
class EventSchedule:
    """Represents a complete event schedule"""
    schedule_id: str
    events: List[Event] = field(default_factory=list)
    date: datetime.date = field(default_factory=datetime.date.today)
    total_events: int = 0
    total_attendees: int = 0
    utilization_rate: float = 0.0
    conflicts_detected: int = 0
    resolved_conflicts: int = 0
    optimization_score: float = 0.0
    created_at: datetime.datetime = field(default_factory=datetime.datetime.now)
    updated_at: datetime.datetime = field(default_factory=datetime.datetime.now)


class ConflictDetector:
    """Detects and resolves conflicts in event schedules"""
    
    def __init__(self):
        self.conflict_thresholds = {
            'time_overlap_minutes': 15,
            'venue_capacity_ratio': 1.2,
            'resource_conflict_ratio': 1.0
        }
    
    def detect_all_conflicts(self, events: List[Event]) -> List[Dict]:
        """Detect all conflicts among a list of events"""
        conflicts = []
        
        for i in range(len(events)):
            for j in range(i + 1, len(events)):
                event1 = events[i]
                event2 = events[j]
                
                # Check for conflicts
                conflict_types = event1.has_conflict_with(event2)
                if conflict_types:
                    conflicts.append({
                        'event1_id': event1.event_id,
                        'event1_name': event1.name,
                        'event2_id': event2.event_id,
                        'event2_name': event2.name,
                        'conflict_types': [ct.value for ct in conflict_types],
                        'severity': self._calculate_severity(conflict_types, event1, event2),
                        'resolved': False,
                        'resolution_suggestions': self._suggest_resolutions(event1, event2, conflict_types)
                    })
        
        return conflicts
    
    def _calculate_severity(self, conflict_types: List[ConflictType], 
                           event1: Event, event2: Event) -> str:
        """Calculate severity of conflict"""
        # More conflicts = higher severity
        conflict_count = len(conflict_types)
        
        # Check for critical conflicts
        has_venue = ConflictType.VENUE_CONFLICT in conflict_types
        has_time = ConflictType.TIME_CONFLICT in conflict_types
        has_organizer = ConflictType.ORGANIZER_CONFLICT in conflict_types
        
        if has_time and has_venue:
            return "critical"
        elif has_time and (has_venue or has_organizer):
            return "high"
        elif conflict_count >= 2:
            return "medium"
        else:
            return "low"
    
    def _suggest_resolutions(self, event1: Event, event2: Event, 
                            conflict_types: List[ConflictType]) -> List[str]:
        """Suggest resolutions for conflicts"""
        suggestions = []
        
        for conflict in conflict_types:
            if conflict == ConflictType.TIME_CONFLICT:
                suggestions.append("Reschedule one of the events to a different time slot")
                suggestions.append("Shorten the duration of one event")
            elif conflict == ConflictType.VENUE_CONFLICT:
                suggestions.append("Use a different venue with similar capacity")
                suggestions.append("Relocate one event to an alternative venue")
            elif conflict == ConflictType.RESOURCE_CONFLICT:
                suggestions.append("Share resources or use alternative resources")
                suggestions.append("Reschedule to when resources are available")
            elif conflict == ConflictType.ORGANIZER_CONFLICT:
                suggestions.append("Assign a co-organizer for one event")
                suggestions.append("Reschedule to avoid organizer conflict")
            elif conflict == ConflictType.ATTENDEE_CONFLICT:
                suggestions.append("Limit overlap in expected attendees")
                suggestions.append("Consider streaming one event")
        
        return list(set(suggestions))[:5]
    
    def resolve_conflict(self, conflict: Dict, events: List[Event]) -> Dict:
        """Resolve a conflict between events"""
        resolution = {
            'conflict_resolved': False,
            'actions_taken': [],
            'new_schedule': []
        }
        
        event1 = next((e for e in events if e.event_id == conflict['event1_id']), None)
        event2 = next((e for e in events if e.event_id == conflict['event2_id']), None)
        
        if not event1 or not event2:
            return resolution
        
        conflict_types = [ConflictType(ct) for ct in conflict['conflict_types']]
        
        # Resolve time conflict first
        if ConflictType.TIME_CONFLICT in conflict_types:
            # Try to shift one event
            if event1.priority.value > event2.priority.value:
                # Shift event2
                new_start = event2.scheduled_end + datetime.timedelta(minutes=30)
                new_end = new_start + datetime.timedelta(
                    minutes=(event2.scheduled_end - event2.scheduled_start).total_seconds() / 60
                )
                event2.scheduled_start = new_start
                event2.scheduled_end = new_end
                resolution['actions_taken'].append(f"Moved {event2.name} to {new_start.strftime('%H:%M')}")
            else:
                # Shift event1
                new_start = event1.scheduled_end + datetime.timedelta(minutes=30)
                new_end = new_start + datetime.timedelta(
                    minutes=(event1.scheduled_end - event1.scheduled_start).total_seconds() / 60
                )
                event1.scheduled_start = new_start
                event1.scheduled_end = new_end
                resolution['actions_taken'].append(f"Moved {event1.name} to {new_start.strftime('%H:%M')}")
        
        # Resolve venue conflict
        if ConflictType.VENUE_CONFLICT in conflict_types:
            # Try to find alternative venue
            if event1.priority.value > event2.priority.value:
                resolution['actions_taken'].append(f"Need alternative venue for {event2.name}")
            else:
                resolution['actions_taken'].append(f"Need alternative venue for {event1.name}")
        
        resolution['conflict_resolved'] = True
        resolution['new_schedule'] = [event1, event2]
        
        return resolution
    
    def check_venue_capacity(self, event: Event, venue: Venue) -> bool:
        """Check if venue can accommodate expected attendees"""
        return event.expected_attendees <= venue.capacity * self.conflict_thresholds['venue_capacity_ratio']


class SmartScheduler:
    """Intelligent scheduling algorithm for campus events"""
    
    def __init__(self):
        self.conflict_detector = ConflictDetector()
        self.schedule_cache = {}
        
    def generate_optimal_schedule(self, events: List[Event], venues: List[Venue], 
                                 resources: List[Resource], start_date: datetime.date,
                                 end_date: datetime.date) -> EventSchedule:
        """Generate optimal schedule for events"""
        schedule = EventSchedule(
            schedule_id=str(uuid.uuid4()),
            date=start_date
        )
        
        # Sort events by priority
        sorted_events = sorted(events, key=lambda e: e.priority.value, reverse=True)
        
        # Try to schedule each event
        scheduled_events = []
        conflicts = []
        
        for event in sorted_events:
            # Find best time slot
            best_slot, best_venue, best_resources = self._find_optimal_slot(
                event, venues, resources, scheduled_events, start_date, end_date
            )
            
            if best_slot:
                event.scheduled_start = best_slot.start_time
                event.scheduled_end = best_slot.end_time
                event.assigned_venue = best_venue.venue_id if best_venue else None
                event.assigned_resources = [r.resource_id for r in best_resources]
                event.status = "scheduled"
                scheduled_events.append(event)
            else:
                # Could not schedule - find alternative
                alternative = self._find_alternative_schedule(event, venues, resources, scheduled_events)
                if alternative:
                    event.scheduled_start = alternative['start']
                    event.scheduled_end = alternative['end']
                    event.assigned_venue = alternative['venue_id']
                    event.status = "scheduled"
                    scheduled_events.append(event)
                else:
                    event.status = "pending"
            
            # Detect conflicts in current schedule
            new_conflicts = self.conflict_detector.detect_all_conflicts(scheduled_events)
            conflicts.extend(new_conflicts)
        
        # Update schedule
        schedule.events = scheduled_events
        schedule.total_events = len(scheduled_events)
        schedule.total_attendees = sum(e.expected_attendees for e in scheduled_events)
        schedule.conflicts_detected = len(conflicts)
        schedule.optimization_score = self._calculate_optimization_score(scheduled_events, venues)
        
        # Store in cache
        self.schedule_cache[schedule.schedule_id] = schedule
        
        return schedule
    
    def _find_optimal_slot(self, event: Event, venues: List[Venue], 
                          resources: List[Resource], scheduled_events: List[Event],
                          start_date: datetime.date, end_date: datetime.date) -> Tuple[Optional[TimeSlot], Optional[Venue], List[Resource]]:
        """Find optimal time slot for an event"""
        # Generate candidate time slots
        candidates = self._generate_time_slots(start_date, end_date, event)
        
        # Try each candidate
        for slot in candidates:
            # Check venue availability
            available_venues = []
            for venue in venues:
                if venue.is_available(slot, slot.start_time.date()):
                    if self.conflict_detector.check_venue_capacity(event, venue):
                        available_venues.append(venue)
            
            if not available_venues:
                continue
            
            # Check resource availability
            available_resources = []
            for resource in resources:
                # Check if resource is needed
                needed = any(r['resource_id'] == resource.resource_id for r in event.resources_needed)
                if needed and resource.is_available(slot, slot.start_time.date()):
                    available_resources.append(resource)
            
            # Check if all resources are available
            needed_resources = [r['resource_id'] for r in event.resources_needed]
            available_resource_ids = [r.resource_id for r in available_resources]
            all_resources_available = all(r_id in available_resource_ids for r_id in needed_resources)
            
            if not all_resources_available and needed_resources:
                continue
            
            # Check conflicts with scheduled events
            has_conflict = False
            for scheduled in scheduled_events:
                if scheduled.scheduled_start and scheduled.scheduled_end:
                    existing_slot = TimeSlot(scheduled.scheduled_start, scheduled.scheduled_end)
                    if slot.overlaps_with(existing_slot):
                        has_conflict = True
                        break
            
            if has_conflict:
                continue
            
            # Found suitable slot
            best_venue = available_venues[0] if available_venues else None
            best_resources = available_resources if not needed_resources else available_resources[:len(needed_resources)]
            
            return slot, best_venue, best_resources
        
        return None, None, []
    
    def _generate_time_slots(self, start_date: datetime.date, 
                            end_date: datetime.date, event: Event) -> List[TimeSlot]:
        """Generate candidate time slots"""
        slots = []
        current_date = start_date
        
        # Typical event durations
        if event.event_type in [EventType.WORKSHOP, EventType.SEMINAR, EventType.CONFERENCE]:
            default_duration = 120  # 2 hours
        elif event.event_type == EventType.CLUB:
            default_duration = 60
        else:
            default_duration = 90
        
        # Generate slots for each day
        while current_date <= end_date:
            if current_date.weekday() < 5:  # Weekdays only
                # Morning slots (9 AM - 12 PM)
                for hour in [9, 10, 11]:
                    start = datetime.datetime.combine(current_date, datetime.time(hour, 0))
                    end = start + datetime.timedelta(minutes=default_duration)
                    slots.append(TimeSlot(start, end))
                
                # Afternoon slots (1 PM - 5 PM)
                for hour in [13, 14, 15, 16]:
                    start = datetime.datetime.combine(current_date, datetime.time(hour, 0))
                    end = start + datetime.timedelta(minutes=default_duration)
                    slots.append(TimeSlot(start, end))
            else:
                # Weekend slots (limited)
                for hour in [10, 11, 14, 15]:
                    start = datetime.datetime.combine(current_date, datetime.time(hour, 0))
                    end = start + datetime.timedelta(minutes=default_duration)
                    slots.append(TimeSlot(start, end))
            
            current_date += datetime.timedelta(days=1)
        
        return slots
    
    def _find_alternative_schedule(self, event: Event, venues: List[Venue],
                                  resources: List[Resource], scheduled_events: List[Event]) -> Optional[Dict]:
        """Find alternative schedule for an event"""
        # Try different venues
        for venue in venues:
            # Try different time slots
            for hour in range(8, 20):  # 8 AM to 8 PM
                for minute in [0, 30]:
                    start = datetime.datetime.now().replace(
                        hour=hour, minute=minute, second=0, microsecond=0
                    ) + datetime.timedelta(days=random.randint(1, 7))
                    end = start + datetime.timedelta(minutes=90)
                    slot = TimeSlot(start, end)
                    
                    if venue.is_available(slot, start.date()):
                        return {
                            'start': start,
                            'end': end,
                            'venue_id': venue.venue_id
                        }
        return None
    
    def _calculate_optimization_score(self, events: List[Event], venues: List[Venue]) -> float:
        """Calculate optimization score for a schedule"""
        if not events or not venues:
            return 0.0
        
        scores = []
        
        # Venue utilization
        venue_utilization = {}
        for venue in venues:
            assigned_count = sum(1 for e in events if e.assigned_venue == venue.venue_id)
            venue_utilization[venue.venue_id] = assigned_count
        
        if venue_utilization:
            utilization_rate = sum(venue_utilization.values()) / len(venues)
            scores.append(utilization_rate * 30)  # Max 30 points
        
        # Time spread (minimize overlapping events in different venues)
        time_slots = defaultdict(int)
        for event in events:
            if event.scheduled_start:
                hour_key = event.scheduled_start.strftime('%Y-%m-%d %H')
                time_slots[hour_key] += 1
        
        if time_slots:
            max_concurrent = max(time_slots.values()) if time_slots else 0
            concurrent_score = max(0, 100 - (max_concurrent * 10))
            scores.append(concurrent_score * 0.3)  # Max 30 points
        
        # Priority achievement
        priority_score = sum(e.priority.value for e in events if e.status == 'scheduled')
        max_priority = sum(e.priority.value for e in events)
        if max_priority > 0:
            priority_score = (priority_score / max_priority) * 40
            scores.append(priority_score)
        
        return sum(scores) / len(scores) if scores else 0


class CampusEventManager:
    """Main system for campus event management with integrations"""
    
    def __init__(self, sustainability_system=None, skill_wallet_manager=None,
                 plagiarism_system=None, ai_detection_system=None, citation_system=None):
        self.sustainability_system = sustainability_system
        self.skill_wallet_manager = skill_wallet_manager
        self.plagiarism_system = plagiarism_system
        self.ai_detection_system = ai_detection_system
        self.citation_system = citation_system
        
        # Core components
        self.conflict_detector = ConflictDetector()
        self.smart_scheduler = SmartScheduler()
        
        # Storage
        self.events: Dict[str, Event] = {}
        self.venues: Dict[str, Venue] = {}
        self.resources: Dict[str, Resource] = {}
        self.attendees: Dict[str, Attendee] = {}
        self.schedules: Dict[str, EventSchedule] = {}
        self.event_registrations: Dict[str, List[str]] = defaultdict(list)
        
        # Statistics
        self.total_events = 0
        self.total_conflicts = 0
        self.resolved_conflicts = 0
        
        # Initialize sample data
        self._initialize_sample_data()
        
        # Initialize event management skills
        self._initialize_event_skills()
    
    def _initialize_sample_data(self):
        """Initialize sample venues and resources"""
        # Venues
        self.venues = {
            'ven_001': Venue(
                venue_id='ven_001',
                name='Main Auditorium',
                venue_type=VenueType.AUDITORIUM,
                capacity=500,
                location='Building A, Floor 1',
                facilities=['Projector', 'Sound System', 'Stage', 'Lighting'],
                equipment=['Microphones', 'Speakers', 'Projector Screen'],
                cost_per_hour=100.0
            ),
            'ven_002': Venue(
                venue_id='ven_002',
                name='Conference Room 101',
                venue_type=VenueType.CONFERENCE_ROOM,
                capacity=50,
                location='Building B, Floor 1',
                facilities=['Whiteboard', 'Projector', 'Video Conferencing'],
                equipment=['Laptop', 'Projector', 'Conference Phone'],
                cost_per_hour=50.0
            ),
            'ven_003': Venue(
                venue_id='ven_003',
                name='Science Laboratory',
                venue_type=VenueType.LABORATORY,
                capacity=30,
                location='Building C, Floor 2',
                facilities=['Lab Equipment', 'Safety Equipment', 'Computers'],
                equipment=['Microscopes', 'Computers', 'Lab Supplies'],
                cost_per_hour=75.0
            ),
            'ven_004': Venue(
                venue_id='ven_004',
                name='Student Union Hall',
                venue_type=VenueType.COMMON_AREA,
                capacity=200,
                location='Student Center, Floor 1',
                facilities=['Tables', 'Chairs', 'Kitchen', 'Stage'],
                equipment=['Sound System', 'Projector', 'Tables'],
                cost_per_hour=80.0
            ),
            'ven_005': Venue(
                venue_id='ven_005',
                name='Outdoor Amphitheater',
                venue_type=VenueType.OUTDOOR,
                capacity=300,
                location='Campus Quad',
                facilities=['Outdoor Stage', 'Seating', 'Lighting'],
                equipment=['Portable Sound System', 'Microphones'],
                cost_per_hour=60.0
            )
        }
        
        # Resources
        self.resources = {
            'res_001': Resource(
                resource_id='res_001',
                name='Projector',
                resource_type='Equipment',
                quantity=10,
                available_quantity=8
            ),
            'res_002': Resource(
                resource_id='res_002',
                name='Laptop Computers',
                resource_type='Equipment',
                quantity=20,
                available_quantity=15
            ),
            'res_003': Resource(
                resource_id='res_003',
                name='Sound System',
                resource_type='Equipment',
                quantity=5,
                available_quantity=3
            ),
            'res_004': Resource(
                resource_id='res_004',
                name='Whiteboards',
                resource_type='Supplies',
                quantity=15,
                available_quantity=12
            ),
            'res_005': Resource(
                resource_id='res_005',
                name='Microphones',
                resource_type='Equipment',
                quantity=12,
                available_quantity=8
            )
        }
    
    def _initialize_event_skills(self):
        """Initialize skills related to event management"""
        if self.skill_wallet_manager:
            event_skills = [
                {
                    'id': 'skill_evt_001',
                    'name': 'Event Planning',
                    'description': 'Planning and organizing campus events',
                    'category': SkillCategory.PROJECT_MANAGEMENT,
                    'level': SkillLevel.BEGINNER
                },
                {
                    'id': 'skill_evt_002',
                    'name': 'Conflict Resolution',
                    'description': 'Resolving schedule conflicts and issues',
                    'category': SkillCategory.SOFT,
                    'level': SkillLevel.BEGINNER
                },
                {
                    'id': 'skill_evt_003',
                    'name': 'Resource Management',
                    'description': 'Managing event resources efficiently',
                    'category': SkillCategory.TECHNICAL,
                    'level': SkillLevel.BEGINNER
                },
                {
                    'id': 'skill_evt_004',
                    'name': 'Venue Management',
                    'description': 'Managing campus venues and facilities',
                    'category': SkillCategory.TECHNICAL,
                    'level': SkillLevel.BEGINNER
                }
            ]
            
            for skill_data in event_skills:
                skill = Skill(
                    skill_id=skill_data['id'],
                    name=skill_data['name'],
                    description=skill_data['description'],
                    category=skill_data['category'],
                    level=skill_data['level']
                )
                self.skill_wallet_manager.skill_definitions[skill.skill_id] = skill
    
    def create_event(self, name: str, description: str, event_type: EventType,
                    organizer_id: str, organizer_name: str, department: str,
                    expected_attendees: int, priority: EventPriority = EventPriority.MEDIUM,
                    venue_preferences: List[str] = None, resources_needed: List[Dict] = None,
                    speaker: str = "", budget: float = 0.0, tags: List[str] = None) -> Event:
        """Create a new event"""
        event = Event(
            event_id=str(uuid.uuid4()),
            name=name,
            description=description,
            event_type=event_type,
            priority=priority,
            organizer_id=organizer_id,
            organizer_name=organizer_name,
            department=department,
            expected_attendees=expected_attendees,
            venue_preferences=venue_preferences or [],
            resources_needed=resources_needed or [],
            speaker=speaker,
            budget=budget,
            tags=tags or [],
            created_at=datetime.datetime.now(),
            updated_at=datetime.datetime.now()
        )
        
        self.events[event.event_id] = event
        self.total_events += 1
        
        # Update sustainability system
        if self.sustainability_system:
            self._update_sustainability_for_event_creation(organizer_id, event)
        
        # Update skill wallet
        if self.skill_wallet_manager:
            self._update_skill_wallet_for_event_creation(organizer_id, event)
        
        return event
    
    def _update_sustainability_for_event_creation(self, user_id: str, event: Event):
        """Update sustainability system for event creation"""
        user = self.sustainability_system.get_user(user_id)
        if not user:
            return
        
        # Award points for planning sustainable events
        points = 10
        
        # Bonus for sustainability-focused events
        if event.event_type == EventType.SUSTAINABILITY:
            points += 20
            print(f"  🌱 Sustainability event created! +20 bonus points")
        
        # Bonus for good planning
        if event.expected_attendees > 100:
            points += 10
        elif event.expected_attendees > 50:
            points += 5
        
        user.total_points += points
        user.add_xp(points // 2)
        print(f"  📅 Event created! +{points} sustainability points")
    
    def _update_skill_wallet_for_event_creation(self, user_id: str, event: Event):
        """Update skill wallet for event creation"""
        wallet = self.skill_wallet_manager.get_skill_wallet(user_id)
        if not wallet:
            return
        
        # Award Event Planning skill
        skill_id = 'skill_evt_001'
        if skill_id in wallet.skills:
            skill = wallet.skills[skill_id]
            skill.add_experience(10)
            if skill.experience_points > 100:
                skill.level = SkillLevel.INTERMEDIATE
                print(f"  📈 Upgraded Event Planning skill to INTERMEDIATE!")
        else:
            self.skill_wallet_manager.award_skill(user_id, skill_id, SkillLevel.BEGINNER)
            print(f"  🎯 Awarded Event Planning skill!")
    
    def schedule_events(self, start_date: datetime.date, end_date: datetime.date) -> EventSchedule:
        """Schedule multiple events"""
        events_list = list(self.events.values())
        venues_list = list(self.venues.values())
        resources_list = list(self.resources.values())
        
        # Generate schedule
        schedule = self.smart_scheduler.generate_optimal_schedule(
            events_list, venues_list, resources_list, start_date, end_date
        )
        
        # Store schedule
        self.schedules[schedule.schedule_id] = schedule
        
        # Update event status
        for event in schedule.events:
            if event.status == "scheduled":
                self.events[event.event_id].scheduled_start = event.scheduled_start
                self.events[event.event_id].scheduled_end = event.scheduled_end
                self.events[event.event_id].assigned_venue = event.assigned_venue
                self.events[event.event_id].status = event.status
        
        # Process conflicts
        for conflict in schedule.events:
            if hasattr(conflict, 'conflicts'):
                self.total_conflicts += len(conflict.conflicts)
        
        return schedule
    
    def detect_conflicts(self, event_id: str) -> List[Dict]:
        """Detect conflicts for a specific event"""
        event = self.events.get(event_id)
        if not event:
            return []
        
        all_events = list(self.events.values())
        other_events = [e for e in all_events if e.event_id != event_id and e.status == 'scheduled']
        
        conflicts = []
        for other in other_events:
            conflict_types = event.has_conflict_with(other)
            if conflict_types:
                conflicts.append({
                    'event': event.name,
                    'conflicting_event': other.name,
                    'conflict_types': [ct.value for ct in conflict_types],
                    'severity': self.conflict_detector._calculate_severity(conflict_types, event, other),
                    'suggestions': self.conflict_detector._suggest_resolutions(event, other, conflict_types)
                })
        
        return conflicts
    
    def resolve_conflict(self, conflict: Dict) -> Dict:
        """Resolve a specific conflict"""
        result = self.conflict_detector.resolve_conflict(conflict, list(self.events.values()))
        
        if result['conflict_resolved']:
            self.resolved_conflicts += 1
            
            # Update events
            for event in result['new_schedule']:
                if event.event_id in self.events:
                    self.events[event.event_id] = event
            
            # Award conflict resolution skill
            if self.skill_wallet_manager and 'user_id' in conflict:
                user_id = conflict.get('user_id')
                if user_id:
                    wallet = self.skill_wallet_manager.get_skill_wallet(user_id)
                    if wallet:
                        skill_id = 'skill_evt_002'
                        if skill_id not in wallet.skills:
                            self.skill_wallet_manager.award_skill(user_id, skill_id, SkillLevel.BEGINNER)
                            print(f"  🤝 Awarded Conflict Resolution skill!")
        
        return result
    
    def get_venue_availability(self, venue_id: str, date: datetime.date) -> List[TimeSlot]:
        """Get availability for a venue on a specific date"""
        venue = self.venues.get(venue_id)
        if not venue:
            return []
        
        date_key = date.isoformat()
        if date_key not in venue.availability:
            return []
        
        return venue.availability[date_key]
    
    def book_venue(self, venue_id: str, start_time: datetime.datetime, 
                  end_time: datetime.datetime, event_id: str) -> bool:
        """Book a venue for an event"""
        venue = self.venues.get(venue_id)
        if not venue:
            return False
        
        slot = TimeSlot(start_time, end_time)
        date = start_time.date()
        
        if venue.is_available(slot, date):
            venue.book(slot, date)
            
            # Update event
            event = self.events.get(event_id)
            if event:
                event.assigned_venue = venue_id
                event.scheduled_start = start_time
                event.scheduled_end = end_time
                event.status = 'scheduled'
            
            return True
        
        return False
    
    def register_attendee(self, event_id: str, attendee_id: str) -> bool:
        """Register an attendee for an event"""
        event = self.events.get(event_id)
        if not event:
            return False
        
        if attendee_id not in self.attendees:
            return False
        
        if attendee_id not in self.event_registrations[event_id]:
            self.event_registrations[event_id].append(attendee_id)
            return True
        
        return False
    
    def add_attendee(self, name: str, email: str, department: str, 
                    role: str, interests: List[str] = None) -> Attendee:
        """Add a new attendee"""
        attendee = Attendee(
            attendee_id=str(uuid.uuid4()),
            name=name,
            email=email,
            department=department,
            role=role,
            interests=interests or []
        )
        
        self.attendees[attendee.attendee_id] = attendee
        return attendee
    
    def get_event_analytics(self) -> Dict:
        """Get comprehensive event analytics"""
        total_events = len(self.events)
        total_scheduled = sum(1 for e in self.events.values() if e.status == 'scheduled')
        total_pending = sum(1 for e in self.events.values() if e.status == 'pending')
        total_completed = sum(1 for e in self.events.values() if e.status == 'completed')
        
        # Event type distribution
        type_distribution = Counter(e.event_type.value for e in self.events.values())
        
        # Department distribution
        dept_distribution = Counter(e.department for e in self.events.values())
        
        # Average attendees
        avg_attendees = sum(e.expected_attendees for e in self.events.values()) / total_events if total_events > 0 else 0
        
        # Venue utilization
        venue_utilization = {}
        for venue in self.venues.values():
            assigned = sum(1 for e in self.events.values() if e.assigned_venue == venue.venue_id)
            venue_utilization[venue.name] = assigned
        
        return {
            'total_events': total_events,
            'scheduled': total_scheduled,
            'pending': total_pending,
            'completed': total_completed,
            'completion_rate': (total_completed / total_events * 100) if total_events > 0 else 0,
            'event_type_distribution': dict(type_distribution),
            'department_distribution': dict(dept_distribution),
            'average_attendees': avg_attendees,
            'venue_utilization': venue_utilization,
            'total_conflicts': self.total_conflicts,
            'resolved_conflicts': self.resolved_conflicts,
            'conflict_resolution_rate': (self.resolved_conflicts / self.total_conflicts * 100) if self.total_conflicts > 0 else 100
        }
    
    def generate_schedule_report(self, schedule_id: str) -> Dict:
        """Generate a detailed report for a schedule"""
        schedule = self.schedules.get(schedule_id)
        if not schedule:
            return {}
        
        # Group events by day
        events_by_day = defaultdict(list)
        for event in schedule.events:
            if event.scheduled_start:
                day = event.scheduled_start.date()
                events_by_day[day.isoformat()].append(event)
        
        # Generate timeline
        timeline = {}
        for day, events in events_by_day.items():
            day_events = []
            for event in sorted(events, key=lambda e: e.scheduled_start if e.scheduled_start else datetime.datetime.now()):
                day_events.append({
                    'name': event.name,
                    'time': f"{event.scheduled_start.strftime('%H:%M')} - {event.scheduled_end.strftime('%H:%M')}" if event.scheduled_start else 'TBD',
                    'venue': next((v.name for v in self.venues.values() if v.venue_id == event.assigned_venue), 'Not assigned'),
                    'attendees': event.expected_attendees,
                    'status': event.status
                })
            timeline[day] = day_events
        
        return {
            'schedule_id': schedule_id,
            'total_events': schedule.total_events,
            'total_attendees': schedule.total_attendees,
            'utilization_rate': schedule.utilization_rate,
            'optimization_score': schedule.optimization_score,
            'conflicts_detected': schedule.conflicts_detected,
            'timeline': timeline,
            'events': [
                {
                    'id': e.event_id,
                    'name': e.name,
                    'type': e.event_type.value,
                    'priority': e.priority.name,
                    'time': f"{e.scheduled_start.strftime('%Y-%m-%d %H:%M')} - {e.scheduled_end.strftime('%H:%M')}" if e.scheduled_start else 'TBD',
                    'venue': next((v.name for v in self.venues.values() if v.venue_id == e.assigned_venue), 'Not assigned'),
                    'attendees': e.expected_attendees
                }
                for e in schedule.events
            ]
        }


def demo_campus_event_system():
    """Demonstrate the campus event conflict detection and scheduling system"""
    print("🏫 CAMPUS EVENT CONFLICT DETECTION & SMART SCHEDULING 🏫")
    print("=" * 80)
    
    # Initialize integrated systems (simplified for demo)
    from sustainability_gamification import SustainabilityGamification
    from skill_wallet_project_management import SkillWalletProjectManager
    
    sustainability = SustainabilityGamification()
    skill_manager = SkillWalletProjectManager(sustainability)
    
    # Initialize main system
    event_manager = CampusEventManager(sustainability, skill_manager)
    
    # Register users
    print("\n📝 Registering users...")
    sustainability.register_user("user_001", "EventPlannerAlice")
    sustainability.register_user("user_002", "StudentBob")
    print("✅ Users registered")
    
    print("\n📅 Creating events...")
    
    # Create events
    events_data = [
        {
            'name': 'Sustainability Conference 2026',
            'description': 'Annual conference on campus sustainability initiatives',
            'event_type': EventType.SUSTAINABILITY,
            'organizer_id': 'user_001',
            'organizer_name': 'Alice Planner',
            'department': 'Sustainability Office',
            'expected_attendees': 200,
            'priority': EventPriority.HIGH,
            'venue_preferences': ['ven_001', 'ven_005'],
            'resources_needed': [
                {'resource_id': 'res_001', 'quantity': 2},
                {'resource_id': 'res_003', 'quantity': 1}
            ],
            'speaker': 'Dr. Green',
            'budget': 5000.0,
            'tags': ['sustainability', 'conference', 'annual']
        },
        {
            'name': 'Student Club Fair',
            'description': 'Annual student club recruitment fair',
            'event_type': EventType.CLUB,
            'organizer_id': 'user_001',
            'organizer_name': 'Alice Planner',
            'department': 'Student Affairs',
            'expected_attendees': 300,
            'priority': EventPriority.MEDIUM,
            'venue_preferences': ['ven_004'],
            'resources_needed': [
                {'resource_id': 'res_004', 'quantity': 10},
                {'resource_id': 'res_002', 'quantity': 5}
            ],
            'budget': 2000.0,
            'tags': ['clubs', 'students', 'fair']
        },
        {
            'name': 'Research Symposium',
            'description': 'Student research presentations and networking',
            'event_type': EventType.ACADEMIC,
            'organizer_id': 'user_002',
            'organizer_name': 'Bob Student',
            'department': 'Research Office',
            'expected_attendees': 150,
            'priority': EventPriority.HIGH,
            'venue_preferences': ['ven_001', 'ven_002'],
            'resources_needed': [
                {'resource_id': 'res_001', 'quantity': 1},
                {'resource_id': 'res_002', 'quantity': 10}
            ],
            'speaker': 'Prof. Smith',
            'budget': 3000.0,
            'tags': ['research', 'symposium', 'academic']
        },
        {
            'name': 'Yoga Workshop',
            'description': 'Wellness and mindfulness workshop',
            'event_type': EventType.HEALTH,
            'organizer_id': 'user_002',
            'organizer_name': 'Bob Student',
            'department': 'Health Center',
            'expected_attendees': 40,
            'priority': EventPriority.LOW,
            'venue_preferences': ['ven_002', 'ven_003'],
            'resources_needed': [],
            'budget': 500.0,
            'tags': ['wellness', 'yoga', 'health']
        },
        {
            'name': 'Solar Panel Installation Workshop',
            'description': 'Hands-on workshop for solar panel installation',
            'event_type': EventType.WORKSHOP,
            'organizer_id': 'user_001',
            'organizer_name': 'Alice Planner',
            'department': 'Sustainability Office',
            'expected_attendees': 50,
            'priority': EventPriority.MEDIUM,
            'venue_preferences': ['ven_003', 'ven_005'],
            'resources_needed': [
                {'resource_id': 'res_002', 'quantity': 5},
                {'resource_id': 'res_001', 'quantity': 1}
            ],
            'speaker': 'Solar Expert',
            'budget': 1500.0,
            'tags': ['solar', 'workshop', 'renewable']
        }
    ]
    
    created_events = []
    for data in events_data:
        event = event_manager.create_event(**data)
        created_events.append(event)
        print(f"  ✅ Created: {event.name}")
    
    # Add attendees
    print("\n👥 Adding attendees...")
    attendees = [
        event_manager.add_attendee("John Doe", "john@campus.edu", "Computer Science", "Student", ["sustainability", "coding"]),
        event_manager.add_attendee("Jane Smith", "jane@campus.edu", "Environmental Science", "Student", ["sustainability", "research"]),
        event_manager.add_attendee("Mike Brown", "mike@campus.edu", "Engineering", "Student", ["clubs", "sports"])
    ]
    
    for attendee in attendees:
        print(f"  ✅ Added: {attendee.name} ({attendee.role})")
    
    # Schedule events
    print("\n📅 Scheduling events...")
    start_date = datetime.date.today()
    end_date = start_date + datetime.timedelta(days=14)
    
    schedule = event_manager.schedule_events(start_date, end_date)
    print(f"  ✅ Schedule created with {len(schedule.events)} events")
    
    # Detect conflicts
    print("\n🔍 Detecting conflicts...")
    all_conflicts = []
    for event in schedule.events:
        if hasattr(event, 'conflicts'):
            all_conflicts.extend(event.conflicts)
    
    print(f"  ✅ Detected {len(all_conflicts)} conflicts")
    
    # Show conflict details
    if all_conflicts:
        print("\n⚠️ Conflict Details:")
        for i, conflict in enumerate(all_conflicts[:3], 1):
            print(f"\n  Conflict {i}:")
            print(f"    {conflict.get('event1_name', 'Unknown')} ↔ {conflict.get('event2_name', 'Unknown')}")
            print(f"    Types: {', '.join(conflict.get('conflict_types', []))}")
            print(f"    Severity: {conflict.get('severity', 'Unknown')}")
            if conflict.get('resolution_suggestions'):
                print(f"    Suggestions:")
                for suggestion in conflict['resolution_suggestions'][:2]:
                    print(f"      • {suggestion}")
    
    # Resolve conflicts
    print("\n🔧 Resolving conflicts...")
    for conflict in all_conflicts[:2]:
        result = event_manager.resolve_conflict(conflict)
        if result.get('conflict_resolved'):
            print(f"  ✅ Resolved: {result['actions_taken']}")
    
    # Get venue availability
    print("\n🏛️ Venue Availability:")
    venue = event_manager.venues.get('ven_001')
    if venue:
        print(f"  Main Auditorium capacity: {venue.capacity}")
    
    # Get event analytics
    print("\n📊 Event Analytics:")
    analytics = event_manager.get_event_analytics()
    print(f"  Total Events: {analytics['total_events']}")
    print(f"  Scheduled: {analytics['scheduled']}")
    print(f"  Completed: {analytics['completed']}")
    print(f"  Average Attendees: {analytics['average_attendees']:.0f}")
    print(f"  Conflict Resolution Rate: {analytics['conflict_resolution_rate']:.1f}%")
    
    if analytics['event_type_distribution']:
        print("\n  Event Types:")
        for ev_type, count in analytics['event_type_distribution'].items():
            print(f"    • {ev_type}: {count}")
    
    # Get schedule report
    print("\n📅 Schedule Report:")
    report = event_manager.generate_schedule_report(schedule.schedule_id)
    if report:
        print(f"  Optimization Score: {report['optimization_score']:.1f}%")
        print(f"  Total Attendees: {report['total_attendees']}")
        
        if report['timeline']:
            print("\n  Timeline:")
            for day, events in list(report['timeline'].items())[:3]:
                print(f"\n    {day}:")
                for event in events[:3]:
                    print(f"      • {event['name']} ({event['time']}) - {event['venue']}")
    
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
            if skill.skill_id.startswith('skill_evt_'):
                print(f"    • {skill.name}: {skill.level.value.title()}")
    
    print("\n✨ Demonstration complete! ✨")


if __name__ == "__main__":
    demo_campus_event_system()
