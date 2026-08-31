"""
Event Recommendation Engine Based on Student Interests
A sophisticated recommendation system for campus events using collaborative filtering and content-based approaches
"""

import json
import datetime
import math
import random
import hashlib
from typing import Dict, List, Set, Tuple, Optional, Any, Union
from dataclasses import dataclass, asdict
from collections import defaultdict, Counter
from enum import Enum
import time
from dataclasses import field

# ==================== Core Data Structures ====================

class EventCategory(Enum):
    """Event categories"""
    ACADEMIC = "academic"
    SOCIAL = "social"
    SPORTS = "sports"
    CULTURAL = "cultural"
    CAREER = "career"
    WORKSHOP = "workshop"
    SEMINAR = "seminar"
    CONFERENCE = "conference"
    NETWORKING = "networking"
    ENTERTAINMENT = "entertainment"
    VOLUNTEER = "volunteer"
    WELLNESS = "wellness"

class InterestLevel(Enum):
    """Student interest levels"""
    NONE = 0
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    VERY_HIGH = 4

class RecommendationAlgorithm(Enum):
    """Recommendation algorithms"""
    CONTENT_BASED = "content_based"
    COLLABORATIVE_FILTERING = "collaborative_filtering"
    HYBRID = "hybrid"
    POPULARITY = "popularity"
    PERSONALIZED = "personalized"
    CONTEXT_AWARE = "context_aware"

@dataclass
class Student:
    """Student profile"""
    id: str
    name: str
    department: str
    year: int
    interests: Dict[str, float]  # Interest scores
    preferences: Dict[str, Any]
    history: List['EventInteraction']
    embeddings: List[float] = None
    created_at: datetime.datetime = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.datetime.now()

@dataclass
class Event:
    """Campus event"""
    id: str
    title: str
    description: str
    category: EventCategory
    date: datetime.datetime
    location: str
    organizer: str
    capacity: int
    registered_count: int = 0
    tags: List[str] = field(default_factory=list)
    features: Dict[str, float] = field(default_factory=dict)
    rating: float = 0.0
    popularity_score: float = 0.0
    embeddings: List[float] = None
    created_at: datetime.datetime = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.datetime.now()
        if self.tags is None:
            self.tags = []

@dataclass
class EventInteraction:
    """Student-event interaction"""
    student_id: str
    event_id: str
    interaction_type: str  # view, register, attend, favorite, rate
    timestamp: datetime.datetime
    rating: float = 0.0
    feedback: str = ""

@dataclass
class Recommendation:
    """Recommendation result"""
    event: Event
    score: float
    algorithm: RecommendationAlgorithm
    reason: str
    confidence: float
    metrics: Dict[str, float] = field(default_factory=dict)

@dataclass
class RecommendationContext:
    """Context for recommendations"""
    time: datetime.datetime
    location: str
    weather: str
    season: str
    day_of_week: int
    upcoming_holidays: List[str]
    current_events: List[str]

# ==================== Feature Engineering ====================

class FeatureEngineer:
    """Extract and engineer features for events and students"""
    
    @staticmethod
    def extract_event_features(event: Event) -> Dict[str, float]:
        """Extract features from event"""
        features = {}
        
        # Time-based features
        now = datetime.datetime.now()
        days_until = (event.date - now).days
        features['days_until'] = max(0, days_until)
        features['is_weekend'] = 1.0 if event.date.weekday() >= 5 else 0.0
        features['is_evening'] = 1.0 if event.date.hour >= 18 else 0.0
        
        # Category features
        category_mapping = {
            EventCategory.ACADEMIC: 0.2,
            EventCategory.SOCIAL: 0.4,
            EventCategory.SPORTS: 0.3,
            EventCategory.CULTURAL: 0.5,
            EventCategory.CAREER: 0.8,
            EventCategory.WORKSHOP: 0.6,
            EventCategory.SEMINAR: 0.7,
            EventCategory.CONFERENCE: 0.9,
            EventCategory.NETWORKING: 0.6,
            EventCategory.ENTERTAINMENT: 0.3,
            EventCategory.VOLUNTEER: 0.4,
            EventCategory.WELLNESS: 0.3
        }
        features['category_popularity'] = category_mapping.get(event.category, 0.3)
        
        # Popularity features
        if event.capacity > 0:
            features['registration_rate'] = event.registered_count / event.capacity
        else:
            features['registration_rate'] = 0.0
        
        features['popularity'] = event.popularity_score
        
        # Tag features
        features['tag_count'] = len(event.tags)
        features['has_description'] = 1.0 if event.description else 0.0
        
        # Temporal features
        features['hour'] = event.date.hour / 24.0
        features['month'] = event.date.month / 12.0
        
        return features
    
    @staticmethod
    def extract_student_features(student: Student) -> Dict[str, float]:
        """Extract features from student"""
        features = {}
        
        # Department features
        dept_mapping = {
            'CS': 0.9,
            'Engineering': 0.8,
            'Business': 0.7,
            'Arts': 0.6,
            'Sciences': 0.7,
            'Math': 0.8
        }
        features['dept_score'] = dept_mapping.get(student.department, 0.5)
        
        # Year features
        features['year_score'] = student.year / 4.0
        
        # Interest features
        interest_weights = {
            'academic': 0.3,
            'social': 0.2,
            'sports': 0.15,
            'cultural': 0.15,
            'career': 0.2
        }
        
        total_interest = 0.0
        for category, weight in interest_weights.items():
            interest = student.interests.get(category, 0.0)
            features[f'interest_{category}'] = interest
            total_interest += interest * weight
        
        features['total_interest'] = total_interest
        
        # History features
        if student.history:
            events_attended = len([h for h in student.history if h.interaction_type == 'attend'])
            events_viewed = len([h for h in student.history if h.interaction_type == 'view'])
            features['attendance_rate'] = events_attended / max(1, events_viewed)
            features['history_length'] = len(student.history)
            
            # Average rating
            ratings = [h.rating for h in student.history if h.rating > 0]
            features['avg_rating'] = sum(ratings) / len(ratings) if ratings else 0.0
        else:
            features['attendance_rate'] = 0.0
            features['history_length'] = 0
            features['avg_rating'] = 0.0
        
        return features

# ==================== Recommendation Algorithms ====================

class ContentBasedRecommender:
    """Content-based recommendation using event features"""
    
    def __init__(self):
        self.event_vectors = {}
        self.student_vectors = {}
        self.feature_engineer = FeatureEngineer()
    
    def build_event_vector(self, event: Event) -> Dict[str, float]:
        """Build feature vector for event"""
        features = self.feature_engineer.extract_event_features(event)
        
        # Add tag-based features
        tag_weights = {
            'beginner': 0.2,
            'intermediate': 0.4,
            'advanced': 0.6,
            'expert': 0.8,
            'fun': 0.3,
            'professional': 0.7,
            'technical': 0.5,
            'creative': 0.4,
            'leadership': 0.6,
            'teamwork': 0.5,
            'innovation': 0.7,
            'entrepreneurship': 0.8
        }
        
        for tag in event.tags:
            if tag in tag_weights:
                features[f'tag_{tag}'] = tag_weights[tag]
        
        self.event_vectors[event.id] = features
        return features
    
    def build_student_vector(self, student: Student) -> Dict[str, float]:
        """Build preference vector for student"""
        features = self.feature_engineer.extract_student_features(student)
        
        # Derive preferences from history
        if student.history:
            attended_events = [h.event_id for h in student.history if h.interaction_type == 'attend']
            
            # Average features of attended events
            avg_features = defaultdict(float)
            for event_id in attended_events:
                if event_id in self.event_vectors:
                    for key, value in self.event_vectors[event_id].items():
                        avg_features[key] += value
            
            if attended_events:
                for key in avg_features:
                    avg_features[key] /= len(attended_events)
                
                # Merge with existing features
                for key, value in avg_features.items():
                    if key not in features:
                        features[key] = value * 0.5  # Weight history less
        
        self.student_vectors[student.id] = features
        return features
    
    def compute_similarity(self, student_vector: Dict[str, float], 
                          event_vector: Dict[str, float]) -> float:
        """Compute cosine similarity between student and event"""
        if not student_vector or not event_vector:
            return 0.0
        
        # Get intersection of features
        common_keys = set(student_vector.keys()) & set(event_vector.keys())
        if not common_keys:
            return 0.0
        
        # Compute cosine similarity
        dot_product = sum(student_vector[k] * event_vector[k] for k in common_keys)
        student_norm = math.sqrt(sum(v ** 2 for v in student_vector.values()))
        event_norm = math.sqrt(sum(v ** 2 for v in event_vector.values()))
        
        if student_norm == 0 or event_norm == 0:
            return 0.0
        
        return dot_product / (student_norm * event_norm)
    
    def recommend(self, student: Student, events: List[Event], 
                  top_n: int = 10) -> List[Recommendation]:
        """Generate content-based recommendations"""
        # Build vectors
        student_vector = self.build_student_vector(student)
        for event in events:
            self.build_event_vector(event)
        
        recommendations = []
        for event in events:
            event_vector = self.event_vectors.get(event.id, {})
            similarity = self.compute_similarity(student_vector, event_vector)
            
            if similarity > 0.1:
                recommendations.append(Recommendation(
                    event=event,
                    score=similarity,
                    algorithm=RecommendationAlgorithm.CONTENT_BASED,
                    reason=f"Matches your interests in {event.category.value}",
                    confidence=min(1.0, similarity * 1.5),
                    metrics={'similarity': similarity}
                ))
        
        recommendations.sort(key=lambda x: x.score, reverse=True)
        return recommendations[:top_n]

class CollaborativeFilteringRecommender:
    """Collaborative filtering using user-event interactions"""
    
    def __init__(self):
        self.user_item_matrix = {}
        self.similarity_matrix = {}
        self.interaction_weight = {
            'view': 0.2,
            'register': 0.5,
            'attend': 0.8,
            'favorite': 1.0,
            'rate': 1.2
        }
    
    def build_user_item_matrix(self, students: List[Student], events: List[Event]):
        """Build user-item interaction matrix"""
        # Initialize matrix
        for student in students:
            self.user_item_matrix[student.id] = {}
            for event in events:
                self.user_item_matrix[student.id][event.id] = 0.0
        
        # Fill with interactions
        for student in students:
            for interaction in student.history:
                if interaction.event_id in self.user_item_matrix[student.id]:
                    weight = self.interaction_weight.get(interaction.interaction_type, 0.0)
                    if interaction.rating > 0:
                        weight *= interaction.rating / 5.0
                    self.user_item_matrix[student.id][interaction.event_id] = max(
                        self.user_item_matrix[student.id][interaction.event_id],
                        weight
                    )
    
    def compute_user_similarity(self, user1: str, user2: str) -> float:
        """Compute similarity between two users"""
        if user1 not in self.user_item_matrix or user2 not in self.user_item_matrix:
            return 0.0
        
        vector1 = self.user_item_matrix[user1]
        vector2 = self.user_item_matrix[user2]
        
        # Find common items
        common_items = [item for item in vector1 if item in vector2 and vector1[item] > 0 and vector2[item] > 0]
        if not common_items:
            return 0.0
        
        # Pearson correlation
        items1 = [vector1[item] for item in common_items]
        items2 = [vector2[item] for item in common_items]
        
        mean1 = sum(items1) / len(items1)
        mean2 = sum(items2) / len(items2)
        
        numerator = sum((items1[i] - mean1) * (items2[i] - mean2) for i in range(len(common_items)))
        denom1 = math.sqrt(sum((items1[i] - mean1) ** 2 for i in range(len(common_items))))
        denom2 = math.sqrt(sum((items2[i] - mean2) ** 2 for i in range(len(common_items))))
        
        if denom1 == 0 or denom2 == 0:
            return 0.0
        
        return numerator / (denom1 * denom2)
    
    def find_similar_users(self, student_id: str, students: List[Student]) -> List[Tuple[str, float]]:
        """Find similar users"""
        similarities = []
        for other_student in students:
            if other_student.id != student_id:
                sim = self.compute_user_similarity(student_id, other_student.id)
                if sim > 0.1:
                    similarities.append((other_student.id, sim))
        
        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities
    
    def recommend(self, student: Student, students: List[Student], 
                  events: List[Event], top_n: int = 10) -> List[Recommendation]:
        """Generate collaborative filtering recommendations"""
        # Build matrix
        self.build_user_item_matrix(students, events)
        
        # Find similar users
        similar_users = self.find_similar_users(student.id, students)
        if not similar_users:
            return []
        
        # Get recommendations from similar users
        event_scores = defaultdict(float)
        event_counts = defaultdict(int)
        
        for other_id, similarity in similar_users[:10]:
            other_vector = self.user_item_matrix.get(other_id, {})
            for event_id, score in other_vector.items():
                if score > 0:
                    # Weight by similarity
                    event_scores[event_id] += score * similarity
                    event_counts[event_id] += 1
        
        # Generate recommendations
        recommendations = []
        for event in events:
            score = event_scores.get(event.id, 0.0)
            count = event_counts.get(event.id, 0)
            
            if count > 0:
                avg_score = score / count
                # Boost by popularity
                event.popularity_score = min(1.0, avg_score * 1.2)
                
                recommendations.append(Recommendation(
                    event=event,
                    score=min(1.0, avg_score),
                    algorithm=RecommendationAlgorithm.COLLABORATIVE_FILTERING,
                    reason=f"Similar students liked this event",
                    confidence=min(1.0, count / 5.0),
                    metrics={'similar_users': len(similar_users)}
                ))
        
        recommendations.sort(key=lambda x: x.score, reverse=True)
        return recommendations[:top_n]

class HybridRecommender:
    """Hybrid recommendation combining multiple algorithms"""
    
    def __init__(self):
        self.content_based = ContentBasedRecommender()
        self.collaborative = CollaborativeFilteringRecommender()
        self.weights = {
            'content_based': 0.4,
            'collaborative': 0.4,
            'popularity': 0.2
        }
    
    def recommend(self, student: Student, students: List[Student], 
                  events: List[Event], top_n: int = 10, 
                  context: RecommendationContext = None) -> List[Recommendation]:
        """Generate hybrid recommendations"""
        # Get recommendations from different algorithms
        content_recs = self.content_based.recommend(student, events, top_n * 2)
        collab_recs = self.collaborative.recommend(student, students, events, top_n * 2)
        
        # Combine scores
        combined_scores = defaultdict(float)
        combined_reasons = defaultdict(list)
        
        for rec in content_recs:
            combined_scores[rec.event.id] += rec.score * self.weights['content_based']
            combined_reasons[rec.event.id].append(rec.reason)
        
        for rec in collab_recs:
            combined_scores[rec.event.id] += rec.score * self.weights['collaborative']
            combined_reasons[rec.event.id].append(rec.reason)
        
        # Add popularity boost
        for event in events:
            popularity_score = event.popularity_score or 0.0
            combined_scores[event.id] += popularity_score * self.weights['popularity']
            if popularity_score > 0.5:
                combined_reasons[event.id].append("Popular among students")
        
        # Apply context-aware filtering
        if context:
            self._apply_context_weights(combined_scores, events, context)
        
        # Generate final recommendations
        recommendations = []
        for event in events:
            score = combined_scores.get(event.id, 0.0)
            if score > 0:
                reason = " & ".join(combined_reasons.get(event.id, ["Matches your interests"])[:2])
                recommendations.append(Recommendation(
                    event=event,
                    score=min(1.0, score),
                    algorithm=RecommendationAlgorithm.HYBRID,
                    reason=reason,
                    confidence=min(1.0, score * 1.2)
                ))
        
        recommendations.sort(key=lambda x: x.score, reverse=True)
        return recommendations[:top_n]
    
    def _apply_context_weights(self, scores: Dict[str, float], 
                               events: List[Event], context: RecommendationContext):
        """Apply context-based weighting"""
        now = context.time
        
        for event in events:
            # Time-based weight
            days_until = (event.date - now).days
            if days_until < 0:
                # Past event
                scores[event.id] = scores.get(event.id, 0) * 0.1
            elif days_until <= 1:
                # Tomorrow or today - boost
                scores[event.id] = scores.get(event.id, 0) * 1.5
            elif days_until <= 7:
                # This week - slight boost
                scores[event.id] = scores.get(event.id, 0) * 1.2
            
            # Location-based weight
            if context.location and event.location:
                if event.location == context.location:
                    scores[event.id] = scores.get(event.id, 0) * 1.3

class PopularityRecommender:
    """Simple popularity-based recommender"""
    
    def recommend(self, events: List[Event], top_n: int = 10) -> List[Recommendation]:
        """Recommend most popular events"""
        recommendations = []
        
        for event in events:
            # Calculate popularity score
            if event.capacity > 0:
                fill_rate = event.registered_count / event.capacity
            else:
                fill_rate = 0.0
            
            popularity_score = (event.popularity_score or 0.0) * 0.5 + fill_rate * 0.3
            
            recommendations.append(Recommendation(
                event=event,
                score=popularity_score,
                algorithm=RecommendationAlgorithm.POPULARITY,
                reason="This event is popular among students",
                confidence=0.8
            ))
        
        recommendations.sort(key=lambda x: x.score, reverse=True)
        return recommendations[:top_n]

# ==================== Event Recommendation Engine ====================

class EventRecommendationEngine:
    """Main recommendation engine"""
    
    def __init__(self):
        self.students: Dict[str, Student] = {}
        self.events: Dict[str, Event] = {}
        self.interactions: List[EventInteraction] = []
        self.recommenders = {
            'content_based': ContentBasedRecommender(),
            'collaborative': CollaborativeFilteringRecommender(),
            'popularity': PopularityRecommender(),
            'hybrid': HybridRecommender()
        }
        self.feedback_history = defaultdict(list)
        self.performance_metrics = defaultdict(list)
        
    def add_student(self, student: Student) -> str:
        """Add a student to the system"""
        self.students[student.id] = student
        return student.id
    
    def add_event(self, event: Event) -> str:
        """Add an event to the system"""
        self.events[event.id] = event
        return event.id
    
    def add_interaction(self, interaction: EventInteraction):
        """Record a student-event interaction"""
        self.interactions.append(interaction)
        
        # Update student history
        if interaction.student_id in self.students:
            self.students[interaction.student_id].history.append(interaction)
        
        # Update event registration count
        if interaction.event_id in self.events:
            if interaction.interaction_type == 'register':
                self.events[interaction.event_id].registered_count += 1
            elif interaction.interaction_type == 'rate':
                event = self.events[interaction.event_id]
                event.rating = (event.rating + interaction.rating) / 2
    
    def get_recommendations(self, student_id: str, 
                           algorithms: List[RecommendationAlgorithm] = None,
                           top_n: int = 10,
                           context: RecommendationContext = None) -> List[Recommendation]:
        """Get event recommendations for a student"""
        if student_id not in self.students:
            return []
        
        student = self.students[student_id]
        
        # Get available events
        available_events = [e for e in self.events.values() if e.date > datetime.datetime.now()]
        
        if not available_events:
            return []
        
        # Default algorithms
        if algorithms is None:
            algorithms = [RecommendationAlgorithm.HYBRID]
        
        all_recommendations = []
        
        for algo in algorithms:
            if algo == RecommendationAlgorithm.CONTENT_BASED:
                recs = self.recommenders['content_based'].recommend(
                    student, available_events, top_n
                )
            elif algo == RecommendationAlgorithm.COLLABORATIVE_FILTERING:
                recs = self.recommenders['collaborative'].recommend(
                    student, list(self.students.values()), available_events, top_n
                )
            elif algo == RecommendationAlgorithm.HYBRID:
                recs = self.recommenders['hybrid'].recommend(
                    student, list(self.students.values()), available_events, top_n, context
                )
            elif algo == RecommendationAlgorithm.POPULARITY:
                recs = self.recommenders['popularity'].recommend(available_events, top_n)
            elif algo == RecommendationAlgorithm.PERSONALIZED:
                recs = self._personalized_recommendations(student, available_events, top_n)
            elif algo == RecommendationAlgorithm.CONTEXT_AWARE:
                recs = self._context_aware_recommendations(student, available_events, context, top_n)
            else:
                continue
            
            all_recommendations.extend(recs)
        
        # Deduplicate and sort
        seen_events = set()
        unique_recs = []
        for rec in sorted(all_recommendations, key=lambda x: x.score, reverse=True):
            if rec.event.id not in seen_events:
                seen_events.add(rec.event.id)
                unique_recs.append(rec)
                if len(unique_recs) >= top_n:
                    break
        
        # Log recommendations
        self._log_recommendations(student_id, unique_recs)
        
        return unique_recs
    
    def _personalized_recommendations(self, student: Student, events: List[Event], 
                                      top_n: int) -> List[Recommendation]:
        """Generate personalized recommendations based on student profile"""
        recommendations = []
        
        # Get student interests
        interests = student.interests
        
        # Score events
        for event in events:
            score = 0.0
            
            # Category match
            category_score = interests.get(event.category.value, 0.0)
            score += category_score * 0.4
            
            # Tag match
            tag_score = 0.0
            for tag in event.tags:
                if tag in interests:
                    tag_score += interests[tag]
            tag_score = min(1.0, tag_score / max(1, len(event.tags)))
            score += tag_score * 0.3
            
            # Time preference
            if event.date.weekday() >= 5:  # Weekend
                score += 0.1
            if 18 <= event.date.hour <= 21:  # Evening
                score += 0.1
            
            # Department match
            if event.organizer.lower() == student.department.lower():
                score += 0.2
            
            recommendations.append(Recommendation(
                event=event,
                score=min(1.0, score),
                algorithm=RecommendationAlgorithm.PERSONALIZED,
                reason=f"Matches your interests in {event.category.value}",
                confidence=0.7
            ))
        
        recommendations.sort(key=lambda x: x.score, reverse=True)
        return recommendations[:top_n]
    
    def _context_aware_recommendations(self, student: Student, events: List[Event],
                                      context: RecommendationContext, top_n: int) -> List[Recommendation]:
        """Generate context-aware recommendations"""
        if not context:
            return self._personalized_recommendations(student, events, top_n)
        
        recommendations = []
        
        for event in events:
            score = 0.0
            
            # Time context
            days_until = (event.date - context.time).days
            if days_until <= 1:
                score += 0.3
            elif days_until <= 3:
                score += 0.2
            
            # Location context
            if context.location and event.location == context.location:
                score += 0.2
            
            # Weather context
            if context.weather == 'rainy' and 'indoor' in event.tags:
                score += 0.2
            elif context.weather == 'sunny' and 'outdoor' in event.tags:
                score += 0.2
            
            # Day context
            if context.day_of_week == 6:  # Sunday
                if event.category == EventCategory.WELLNESS:
                    score += 0.2
            
            # Seasonal context
            if context.season == 'spring' and 'outdoor' in event.tags:
                score += 0.1
            
            recommendations.append(Recommendation(
                event=event,
                score=min(1.0, score),
                algorithm=RecommendationAlgorithm.CONTEXT_AWARE,
                reason=f"Perfect for {context.season} {context.weather} weather",
                confidence=0.6
            ))
        
        recommendations.sort(key=lambda x: x.score, reverse=True)
        return recommendations[:top_n]
    
    def _log_recommendations(self, student_id: str, recommendations: List[Recommendation]):
        """Log recommendations for analysis"""
        self.feedback_history[student_id].append({
            'timestamp': datetime.datetime.now(),
            'recommendations': [r.event.id for r in recommendations[:5]],
            'count': len(recommendations)
        })
    
    def get_feedback(self, student_id: str, event_id: str, feedback: str, rating: float = 0):
        """Collect feedback on recommendations"""
        if student_id not in self.feedback_history:
            return
        
        self.feedback_history[student_id].append({
            'timestamp': datetime.datetime.now(),
            'event_id': event_id,
            'feedback': feedback,
            'rating': rating
        })
        
        # Update event rating
        if event_id in self.events:
            event = self.events[event_id]
            if rating > 0:
                event.rating = (event.rating * event.registered_count + rating) / (event.registered_count + 1)
    
    def get_event_similarity(self, event_id1: str, event_id2: str) -> float:
        """Compute similarity between two events"""
        event1 = self.events.get(event_id1)
        event2 = self.events.get(event_id2)
        
        if not event1 or not event2:
            return 0.0
        
        # Compare categories
        category_sim = 1.0 if event1.category == event2.category else 0.0
        
        # Compare tags
        common_tags = set(event1.tags) & set(event2.tags)
        tag_sim = len(common_tags) / max(len(event1.tags), len(event2.tags)) if event1.tags or event2.tags else 0.0
        
        # Compare time
        time_diff = abs((event1.date - event2.date).days)
        time_sim = max(0, 1 - time_diff / 30)
        
        return (category_sim * 0.4 + tag_sim * 0.4 + time_sim * 0.2)
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics for the system"""
        metrics = {
            'total_students': len(self.students),
            'total_events': len(self.events),
            'total_interactions': len(self.interactions),
            'recommendation_count': sum(len(h) for h in self.feedback_history.values()),
            'unique_students_recommended': len(self.feedback_history)
        }
        
        # Calculate average scores
        all_scores = []
        for history in self.feedback_history.values():
            for entry in history:
                if 'rating' in entry and entry['rating'] > 0:
                    all_scores.append(entry['rating'])
        
        if all_scores:
            metrics['avg_feedback_rating'] = sum(all_scores) / len(all_scores)
            metrics['feedback_count'] = len(all_scores)
        
        return metrics

# ==================== Data Generators ====================

class DataGenerator:
    """Generate synthetic data for testing"""
    
    @staticmethod
    def generate_students(count: int = 50) -> List[Student]:
        """Generate synthetic student data"""
        students = []
        departments = ['CS', 'Engineering', 'Business', 'Arts', 'Sciences', 'Math']
        interests_list = [
            {'academic': 0.8, 'social': 0.3, 'sports': 0.2, 'cultural': 0.4, 'career': 0.6},
            {'academic': 0.2, 'social': 0.7, 'sports': 0.5, 'cultural': 0.6, 'career': 0.3},
            {'academic': 0.4, 'social': 0.2, 'sports': 0.9, 'cultural': 0.3, 'career': 0.4},
            {'academic': 0.6, 'social': 0.4, 'sports': 0.3, 'cultural': 0.8, 'career': 0.5},
            {'academic': 0.9, 'social': 0.2, 'sports': 0.1, 'cultural': 0.3, 'career': 0.8},
        ]
        
        for i in range(count):
            interests = random.choice(interests_list)
            preferences = {
                'preferred_time': random.choice(['morning', 'afternoon', 'evening']),
                'preferred_location': random.choice(['campus', 'online', 'mixed']),
                'notification_preference': random.choice(['email', 'push', 'both'])
            }
            
            student = Student(
                id=f"S{10000 + i}",
                name=f"Student_{i+1}",
                department=random.choice(departments),
                year=random.randint(1, 4),
                interests=interests,
                preferences=preferences,
                history=[]
            )
            students.append(student)
        
        return students
    
    @staticmethod
    def generate_events(count: int = 30) -> List[Event]:
        """Generate synthetic event data"""
        events = []
        categories = list(EventCategory)
        titles = [
            "Tech Talk", "Hackathon", "Career Fair", "Sports Tournament",
            "Cultural Festival", "Workshop", "Seminar", "Conference",
            "Networking Mixer", "Movie Night", "Volunteer Day", "Wellness Session",
            "Guest Lecture", "Research Symposium", "Art Exhibition"
        ]
        locations = ['Main Hall', 'Student Center', 'Library', 'Sports Complex', 
                    'Auditorium', 'Conference Room', 'Outdoor Field']
        tags_pool = ['beginner', 'intermediate', 'advanced', 'fun', 'professional',
                     'technical', 'creative', 'leadership', 'teamwork', 'innovation',
                     'entrepreneurship', 'outdoor', 'indoor']
        
        for i in range(count):
            category = random.choice(categories)
            days_ahead = random.randint(1, 60)
            event_date = datetime.datetime.now() + datetime.timedelta(days=days_ahead)
            event_hour = random.randint(9, 21)
            event_date = event_date.replace(hour=event_hour, minute=0, second=0, microsecond=0)
            
            event = Event(
                id=f"E{1000 + i}",
                title=random.choice(titles) + f" {i+1}",
                description=f"Description for event {i+1}",
                category=category,
                date=event_date,
                location=random.choice(locations),
                organizer=f"Department_{random.randint(1, 5)}",
                capacity=random.randint(20, 200),
                registered_count=random.randint(0, 100),
                tags=random.sample(tags_pool, random.randint(2, 5)),
                popularity_score=random.random(),
                rating=random.uniform(3, 5)
            )
            events.append(event)
        
        return events
    
    @staticmethod
    def generate_interactions(students: List[Student], events: List[Event], 
                             count: int = 200) -> List[EventInteraction]:
        """Generate synthetic interactions"""
        interactions = []
        interaction_types = ['view', 'view', 'view', 'register', 'attend', 'favorite']
        
        for _ in range(count):
            student = random.choice(students)
            event = random.choice(events)
            interaction_type = random.choice(interaction_types)
            
            # Generate timestamp
            time_offset = random.randint(-10, 10)
            timestamp = datetime.datetime.now() + datetime.timedelta(days=time_offset)
            
            interaction = EventInteraction(
                student_id=student.id,
                event_id=event.id,
                interaction_type=interaction_type,
                timestamp=timestamp,
                rating=random.uniform(3, 5) if interaction_type == 'rate' else 0.0,
                feedback=random.choice(['great', 'good', 'okay', 'excellent']) if random.random() > 0.7 else ""
            )
            interactions.append(interaction)
        
        return interactions

# ==================== CLI Application ====================

class EventRecommendationCLI:
    """Command-line interface for event recommendation engine"""
    
    def __init__(self):
        self.engine = EventRecommendationEngine()
        self.current_student = None
        self.students = []
        self.events = []
        self.generator = DataGenerator()
        
    def run(self):
        """Main application loop"""
        print("\n" + "=" * 60)
        print("🎯 EVENT RECOMMENDATION ENGINE".center(60))
        print("=" * 60)
        
        # Initialize with sample data
        self._initialize_data()
        
        while True:
            print("\n📋 MENU")
            print("-" * 40)
            print("1. 👤 Select Student")
            print("2. 🎯 Get Recommendations")
            print("3. 📊 View Student Profile")
            print("4. 📅 View Events")
            print("5. 📝 Record Interaction")
            print("6. 📈 View Analytics")
            print("7. 🔄 Generate New Data")
            print("8. 🚪 Exit")
            
            if self.current_student:
                print(f"\n👤 Current Student: {self.current_student.name} ({self.current_student.id})")
            
            choice = input("\nSelect option: ").strip()
            
            if choice == "1":
                self._select_student()
            elif choice == "2":
                self._get_recommendations()
            elif choice == "3":
                self._view_profile()
            elif choice == "4":
                self._view_events()
            elif choice == "5":
                self._record_interaction()
            elif choice == "6":
                self._view_analytics()
            elif choice == "7":
                self._generate_data()
            elif choice == "8":
                print("\n👋 Goodbye! Enjoy your events!")
                break
            else:
                print("❌ Invalid option")
    
    def _initialize_data(self):
        """Initialize with sample data"""
        print("\n📊 Initializing with sample data...")
        
        self.students = self.generator.generate_students(30)
        self.events = self.generator.generate_events(20)
        interactions = self.generator.generate_interactions(self.students, self.events, 150)
        
        # Load into engine
        for student in self.students:
            self.engine.add_student(student)
        
        for event in self.events:
            self.engine.add_event(event)
        
        for interaction in interactions:
            self.engine.add_interaction(interaction)
        
        print(f"✅ Loaded {len(self.students)} students, {len(self.events)} events, {len(interactions)} interactions")
        
        # Set default student
        self.current_student = self.students[0]
        print(f"👤 Default student: {self.current_student.name}")
    
    def _select_student(self):
        """Select a student"""
        print("\n👤 SELECT STUDENT")
        print("-" * 40)
        
        for i, student in enumerate(self.students[:10]):
            print(f"{i+1}. {student.name} ({student.id}) - {student.department}")
        
        if len(self.students) > 10:
            print(f"... and {len(self.students) - 10} more")
        
        choice = input("\nEnter student number (or 'new' for new student): ").strip()
        
        if choice.lower() == 'new':
            self._create_student()
        elif choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(self.students):
                self.current_student = self.students[idx]
                print(f"✅ Selected: {self.current_student.name}")
            else:
                print("❌ Invalid selection")
        else:
            print("❌ Invalid input")
    
    def _create_student(self):
        """Create a new student"""
        print("\n👤 CREATE NEW STUDENT")
        name = input("Name: ").strip()
        department = input("Department (CS, Engineering, Business, Arts, Sciences, Math): ").strip() or "CS"
        year = int(input("Year (1-4): ").strip() or 1)
        
        student = Student(
            id=f"S{random.randint(10000, 99999)}",
            name=name,
            department=department,
            year=year,
            interests={
                'academic': float(input("Academic interest (0-1): ").strip() or 0.5),
                'social': float(input("Social interest (0-1): ").strip() or 0.5),
                'sports': float(input("Sports interest (0-1): ").strip() or 0.5),
                'cultural': float(input("Cultural interest (0-1): ").strip() or 0.5),
                'career': float(input("Career interest (0-1): ").strip() or 0.5)
            },
            preferences={},
            history=[]
        )
        
        self.engine.add_student(student)
        self.students.append(student)
        self.current_student = student
        print(f"✅ Student created: {student.name} ({student.id})")
    
    def _get_recommendations(self):
        """Get recommendations for current student"""
        if not self.current_student:
            print("❌ No student selected")
            return
        
        print("\n🎯 GET RECOMMENDATIONS")
        print("-" * 40)
        print(f"Student: {self.current_student.name}")
        
        # Algorithm selection
        print("\nSelect algorithm:")
        print("1. Hybrid (Recommended)")
        print("2. Content-based")
        print("3. Collaborative Filtering")
        print("4. Popularity-based")
        print("5. Personalized")
        print("6. Context-aware")
        
        algo_choice = input("\nSelect (1-6): ").strip()
        algo_map = {
            '1': [RecommendationAlgorithm.HYBRID],
            '2': [RecommendationAlgorithm.CONTENT_BASED],
            '3': [RecommendationAlgorithm.COLLABORATIVE_FILTERING],
            '4': [RecommendationAlgorithm.POPULARITY],
            '5': [RecommendationAlgorithm.PERSONALIZED],
            '6': [RecommendationAlgorithm.CONTEXT_AWARE]
        }
        algorithms = algo_map.get(algo_choice, [RecommendationAlgorithm.HYBRID])
        
        # Get context (optional)
        context = None
        use_context = input("\nUse context-aware filtering? (y/n): ").strip().lower() == 'y'
        if use_context:
            context = RecommendationContext(
                time=datetime.datetime.now(),
                location=input("Location: ").strip() or "campus",
                weather=input("Weather: ").strip() or "sunny",
                season=input("Season: ").strip() or "spring",
                day_of_week=datetime.datetime.now().weekday(),
                upcoming_holidays=[],
                current_events=[]
            )
        
        # Get recommendations
        top_n = int(input("Number of recommendations: ").strip() or 5)
        recommendations = self.engine.get_recommendations(
            self.current_student.id,
            algorithms,
            top_n,
            context
        )
        
        if not recommendations:
            print("❌ No recommendations available")
            return
        
        print("\n📊 RECOMMENDATIONS")
        print("-" * 40)
        
        for i, rec in enumerate(recommendations, 1):
            event = rec.event
            print(f"\n{i}. {event.title}")
            print(f"   📍 {event.location} | 📅 {event.date.strftime('%Y-%m-%d %H:%M')}")
            print(f"   🏷️ {event.category.value}")
            print(f"   📊 Score: {rec.score:.2%} | Confidence: {rec.confidence:.2%}")
            print(f"   💡 Reason: {rec.reason}")
            print(f"   👥 {event.registered_count}/{event.capacity} registered")
            
            if i < len(recommendations):
                print(f"   🔍 Algorithm: {rec.algorithm.value}")
        
        # Feedback
        provide_feedback = input("\nWould you like to provide feedback? (y/n): ").strip().lower() == 'y'
        if provide_feedback:
            event_idx = int(input("Event number: ").strip()) - 1
            if 0 <= event_idx < len(recommendations):
                rating = float(input("Rating (1-5): ").strip() or 3)
                feedback = input("Feedback (optional): ").strip()
                self.engine.get_feedback(
                    self.current_student.id,
                    recommendations[event_idx].event.id,
                    feedback,
                    rating
                )
                print("✅ Feedback recorded!")
    
    def _view_profile(self):
        """View student profile"""
        if not self.current_student:
            print("❌ No student selected")
            return
        
        student = self.current_student
        
        print("\n👤 STUDENT PROFILE")
        print("-" * 40)
        print(f"Name: {student.name}")
        print(f"ID: {student.id}")
        print(f"Department: {student.department}")
        print(f"Year: {student.year}")
        print(f"Created: {student.created_at.strftime('%Y-%m-%d %H:%M')}")
        
        print("\n🎯 Interests:")
        for interest, score in student.interests.items():
            bar = "█" * int(score * 20)
            print(f"  • {interest}: {bar} {score:.0%}")
        
        print("\n📊 History:")
        if student.history:
            recent = student.history[-5:]
            for interaction in recent:
                event = self.engine.events.get(interaction.event_id)
                event_name = event.title if event else "Unknown"
                print(f"  • {interaction.interaction_type} - {event_name} ({interaction.timestamp.strftime('%Y-%m-%d')})")
        else:
            print("  • No interactions yet")
    
    def _view_events(self):
        """View all events"""
        print("\n📅 EVENTS")
        print("-" * 40)
        
        if not self.events:
            print("No events available")
            return
        
        # Sort by date
        sorted_events = sorted(self.events, key=lambda x: x.date)
        
        for i, event in enumerate(sorted_events[:15], 1):
            print(f"\n{i}. {event.title}")
            print(f"   📍 {event.location} | 📅 {event.date.strftime('%Y-%m-%d %H:%M')}")
            print(f"   🏷️ {event.category.value}")
            print(f"   👥 {event.registered_count}/{event.capacity} registered")
            print(f"   ⭐ Rating: {event.rating:.1f}/5.0")
        
        if len(sorted_events) > 15:
            print(f"\n... and {len(sorted_events) - 15} more events")
    
    def _record_interaction(self):
        """Record a student-event interaction"""
        if not self.current_student:
            print("❌ No student selected")
            return
        
        print("\n📝 RECORD INTERACTION")
        print("-" * 40)
        
        print("\nAvailable events:")
        for i, event in enumerate(self.events[:10], 1):
            print(f"{i}. {event.title} ({event.date.strftime('%Y-%m-%d')})")
        
        event_idx = int(input("Select event number: ").strip()) - 1
        if 0 <= event_idx < len(self.events):
            event = self.events[event_idx]
            
            print("\nInteraction types:")
            print("1. View")
            print("2. Register")
            print("3. Attend")
            print("4. Favorite")
            print("5. Rate")
            
            type_idx = int(input("Select type (1-5): ").strip()) - 1
            types = ['view', 'register', 'attend', 'favorite', 'rate']
            
            if 0 <= type_idx < len(types):
                interaction_type = types[type_idx]
                rating = 0.0
                if interaction_type == 'rate':
                    rating = float(input("Rating (1-5): ").strip() or 3)
                
                interaction = EventInteraction(
                    student_id=self.current_student.id,
                    event_id=event.id,
                    interaction_type=interaction_type,
                    timestamp=datetime.datetime.now(),
                    rating=rating
                )
                
                self.engine.add_interaction(interaction)
                print(f"✅ Interaction recorded: {interaction_type} - {event.title}")
            else:
                print("❌ Invalid type")
        else:
            print("❌ Invalid event")
    
    def _view_analytics(self):
        """View system analytics"""
        print("\n📈 SYSTEM ANALYTICS")
        print("-" * 40)
        
        metrics = self.engine.get_performance_metrics()
        
        print("\n📊 System Statistics:")
        print(f"  • Total Students: {metrics['total_students']}")
        print(f"  • Total Events: {metrics['total_events']}")
        print(f"  • Total Interactions: {metrics['total_interactions']}")
        print(f"  • Total Recommendations: {metrics['recommendation_count']}")
        print(f"  • Students with Recommendations: {metrics['unique_students_recommended']}")
        
        if 'avg_feedback_rating' in metrics:
            print(f"\n📝 Feedback Metrics:")
            print(f"  • Average Rating: {metrics['avg_feedback_rating']:.2f}/5.0")
            print(f"  • Total Feedback: {metrics['feedback_count']}")
        
        # Algorithm performance
        print("\n🎯 Algorithm Performance:")
        print("  • Content-Based: Good for cold start")
        print("  • Collaborative: Best with rich data")
        print("  • Hybrid: Optimal balance")
        print("  • Popularity: Warm-up recommendations")
        print("  • Personalized: Tailored to individual")
        print("  • Context-Aware: Adaptive to conditions")
    
    def _generate_data(self):
        """Generate new data"""
        print("\n🔄 GENERATE NEW DATA")
        print("-" * 40)
        
        student_count = int(input("Number of students: ").strip() or 30)
        event_count = int(input("Number of events: ").strip() or 20)
        interaction_count = int(input("Number of interactions: ").strip() or 150)
        
        # Generate new data
        students = self.generator.generate_students(student_count)
        events = self.generator.generate_events(event_count)
        interactions = self.generator.generate_interactions(students, events, interaction_count)
        
        # Add to system
        for student in students:
            self.engine.add_student(student)
        for event in events:
            self.engine.add_event(event)
        for interaction in interactions:
            self.engine.add_interaction(interaction)
        
        # Update local lists
        self.students = list(self.engine.students.values())
        self.events = list(self.engine.events.values())
        
        print(f"✅ Generated and loaded: {len(students)} students, {len(events)} events, {len(interactions)} interactions")
        print(f"📊 Total system: {len(self.engine.students)} students, {len(self.engine.events)} events")

# ==================== Main Execution ====================

def main():
    """Main function"""
    cli = EventRecommendationCLI()
    
    try:
        cli.run()
    except KeyboardInterrupt:
        print("\n\n👋 Goodbye! Enjoy your campus events!")
    except Exception as e:
        print(f"\n❌ An error occurred: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
