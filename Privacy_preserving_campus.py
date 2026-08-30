"""
Privacy-Preserving Campus Analytics System
A comprehensive system for analyzing campus data while protecting individual privacy
"""

import json
import datetime
import hashlib
import random
import math
from typing import Dict, List, Set, Tuple, Optional, Any, Union
from dataclasses import dataclass, asdict
from collections import defaultdict, Counter
from enum import Enum
import base64
import time
import secrets
from abc import ABC, abstractmethod

# ==================== Privacy Core ====================

class PrivacyLevel(Enum):
    """Privacy protection levels"""
    NONE = 0
    ANONYMIZED = 1
    PSEUDONYMIZED = 2
    DIFFERENTIALLY_PRIVATE = 3
    FULLY_PRIVATE = 4

class DataCategory(Enum):
    """Categories of sensitive data"""
    PERSONAL = "personal"
    ACADEMIC = "academic"
    BEHAVIORAL = "behavioral"
    LOCATION = "location"
    FINANCIAL = "financial"
    HEALTH = "health"
    DEMOGRAPHIC = "demographic"

@dataclass
class PrivacyConfig:
    """Configuration for privacy settings"""
    level: PrivacyLevel
    epsilon: float = 0.1  # For differential privacy
    delta: float = 0.01
    anonymization_method: str = "k_anonymity"
    k_value: int = 5
    l_diversity: int = 3
    t_closeness: float = 0.1

@dataclass
class PrivacyMetadata:
    """Metadata about privacy protection applied"""
    privacy_level: PrivacyLevel
    applied_methods: List[str]
    timestamp: datetime.datetime
    data_hash: str
    processing_log: List[str]

# ==================== Differential Privacy Engine ====================

class DifferentialPrivacyEngine:
    """Implements differential privacy mechanisms"""
    
    def __init__(self, epsilon: float = 0.1, delta: float = 0.01):
        self.epsilon = epsilon
        self.delta = delta
        self.sensitivity = 1.0
        
    def add_laplace_noise(self, value: float, sensitivity: float = None) -> float:
        """Add Laplace noise for differential privacy"""
        if sensitivity is None:
            sensitivity = self.sensitivity
        
        scale = sensitivity / self.epsilon
        noise = random.laplacevariate(0, scale)
        return value + noise
    
    def add_gaussian_noise(self, value: float, sensitivity: float = None) -> float:
        """Add Gaussian noise for differential privacy"""
        if sensitivity is None:
            sensitivity = self.sensitivity
        
        sigma = sensitivity * math.sqrt(2 * math.log(1.25 / self.delta)) / self.epsilon
        noise = random.gauss(0, sigma)
        return value + noise
    
    def add_exponential_noise(self, value: float, sensitivity: float = None) -> float:
        """Add exponential noise for differential privacy"""
        if sensitivity is None:
            sensitivity = self.sensitivity
        
        scale = sensitivity / self.epsilon
        noise = random.expovariate(1/scale) if random.random() > 0.5 else -random.expovariate(1/scale)
        return value + noise
    
    def private_count(self, count: int) -> int:
        """Return differentially private count"""
        noisy_count = self.add_laplace_noise(count)
        return max(0, int(round(noisy_count)))
    
    def private_sum(self, values: List[float]) -> float:
        """Return differentially private sum"""
        true_sum = sum(values)
        noisy_sum = self.add_gaussian_noise(true_sum, self.sensitivity)
        return max(0, noisy_sum)
    
    def private_mean(self, values: List[float]) -> float:
        """Return differentially private mean"""
        if not values:
            return 0.0
        
        true_mean = sum(values) / len(values)
        noisy_mean = self.add_laplace_noise(true_mean, self.sensitivity / len(values))
        return max(0, noisy_mean)
    
    def private_histogram(self, data: List[Any], bins: List[Any]) -> Dict[Any, int]:
        """Create differentially private histogram"""
        histogram = Counter(data)
        private_hist = {}
        
        for bin_value in bins:
            count = histogram.get(bin_value, 0)
            private_hist[bin_value] = self.private_count(count)
        
        return private_hist
    
    def private_quantile(self, data: List[float], q: float) -> float:
        """Return differentially private quantile"""
        if not data:
            return 0.0
        
        sorted_data = sorted(data)
        index = int(q * len(sorted_data))
        
        if index >= len(sorted_data):
            index = len(sorted_data) - 1
        
        true_quantile = sorted_data[index]
        return self.add_laplace_noise(true_quantile, self.sensitivity)

# ==================== Anonymization Engine ====================

class AnonymizationEngine:
    """Implements various anonymization techniques"""
    
    def __init__(self):
        self.pseudonym_map = {}
        self.salt = secrets.token_hex(16)
    
    def k_anonymize(self, data: List[Dict], quasi_identifiers: List[str], k: int = 5) -> List[Dict]:
        """Apply k-anonymity to dataset"""
        if len(data) < k:
            return data
        
        # Group by quasi-identifiers
        groups = defaultdict(list)
        for record in data:
            key = tuple(record.get(qi, '') for qi in quasi_identifiers)
            groups[key].append(record)
        
        # Generalize groups with less than k records
        anonymized_data = []
        for group_key, group_records in groups.items():
            if len(group_records) < k:
                # Generalize quasi-identifiers
                generalized_record = self._generalize_records(group_records, quasi_identifiers)
                anonymized_data.extend([generalized_record] * len(group_records))
            else:
                anonymized_data.extend(group_records)
        
        return anonymized_data
    
    def _generalize_records(self, records: List[Dict], quasi_identifiers: List[str]) -> Dict:
        """Generalize records to achieve k-anonymity"""
        if not records:
            return {}
        
        generalized = records[0].copy()
        
        for qi in quasi_identifiers:
            values = [r.get(qi, '') for r in records]
            
            # Check if all values are the same
            if len(set(values)) == 1:
                continue
            
            # Generalize based on data type
            if all(isinstance(v, (int, float)) for v in values if v):
                # Numeric: use range
                min_val = min(v for v in values if v)
                max_val = max(v for v in values if v)
                generalized[qi] = f"[{min_val}-{max_val}]"
            else:
                # Categorical: use common prefix
                common_prefix = self._common_prefix([str(v) for v in values if v])
                if common_prefix:
                    generalized[qi] = common_prefix + "*"
                else:
                    generalized[qi] = "***"
        
        return generalized
    
    def _common_prefix(self, strings: List[str]) -> str:
        """Find common prefix of strings"""
        if not strings:
            return ""
        
        shortest = min(strings, key=len)
        for i, char in enumerate(shortest):
            for string in strings:
                if i >= len(string) or string[i] != char:
                    return shortest[:i]
        return shortest
    
    def l_diversity(self, data: List[Dict], sensitive_attr: str, l: int = 3) -> List[Dict]:
        """Apply l-diversity to dataset"""
        # Group by quasi-identifiers
        groups = defaultdict(list)
        for record in data:
            key = tuple(record.get(k, '') for k in self._get_quasi_identifiers(record))
            groups[key].append(record)
        
        # Filter groups that don't have l distinct sensitive values
        diversified_data = []
        for group_key, group_records in groups.items():
            sensitive_values = [r.get(sensitive_attr) for r in group_records if r.get(sensitive_attr)]
            
            if len(set(sensitive_values)) >= l:
                diversified_data.extend(group_records)
            else:
                # Suppress or generalize
                for record in group_records:
                    record[sensitive_attr] = "***"
                    diversified_data.append(record)
        
        return diversified_data
    
    def _get_quasi_identifiers(self, record: Dict) -> List[str]:
        """Identify quasi-identifiers in record"""
        # In practice, this would be specified or inferred
        default_qis = ['age', 'gender', 'location', 'major', 'year']
        return [k for k in default_qis if k in record]
    
    def pseudonymize(self, data: Dict, fields: List[str]) -> Dict:
        """Replace identifying fields with pseudonyms"""
        pseudonymized = data.copy()
        
        for field in fields:
            if field in pseudonymized:
                original_value = pseudonymized[field]
                pseudonymized[field] = self._get_pseudonym(original_value, field)
        
        return pseudonymized
    
    def _get_pseudonym(self, value: str, field: str) -> str:
        """Get or create pseudonym for a value"""
        key = f"{field}:{value}:{self.salt}"
        hash_val = hashlib.sha256(key.encode()).hexdigest()
        return f"PS_{hash_val[:12]}"
    
    def tokenize(self, data: str) -> str:
        """Tokenize sensitive data"""
        token = hashlib.blake2b(data.encode(), salt=self.salt.encode(), digest_size=16).hexdigest()
        return f"TK_{token}"
    
    def mask_data(self, data: str, visible_chars: int = 0) -> str:
        """Mask sensitive data"""
        if len(data) <= visible_chars:
            return data
        
        return data[:visible_chars] + "*" * (len(data) - visible_chars)

# ==================== Privacy-Preserving Analytics ====================

@dataclass
class PrivateStatistic:
    """Container for privacy-preserving statistics"""
    name: str
    value: Any
    privacy_level: PrivacyLevel
    confidence_interval: Optional[Tuple[float, float]] = None
    metadata: Optional[Dict] = None

class PrivacyPreservingAnalytics:
    """Main analytics engine with privacy protection"""
    
    def __init__(self, config: PrivacyConfig = None):
        if config is None:
            config = PrivacyConfig(
                level=PrivacyLevel.DIFFERENTIALLY_PRIVATE,
                epsilon=0.1,
                k_value=5
            )
        
        self.config = config
        self.dp_engine = DifferentialPrivacyEngine(config.epsilon, config.delta)
        self.anonymization_engine = AnonymizationEngine()
        self.private_data_store = {}
        self.analytics_cache = {}
    
    def process_data(self, data: List[Dict], metadata: Dict = None) -> PrivacyMetadata:
        """Process data with privacy protection"""
        applied_methods = []
        processing_log = []
        
        # Apply privacy based on level
        if self.config.level == PrivacyLevel.ANONYMIZED:
            data = self.anonymization_engine.k_anonymize(
                data, 
                ['age', 'gender', 'major'], 
                self.config.k_value
            )
            applied_methods.append("k_anonymity")
            processing_log.append(f"Applied k-anonymity with k={self.config.k_value}")
        
        elif self.config.level == PrivacyLevel.PSEUDONYMIZED:
            for record in data:
                self.anonymization_engine.pseudonymize(record, ['student_id', 'email', 'name'])
            applied_methods.append("pseudonymization")
            processing_log.append("Applied pseudonymization to identifiers")
        
        elif self.config.level == PrivacyLevel.DIFFERENTIALLY_PRIVATE:
            # Data is processed with differential privacy during analytics
            applied_methods.append("differential_privacy")
            processing_log.append(f"Applied differential privacy with epsilon={self.config.epsilon}")
        
        elif self.config.level == PrivacyLevel.FULLY_PRIVATE:
            # Maximum privacy - only aggregated statistics allowed
            applied_methods.append("fully_private")
            processing_log.append("Applied full privacy - only aggregated data available")
        
        # Generate hash for audit
        data_hash = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
        
        # Store private data
        self.private_data_store['processed_data'] = data
        self.private_data_store['hash'] = data_hash
        self.private_data_store['timestamp'] = datetime.datetime.now()
        
        return PrivacyMetadata(
            privacy_level=self.config.level,
            applied_methods=applied_methods,
            timestamp=datetime.datetime.now(),
            data_hash=data_hash,
            processing_log=processing_log
        )
    
    def get_aggregate_statistics(self, data: List[Dict]) -> Dict[str, PrivateStatistic]:
        """Get aggregate statistics with privacy protection"""
        if not data:
            return {}
        
        stats = {}
        
        # Calculate various statistics with privacy
        if self.config.level == PrivacyLevel.DIFFERENTIALLY_PRIVATE:
            stats['total_students'] = PrivateStatistic(
                name="total_students",
                value=self.dp_engine.private_count(len(data)),
                privacy_level=PrivacyLevel.DIFFERENTIALLY_PRIVATE,
                confidence_interval=(len(data) - 5, len(data) + 5)
            )
            
            # Grade statistics
            grades = [r.get('gpa', 0) for r in data if r.get('gpa')]
            if grades:
                stats['average_gpa'] = PrivateStatistic(
                    name="average_gpa",
                    value=self.dp_engine.private_mean(grades),
                    privacy_level=PrivacyLevel.DIFFERENTIALLY_PRIVATE,
                    confidence_interval=(
                        self.dp_engine.private_mean(grades) - 0.1,
                        self.dp_engine.private_mean(grades) + 0.1
                    )
                )
            
            # Age statistics
            ages = [r.get('age', 0) for r in data if r.get('age')]
            if ages:
                stats['average_age'] = PrivateStatistic(
                    name="average_age",
                    value=self.dp_engine.private_mean(ages),
                    privacy_level=PrivacyLevel.DIFFERENTIALLY_PRIVATE,
                    confidence_interval=(
                        self.dp_engine.private_mean(ages) - 1,
                        self.dp_engine.private_mean(ages) + 1
                    )
                )
                
                stats['age_histogram'] = PrivateStatistic(
                    name="age_histogram",
                    value=self.dp_engine.private_histogram(ages, list(range(18, 30))),
                    privacy_level=PrivacyLevel.DIFFERENTIALLY_PRIVATE
                )
        
        elif self.config.level == PrivacyLevel.ANONYMIZED:
            stats['total_students'] = PrivateStatistic(
                name="total_students",
                value=len(data),
                privacy_level=PrivacyLevel.ANONYMIZED
            )
            
            grades = [r.get('gpa', 0) for r in data if r.get('gpa')]
            if grades:
                stats['average_gpa'] = PrivateStatistic(
                    name="average_gpa",
                    value=sum(grades) / len(grades),
                    privacy_level=PrivacyLevel.ANONYMIZED
                )
        
        else:
            # No privacy or pseudonymized - full statistics
            stats['total_students'] = PrivateStatistic(
                name="total_students",
                value=len(data),
                privacy_level=self.config.level
            )
        
        return stats
    
    def get_trend_analysis(self, data: List[Dict], key: str, time_key: str = 'timestamp') -> Dict:
        """Analyze trends with privacy protection"""
        if not data:
            return {}
        
        # Group by time periods
        periods = defaultdict(list)
        for record in data:
            if time_key in record:
                period = record[time_key][:10] if len(str(record[time_key])) >= 10 else str(record[time_key])
                if key in record:
                    periods[period].append(record[key])
        
        # Apply privacy protection to trends
        trends = {}
        for period, values in sorted(periods.items()):
            if self.config.level == PrivacyLevel.DIFFERENTIALLY_PRIVATE:
                if values:
                    avg = self.dp_engine.private_mean(values)
                    count = self.dp_engine.private_count(len(values))
                    trends[period] = {
                        'average': avg,
                        'count': count,
                        'privacy_applied': True
                    }
            else:
                if values:
                    trends[period] = {
                        'average': sum(values) / len(values),
                        'count': len(values),
                        'privacy_applied': False
                    }
        
        return trends
    
    def get_correlation_analysis(self, data: List[Dict], key1: str, key2: str) -> Dict:
        """Analyze correlation with privacy protection"""
        if not data:
            return {}
        
        pairs = [(r.get(key1, 0), r.get(key2, 0)) for r in data if key1 in r and key2 in r]
        if len(pairs) < 2:
            return {}
        
        # Calculate Pearson correlation with privacy
        x_values = [p[0] for p in pairs]
        y_values = [p[1] for p in pairs]
        
        if self.config.level == PrivacyLevel.DIFFERENTIALLY_PRIVATE:
            # Add noise to values before correlation
            noisy_x = [self.dp_engine.add_laplace_noise(x) for x in x_values]
            noisy_y = [self.dp_engine.add_laplace_noise(y) for y in y_values]
            
            correlation = self._pearson_correlation(noisy_x, noisy_y)
            
            return {
                'correlation': correlation,
                'sample_size': self.dp_engine.private_count(len(pairs)),
                'privacy_applied': True,
                'confidence_interval': (correlation - 0.1, correlation + 0.1)
            }
        else:
            correlation = self._pearson_correlation(x_values, y_values)
            return {
                'correlation': correlation,
                'sample_size': len(pairs),
                'privacy_applied': False
            }
    
    def _pearson_correlation(self, x: List[float], y: List[float]) -> float:
        """Calculate Pearson correlation coefficient"""
        if len(x) != len(y) or len(x) < 2:
            return 0.0
        
        n = len(x)
        sum_x = sum(x)
        sum_y = sum(y)
        sum_xy = sum(a * b for a, b in zip(x, y))
        sum_x2 = sum(a * a for a in x)
        sum_y2 = sum(b * b for b in y)
        
        numerator = n * sum_xy - sum_x * sum_y
        denominator = math.sqrt((n * sum_x2 - sum_x * sum_x) * (n * sum_y2 - sum_y * sum_y))
        
        if denominator == 0:
            return 0.0
        
        return numerator / denominator
    
    def get_anomaly_detection(self, data: List[Dict], metric_key: str, threshold: float = 2.0) -> List[Dict]:
        """Detect anomalies with privacy protection"""
        if not data:
            return []
        
        values = [r.get(metric_key, 0) for r in data if metric_key in r]
        if not values:
            return []
        
        # Calculate mean and std with privacy
        if self.config.level == PrivacyLevel.DIFFERENTIALLY_PRIVATE:
            mean = self.dp_engine.private_mean(values)
            std = self.dp_engine.add_laplace_noise(self._std_dev(values))
            threshold = self.dp_engine.add_laplace_noise(threshold)
        else:
            mean = sum(values) / len(values)
            std = self._std_dev(values)
        
        # Detect anomalies
        anomalies = []
        for record in data:
            if metric_key in record:
                value = record[metric_key]
                z_score = (value - mean) / std if std > 0 else 0
                
                if abs(z_score) > threshold:
                    anomalies.append({
                        'record': self._sanitize_record(record),
                        'metric_value': value,
                        'z_score': z_score,
                        'anomaly_level': 'high' if abs(z_score) > threshold * 1.5 else 'medium'
                    })
        
        return anomalies
    
    def _std_dev(self, values: List[float]) -> float:
        """Calculate standard deviation"""
        if not values:
            return 0.0
        
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        return math.sqrt(variance)
    
    def _sanitize_record(self, record: Dict) -> Dict:
        """Sanitize record for display"""
        sanitized = record.copy()
        sensitive_fields = ['name', 'email', 'student_id', 'phone', 'address']
        
        for field in sensitive_fields:
            if field in sanitized:
                sanitized[field] = "***"
        
        return sanitized

# ==================== Campus Analytics Modules ====================

class CampusPrivacyAnalytics:
    """Comprehensive campus analytics with privacy preservation"""
    
    def __init__(self, config: PrivacyConfig = None):
        self.config = config or PrivacyConfig(level=PrivacyLevel.DIFFERENTIALLY_PRIVATE)
        self.analytics_engine = PrivacyPreservingAnalytics(self.config)
        self.dp_engine = DifferentialPrivacyEngine(self.config.epsilon, self.config.delta)
        self.anonymization_engine = AnonymizationEngine()
        self.data_store = {}
        
    def load_student_data(self, students: List[Dict]) -> PrivacyMetadata:
        """Load and process student data"""
        return self.analytics_engine.process_data(students, {'source': 'student_records'})
    
    def analyze_performance(self, data: List[Dict]) -> Dict:
        """Analyze student performance with privacy"""
        if not data:
            return {}
        
        result = {
            'overall': {},
            'by_major': {},
            'by_year': {},
            'trends': {},
            'privacy_level': self.config.level.value
        }
        
        # Overall statistics
        stats = self.analytics_engine.get_aggregate_statistics(data)
        result['overall'] = {k: asdict(v) for k, v in stats.items()}
        
        # Performance by major
        majors = defaultdict(list)
        for record in data:
            if 'major' in record and 'gpa' in record:
                majors[record['major']].append(record['gpa'])
        
        for major, grades in majors.items():
            if self.config.level == PrivacyLevel.DIFFERENTIALLY_PRIVATE:
                avg = self.dp_engine.private_mean(grades)
                count = self.dp_engine.private_count(len(grades))
                result['by_major'][major] = {
                    'average_gpa': avg,
                    'student_count': count,
                    'privacy_applied': True
                }
            else:
                result['by_major'][major] = {
                    'average_gpa': sum(grades) / len(grades) if grades else 0,
                    'student_count': len(grades),
                    'privacy_applied': False
                }
        
        # Performance by year
        years = defaultdict(list)
        for record in data:
            if 'year' in record and 'gpa' in record:
                years[record['year']].append(record['gpa'])
        
        for year, grades in years.items():
            if self.config.level == PrivacyLevel.DIFFERENTIALLY_PRIVATE:
                avg = self.dp_engine.private_mean(grades)
                count = self.dp_engine.private_count(len(grades))
                result['by_year'][year] = {
                    'average_gpa': avg,
                    'student_count': count,
                    'privacy_applied': True
                }
            else:
                result['by_year'][year] = {
                    'average_gpa': sum(grades) / len(grades) if grades else 0,
                    'student_count': len(grades),
                    'privacy_applied': False
                }
        
        # Trends over time
        if data:
            result['trends'] = self.analytics_engine.get_trend_analysis(data, 'gpa')
        
        return result
    
    def analyze_attendance(self, data: List[Dict]) -> Dict:
        """Analyze attendance patterns with privacy"""
        if not data:
            return {}
        
        result = {
            'overall': {},
            'by_course': {},
            'by_time': {},
            'patterns': {},
            'privacy_level': self.config.level.value
        }
        
        # Overall attendance
        total_classes = sum(r.get('total_classes', 0) for r in data)
        attended = sum(r.get('attended', 0) for r in data)
        
        if self.config.level == PrivacyLevel.DIFFERENTIALLY_PRIVATE:
            total_classes = self.dp_engine.private_count(total_classes)
            attended = self.dp_engine.private_count(attended)
        
        result['overall'] = {
            'total_classes': total_classes,
            'attended': attended,
            'attendance_rate': (attended / total_classes * 100) if total_classes > 0 else 0,
            'privacy_applied': self.config.level == PrivacyLevel.DIFFERENTIALLY_PRIVATE
        }
        
        # By course
        courses = defaultdict(lambda: {'total': 0, 'attended': 0})
        for record in data:
            if 'course_id' in record:
                course = record['course_id']
                courses[course]['total'] += record.get('total_classes', 0)
                courses[course]['attended'] += record.get('attended', 0)
        
        for course, counts in courses.items():
            if self.config.level == PrivacyLevel.DIFFERENTIALLY_PRIVATE:
                total = self.dp_engine.private_count(counts['total'])
                attended = self.dp_engine.private_count(counts['attended'])
            else:
                total = counts['total']
                attended = counts['attended']
            
            result['by_course'][course] = {
                'total_classes': total,
                'attended': attended,
                'attendance_rate': (attended / total * 100) if total > 0 else 0,
                'privacy_applied': self.config.level == PrivacyLevel.DIFFERENTIALLY_PRIVATE
            }
        
        return result
    
    def analyze_engagement(self, data: List[Dict]) -> Dict:
        """Analyze student engagement with privacy"""
        if not data:
            return {}
        
        result = {
            'overall': {},
            'by_activity': {},
            'participation': {},
            'privacy_level': self.config.level.value
        }
        
        # Overall engagement
        active_students = sum(1 for r in data if r.get('active', False))
        total_activities = sum(r.get('activities_completed', 0) for r in data)
        total_time = sum(r.get('time_spent', 0) for r in data)
        
        if self.config.level == PrivacyLevel.DIFFERENTIALLY_PRIVATE:
            active_students = self.dp_engine.private_count(active_students)
            total_activities = self.dp_engine.private_count(total_activities)
            total_time = self.dp_engine.add_laplace_noise(total_time)
        
        result['overall'] = {
            'active_students': active_students,
            'total_activities': total_activities,
            'total_time_spent': total_time,
            'average_activities_per_student': total_activities / len(data) if data else 0,
            'privacy_applied': self.config.level == PrivacyLevel.DIFFERENTIALLY_PRIVATE
        }
        
        # Engagement by activity type
        activities = defaultdict(list)
        for record in data:
            if 'activity_type' in record and 'activities_completed' in record:
                activities[record['activity_type']].append(record['activities_completed'])
        
        for activity, counts in activities.items():
            if self.config.level == PrivacyLevel.DIFFERENTIALLY_PRIVATE:
                avg = self.dp_engine.private_mean(counts)
                count = self.dp_engine.private_count(len(counts))
            else:
                avg = sum(counts) / len(counts) if counts else 0
                count = len(counts)
            
            result['by_activity'][activity] = {
                'average_completed': avg,
                'participants': count,
                'privacy_applied': self.config.level == PrivacyLevel.DIFFERENTIALLY_PRIVATE
            }
        
        return result
    
    def analyze_resources(self, data: List[Dict]) -> Dict:
        """Analyze resource usage with privacy"""
        if not data:
            return {}
        
        result = {
            'overall': {},
            'by_resource': {},
            'demand_patterns': {},
            'privacy_level': self.config.level.value
        }
        
        # Overall resource usage
        total_usage = sum(r.get('usage_count', 0) for r in data)
        unique_resources = len(set(r.get('resource_id') for r in data if 'resource_id' in r))
        
        if self.config.level == PrivacyLevel.DIFFERENTIALLY_PRIVATE:
            total_usage = self.dp_engine.private_count(total_usage)
            unique_resources = self.dp_engine.private_count(unique_resources)
        
        result['overall'] = {
            'total_usage': total_usage,
            'unique_resources': unique_resources,
            'privacy_applied': self.config.level == PrivacyLevel.DIFFERENTIALLY_PRIVATE
        }
        
        # By resource
        resources = defaultdict(list)
        for record in data:
            if 'resource_id' in record and 'usage_count' in record:
                resources[record['resource_id']].append(record['usage_count'])
        
        for resource, usage in resources.items():
            if self.config.level == PrivacyLevel.DIFFERENTIALLY_PRIVATE:
                avg = self.dp_engine.private_mean(usage)
                count = self.dp_engine.private_count(len(usage))
            else:
                avg = sum(usage) / len(usage) if usage else 0
                count = len(usage)
            
            result['by_resource'][resource] = {
                'average_usage': avg,
                'users': count,
                'privacy_applied': self.config.level == PrivacyLevel.DIFFERENTIALLY_PRIVATE
            }
        
        return result
    
    def detect_suspicious_patterns(self, data: List[Dict]) -> List[Dict]:
        """Detect suspicious patterns with privacy protection"""
        suspicious = []
        
        # Detect anomalies with privacy
        anomalies = self.analytics_engine.get_anomaly_detection(data, 'gpa', 2.5)
        for anomaly in anomalies:
            suspicious.append({
                'type': 'performance_anomaly',
                'details': anomaly,
                'severity': anomaly.get('anomaly_level', 'medium')
            })
        
        # Detect unusual access patterns
        access_patterns = defaultdict(list)
        for record in data:
            if 'access_time' in record and 'user_id' in record:
                access_patterns[record['user_id']].append(record['access_time'])
        
        for user, times in access_patterns.items():
            if len(times) > 50:  # Suspiciously high access
                suspicious.append({
                    'type': 'access_pattern',
                    'user': self.anonymization_engine.mask_data(user, 3),
                    'access_count': len(times),
                    'severity': 'high' if len(times) > 100 else 'medium'
                })
        
        return suspicious

# ==================== API and Data Services ====================

class CampusAnalyticsAPI:
    """API for campus analytics with privacy controls"""
    
    def __init__(self, config: PrivacyConfig = None):
        self.config = config or PrivacyConfig(level=PrivacyLevel.DIFFERENTIALLY_PRIVATE)
        self.analytics = CampusPrivacyAnalytics(self.config)
        self.api_keys = {}
        self.audit_log = []
        self.request_count = 0
    
    def authenticate(self, api_key: str) -> bool:
        """Authenticate API requests"""
        return api_key in self.api_keys
    
    def generate_api_key(self, user_id: str, permissions: List[str] = None) -> str:
        """Generate API key for a user"""
        if permissions is None:
            permissions = ['read', 'analyze']
        
        key = secrets.token_hex(32)
        self.api_keys[key] = {
            'user_id': user_id,
            'permissions': permissions,
            'created_at': datetime.datetime.now(),
            'last_used': None
        }
        return key
    
    def query_analytics(self, query_type: str, data: List[Dict], params: Dict = None) -> Dict:
        """Execute analytics query with privacy"""
        self.request_count += 1
        start_time = time.time()
        
        # Log request
        self._log_request(query_type, params)
        
        result = {}
        
        try:
            if query_type == 'performance':
                result = self.analytics.analyze_performance(data)
            elif query_type == 'attendance':
                result = self.analytics.analyze_attendance(data)
            elif query_type == 'engagement':
                result = self.analytics.analyze_engagement(data)
            elif query_type == 'resources':
                result = self.analytics.analyze_resources(data)
            elif query_type == 'suspicious':
                result = {'anomalies': self.analytics.detect_suspicious_patterns(data)}
            else:
                result = {'error': 'Unknown query type'}
            
            # Add metadata
            result['metadata'] = {
                'query_type': query_type,
                'timestamp': datetime.datetime.now().isoformat(),
                'privacy_level': self.config.level.value,
                'request_id': f"req_{self.request_count:06d}",
                'processing_time': time.time() - start_time
            }
            
        except Exception as e:
            result = {
                'error': str(e),
                'metadata': {
                    'timestamp': datetime.datetime.now().isoformat(),
                    'request_id': f"req_{self.request_count:06d}",
                    'error': True
                }
            }
        
        return result
    
    def _log_request(self, query_type: str, params: Dict):
        """Log API request for audit"""
        log_entry = {
            'timestamp': datetime.datetime.now(),
            'request_count': self.request_count,
            'query_type': query_type,
            'privacy_level': self.config.level.value,
            'params': params or {}
        }
        self.audit_log.append(log_entry)
    
    def get_audit_log(self, limit: int = 100) -> List[Dict]:
        """Get audit log"""
        return self.audit_log[-limit:]
    
    def get_system_status(self) -> Dict:
        """Get system status"""
        return {
            'total_requests': self.request_count,
            'privacy_level': self.config.level.value,
            'api_keys_count': len(self.api_keys),
            'config': {
                'epsilon': self.config.epsilon,
                'k_value': self.config.k_value,
                'delta': self.config.delta
            },
            'timestamp': datetime.datetime.now().isoformat()
        }

# ==================== Data Generator ====================

class CampusDataGenerator:
    """Generate synthetic campus data for testing"""
    
    @staticmethod
    def generate_students(count: int = 100) -> List[Dict]:
        """Generate synthetic student data"""
        students = []
        majors = ['CS', 'Engineering', 'Business', 'Biology', 'Physics', 'Math', 'Psychology']
        years = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate']
        
        for i in range(count):
            student = {
                'student_id': f"S{random.randint(10000, 99999)}",
                'name': f"Student_{i+1}",
                'age': random.randint(18, 30),
                'gender': random.choice(['M', 'F', 'Other']),
                'major': random.choice(majors),
                'year': random.choice(years),
                'gpa': round(random.uniform(2.0, 4.0), 2),
                'attendance_rate': random.uniform(60, 100),
                'active': random.random() > 0.2,
                'activities_completed': random.randint(0, 50),
                'time_spent': random.randint(100, 500),
                'course_id': f"C{random.randint(100, 999)}"
            }
            students.append(student)
        
        return students
    
    @staticmethod
    def generate_attendance(count: int = 500) -> List[Dict]:
        """Generate synthetic attendance data"""
        attendance = []
        courses = [f"C{random.randint(100, 999)}" for _ in range(20)]
        student_ids = [f"S{random.randint(10000, 99999)}" for _ in range(50)]
        
        for _ in range(count):
            record = {
                'student_id': random.choice(student_ids),
                'course_id': random.choice(courses),
                'date': f"2024-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
                'attended': random.random() > 0.2,
                'total_classes': random.randint(10, 30),
                'attended_classes': random.randint(5, 25)
            }
            attendance.append(record)
        
        return attendance
    
    @staticmethod
    def generate_resources(count: int = 200) -> List[Dict]:
        """Generate synthetic resource usage data"""
        resources = []
        resource_types = ['library', 'computer_lab', 'study_room', 'online_access', 'software']
        student_ids = [f"S{random.randint(10000, 99999)}" for _ in range(30)]
        
        for _ in range(count):
            record = {
                'resource_id': f"R{random.randint(1000, 9999)}",
                'resource_type': random.choice(resource_types),
                'user_id': random.choice(student_ids),
                'usage_count': random.randint(1, 20),
                'access_time': f"2024-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}"
            }
            resources.append(record)
        
        return resources

# ==================== CLI Application ====================

class CampusAnalyticsCLI:
    """Command-line interface for campus analytics"""
    
    def __init__(self):
        self.config = PrivacyConfig(
            level=PrivacyLevel.DIFFERENTIALLY_PRIVATE,
            epsilon=0.1,
            k_value=5
        )
        self.api = CampusAnalyticsAPI(self.config)
        self.data_generator = CampusDataGenerator()
        self.stored_data = []
        self.api_key = None
        
    def run(self):
        """Main application loop"""
        print("\n" + "=" * 60)
        print("🔒 PRIVACY-PRESERVING CAMPUS ANALYTICS".center(60))
        print("=" * 60)
        
        # Generate API key
        self.api_key = self.api.generate_api_key('admin')
        print(f"\n🔑 API Key: {self.api_key}")
        
        while True:
            print("\n📋 MENU")
            print("-" * 40)
            print("1. 📊 Load/Generate Data")
            print("2. 📈 Performance Analysis")
            print("3. 📅 Attendance Analysis")
            print("4. 🎯 Engagement Analysis")
            print("5. 📚 Resource Analysis")
            print("6. ⚠️ Suspicious Pattern Detection")
            print("7. ⚙️ Configure Privacy Settings")
            print("8. 📋 View Audit Log")
            print("9. 📊 System Status")
            print("10. 🚪 Exit")
            
            choice = input("\nSelect option: ").strip()
            
            if choice == "1":
                self._load_data()
            elif choice == "2":
                self._performance_analysis()
            elif choice == "3":
                self._attendance_analysis()
            elif choice == "4":
                self._engagement_analysis()
            elif choice == "5":
                self._resource_analysis()
            elif choice == "6":
                self._suspicious_detection()
            elif choice == "7":
                self._configure_privacy()
            elif choice == "8":
                self._view_audit_log()
            elif choice == "9":
                self._system_status()
            elif choice == "10":
                print("\n👋 Goodbye! Protecting privacy on campus!")
                break
            else:
                print("❌ Invalid option")
    
    def _load_data(self):
        """Load or generate data"""
        print("\n📊 LOAD DATA")
        print("-" * 40)
        
        choice = input("Generate sample data? (y/n): ").strip().lower()
        
        if choice == 'y':
            count = int(input("Number of students (default 100): ").strip() or 100)
            self.stored_data = self.data_generator.generate_students(count)
            print(f"✅ Generated {len(self.stored_data)} student records")
            
            # Also generate attendance and resources
            attendance = self.data_generator.generate_attendance(count * 5)
            resources = self.data_generator.generate_resources(count * 2)
            print(f"✅ Generated {len(attendance)} attendance records")
            print(f"✅ Generated {len(resources)} resource records")
            
        else:
            print("Please add data manually through the system")
    
    def _performance_analysis(self):
        """Run performance analysis"""
        if not self.stored_data:
            print("❌ No data loaded. Please load data first.")
            return
        
        print("\n📈 PERFORMANCE ANALYSIS")
        print("-" * 40)
        
        if not self.api.authenticate(self.api_key):
            print("❌ Authentication failed")
            return
        
        result = self.api.query_analytics('performance', self.stored_data)
        
        print(f"\n📊 Results (Privacy Level: {result.get('privacy_level', 'Unknown')}):")
        
        if 'overall' in result:
            print("\nOverall Statistics:")
            for key, value in result['overall'].items():
                if isinstance(value, PrivateStatistic):
                    print(f"  • {key}: {value.value}")
                else:
                    print(f"  • {key}: {value}")
        
        if 'by_major' in result:
            print("\nBy Major:")
            for major, stats in result['by_major'].items():
                print(f"  • {major}: {stats.get('average_gpa', 'N/A'):.2f} GPA ({stats.get('student_count', 0)} students)")
                if stats.get('privacy_applied', False):
                    print(f"    (Privacy-protected)")
        
        if 'trends' in result and result['trends']:
            print("\nTrends:")
            for period, data in list(result['trends'].items())[:5]:
                print(f"  • {period}: {data.get('average', 0):.2f}")
    
    def _attendance_analysis(self):
        """Run attendance analysis"""
        if not self.stored_data:
            print("❌ No data loaded. Please load data first.")
            return
        
        print("\n📅 ATTENDANCE ANALYSIS")
        print("-" * 40)
        
        if not self.api.authenticate(self.api_key):
            print("❌ Authentication failed")
            return
        
        result = self.api.query_analytics('attendance', self.stored_data)
        
        if 'overall' in result:
            print(f"\n📊 Overall Attendance:")
            print(f"  • Total Classes: {result['overall'].get('total_classes', 0)}")
            print(f"  • Attended: {result['overall'].get('attended', 0)}")
            print(f"  • Rate: {result['overall'].get('attendance_rate', 0):.1f}%")
            if result['overall'].get('privacy_applied', False):
                print("  (Privacy-protected)")
        
        if 'by_course' in result:
            print("\nBy Course (Top 5):")
            courses = list(result['by_course'].items())
            courses.sort(key=lambda x: x[1].get('attendance_rate', 0), reverse=True)
            for course, stats in courses[:5]:
                print(f"  • {course}: {stats.get('attendance_rate', 0):.1f}%")
    
    def _engagement_analysis(self):
        """Run engagement analysis"""
        if not self.stored_data:
            print("❌ No data loaded. Please load data first.")
            return
        
        print("\n🎯 ENGAGEMENT ANALYSIS")
        print("-" * 40)
        
        if not self.api.authenticate(self.api_key):
            print("❌ Authentication failed")
            return
        
        result = self.api.query_analytics('engagement', self.stored_data)
        
        if 'overall' in result:
            print(f"\n📊 Overall Engagement:")
            print(f"  • Active Students: {result['overall'].get('active_students', 0)}")
            print(f"  • Total Activities: {result['overall'].get('total_activities', 0)}")
            print(f"  • Average Activities/Student: {result['overall'].get('average_activities_per_student', 0):.1f}")
            if result['overall'].get('privacy_applied', False):
                print("  (Privacy-protected)")
        
        if 'by_activity' in result:
            print("\nBy Activity Type:")
            for activity, stats in result['by_activity'].items():
                print(f"  • {activity}: {stats.get('average_completed', 0):.1f} avg ({stats.get('participants', 0)} participants)")
    
    def _resource_analysis(self):
        """Run resource analysis"""
        if not self.stored_data:
            print("❌ No data loaded. Please load data first.")
            return
        
        print("\n📚 RESOURCE ANALYSIS")
        print("-" * 40)
        
        if not self.api.authenticate(self.api_key):
            print("❌ Authentication failed")
            return
        
        result = self.api.query_analytics('resources', self.stored_data)
        
        if 'overall' in result:
            print(f"\n📊 Overall Resource Usage:")
            print(f"  • Total Usage: {result['overall'].get('total_usage', 0)}")
            print(f"  • Unique Resources: {result['overall'].get('unique_resources', 0)}")
            if result['overall'].get('privacy_applied', False):
                print("  (Privacy-protected)")
        
        if 'by_resource' in result:
            print("\nTop Resources:")
            resources = list(result['by_resource'].items())
            resources.sort(key=lambda x: x[1].get('average_usage', 0), reverse=True)
            for resource, stats in resources[:5]:
                print(f"  • {resource}: {stats.get('average_usage', 0):.1f} avg usage")
    
    def _suspicious_detection(self):
        """Detect suspicious patterns"""
        if not self.stored_data:
            print("❌ No data loaded. Please load data first.")
            return
        
        print("\n⚠️ SUSPICIOUS PATTERN DETECTION")
        print("-" * 40)
        
        if not self.api.authenticate(self.api_key):
            print("❌ Authentication failed")
            return
        
        result = self.api.query_analytics('suspicious', self.stored_data)
        
        if 'anomalies' in result and result['anomalies']:
            print(f"\n🚨 Found {len(result['anomalies'])} suspicious patterns:")
            for anomaly in result['anomalies']:
                print(f"\n  • Type: {anomaly.get('type', 'unknown')}")
                print(f"    Severity: {anomaly.get('severity', 'medium').upper()}")
                if 'details' in anomaly:
                    details = anomaly['details']
                    print(f"    Details: {details.get('metric_value', 'N/A')}")
                    print(f"    Z-Score: {details.get('z_score', 'N/A'):.2f}")
        else:
            print("✅ No suspicious patterns detected")
    
    def _configure_privacy(self):
        """Configure privacy settings"""
        print("\n⚙️ PRIVACY CONFIGURATION")
        print("-" * 40)
        
        print(f"\nCurrent Settings:")
        print(f"  • Privacy Level: {self.config.level.name}")
        print(f"  • Epsilon: {self.config.epsilon}")
        print(f"  • K-Value: {self.config.k_value}")
        print(f"  • Delta: {self.config.delta}")
        
        print("\n1. Change Privacy Level")
        print("2. Adjust Epsilon (0.01-1.0)")
        print("3. Adjust K-Value")
        print("4. Reset to Defaults")
        print("5. Back")
        
        choice = input("\nSelect option: ").strip()
        
        if choice == "1":
            print("\nPrivacy Levels:")
            print("  0: NONE (No privacy protection)")
            print("  1: ANONYMIZED (K-Anonymity)")
            print("  2: PSEUDONYMIZED (Pseudonymization)")
            print("  3: DIFFERENTIALLY_PRIVATE (Differential Privacy)")
            print("  4: FULLY_PRIVATE (Maximum Privacy)")
            
            level = int(input("Select level (0-4): ").strip() or 3)
            self.config.level = PrivacyLevel(level)
            print(f"✅ Privacy level set to {self.config.level.name}")
            
        elif choice == "2":
            epsilon = float(input("Enter epsilon (0.01-1.0, lower = more privacy): ").strip() or 0.1)
            self.config.epsilon = max(0.01, min(1.0, epsilon))
            print(f"✅ Epsilon set to {self.config.epsilon}")
            
        elif choice == "3":
            k = int(input("Enter K-Value (2-20, higher = more privacy): ").strip() or 5)
            self.config.k_value = max(2, min(20, k))
            print(f"✅ K-Value set to {self.config.k_value}")
            
        elif choice == "4":
            self.config = PrivacyConfig(level=PrivacyLevel.DIFFERENTIALLY_PRIVATE)
            print("✅ Reset to default settings")
        
        # Update API configuration
        self.api.config = self.config
        self.api.analytics.config = self.config
        self.api.analytics.analytics_engine.config = self.config
        self.api.analytics.analytics_engine.dp_engine = DifferentialPrivacyEngine(
            self.config.epsilon, self.config.delta
        )
    
    def _view_audit_log(self):
        """View audit log"""
        print("\n📋 AUDIT LOG")
        print("-" * 40)
        
        logs = self.api.get_audit_log(20)
        
        if not logs:
            print("No audit entries")
            return
        
        print(f"\nShowing last {len(logs)} entries:")
        for log in logs:
            print(f"\n  • {log.get('timestamp', '').strftime('%Y-%m-%d %H:%M:%S') if 'timestamp' in log else ''}")
            print(f"    Query: {log.get('query_type', 'unknown')}")
            print(f"    Privacy Level: {log.get('privacy_level', 'N/A')}")
            print(f"    Request #: {log.get('request_count', 0)}")
    
    def _system_status(self):
        """Display system status"""
        print("\n📊 SYSTEM STATUS")
        print("-" * 40)
        
        status = self.api.get_system_status()
        
        print(f"\n🔒 System Overview:")
        print(f"  • Total Requests: {status.get('total_requests', 0)}")
        print(f"  • Privacy Level: {status.get('privacy_level', 'N/A')}")
        print(f"  • API Keys: {status.get('api_keys_count', 0)}")
        
        print(f"\n⚙️ Configuration:")
        print(f"  • Epsilon: {status.get('config', {}).get('epsilon', 'N/A')}")
        print(f"  • K-Value: {status.get('config', {}).get('k_value', 'N/A')}")
        print(f"  • Delta: {status.get('config', {}).get('delta', 'N/A')}")
        
        print(f"\n🕒 System Time: {status.get('timestamp', 'N/A')}")

# ==================== Main Execution ====================

def main():
    """Main function"""
    cli = CampusAnalyticsCLI()
    
    try:
        cli.run()
    except KeyboardInterrupt:
        print("\n\n👋 Goodbye! Protecting privacy on campus!")
    except Exception as e:
        print(f"\n❌ An error occurred: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
