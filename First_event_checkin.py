"""
Offline-First Event Tickets & Check-In System
Comprehensive system for generating, managing, and validating event tickets offline
Integrated with campus event management, sustainability, and skill wallet systems
"""

import json
import datetime
import uuid
import hashlib
import base64
import qrcode
from io import BytesIO
from PIL import Image
import zlib
import pickle
import os
from typing import List, Dict, Set, Tuple, Optional, Any
from dataclasses import dataclass, field
from collections import defaultdict, Counter
from enum import Enum
import threading
import time


class TicketStatus(Enum):
    """Ticket status states"""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CHECKED_IN = "checked_in"
    USED = "used"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    TRANSFERRED = "transferred"
    REFUNDED = "refunded"


class TicketType(Enum):
    """Types of tickets"""
    GENERAL = "general"
    VIP = "vip"
    STUDENT = "student"
    FACULTY = "faculty"
    STAFF = "staff"
    VOLUNTEER = "volunteer"
    SPONSOR = "sponsor"
    MEDIA = "media"
    COMPLIMENTARY = "complimentary"
    EARLY_BIRD = "early_bird"


class CheckInMethod(Enum):
    """Methods of check-in"""
    QR_CODE = "qr_code"
    MANUAL = "manual"
    NFC = "nfc"
    SMS = "sms"
    EMAIL = "email"
    FACE_RECOGNITION = "face_recognition"


@dataclass
class Ticket:
    """Represents an event ticket with offline capabilities"""
    ticket_id: str
    event_id: str
    attendee_id: str
    attendee_name: str
    attendee_email: str
    ticket_type: TicketType
    status: TicketStatus
    created_at: datetime.datetime
    expires_at: Optional[datetime.datetime] = None
    check_in_time: Optional[datetime.datetime] = None
    check_in_method: Optional[CheckInMethod] = None
    checked_in_by: Optional[str] = None
    qr_code_data: str = ""
    verification_code: str = ""
    seat_number: str = ""
    section: str = ""
    row: str = ""
    notes: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    transfer_history: List[Dict] = field(default_factory=list)
    is_valid: bool = True
    last_modified: datetime.datetime = field(default_factory=datetime.datetime.now)
    
    def __post_init__(self):
        if not self.verification_code:
            self.verification_code = self._generate_verification_code()
        if not self.qr_code_data:
            self.qr_code_data = self._generate_qr_data()
    
    def _generate_verification_code(self) -> str:
        """Generate a unique verification code"""
        import random
        import string
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    
    def _generate_qr_data(self) -> str:
        """Generate QR code data"""
        data = {
            'ticket_id': self.ticket_id,
            'event_id': self.event_id,
            'attendee_id': self.attendee_id,
            'attendee_name': self.attendee_name,
            'ticket_type': self.ticket_type.value,
            'verification_code': self.verification_code,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        return base64.b64encode(json.dumps(data).encode()).decode()
    
    def check_in(self, method: CheckInMethod, checked_in_by: str) -> bool:
        """Check in the ticket"""
        if self.status == TicketStatus.USED or self.status == TicketStatus.EXPIRED:
            return False
        
        if self.expires_at and datetime.datetime.now() > self.expires_at:
            self.status = TicketStatus.EXPIRED
            return False
        
        self.status = TicketStatus.CHECKED_IN
        self.check_in_time = datetime.datetime.now()
        self.check_in_method = method
        self.checked_in_by = checked_in_by
        self.last_modified = datetime.datetime.now()
        self.is_valid = False  # Once checked in, cannot be used again
        return True
    
    def transfer(self, new_attendee_id: str, new_attendee_name: str, 
                new_attendee_email: str) -> bool:
        """Transfer ticket to another attendee"""
        if self.status != TicketStatus.CONFIRMED:
            return False
        
        transfer_record = {
            'from_attendee_id': self.attendee_id,
            'from_attendee_name': self.attendee_name,
            'to_attendee_id': new_attendee_id,
            'to_attendee_name': new_attendee_name,
            'to_attendee_email': new_attendee_email,
            'transferred_at': datetime.datetime.now().isoformat()
        }
        
        self.transfer_history.append(transfer_record)
        self.attendee_id = new_attendee_id
        self.attendee_name = new_attendee_name
        self.attendee_email = new_attendee_email
        self.status = TicketStatus.TRANSFERRED
        self.last_modified = datetime.datetime.now()
        
        # Generate new verification code for the new owner
        self.verification_code = self._generate_verification_code()
        self.qr_code_data = self._generate_qr_data()
        
        return True
    
    def to_dict(self) -> Dict:
        """Convert ticket to dictionary for serialization"""
        return {
            'ticket_id': self.ticket_id,
            'event_id': self.event_id,
            'attendee_id': self.attendee_id,
            'attendee_name': self.attendee_name,
            'attendee_email': self.attendee_email,
            'ticket_type': self.ticket_type.value,
            'status': self.status.value,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'check_in_time': self.check_in_time.isoformat() if self.check_in_time else None,
            'check_in_method': self.check_in_method.value if self.check_in_method else None,
            'checked_in_by': self.checked_in_by,
            'qr_code_data': self.qr_code_data,
            'verification_code': self.verification_code,
            'seat_number': self.seat_number,
            'section': self.section,
            'row': self.row,
            'notes': self.notes,
            'metadata': self.metadata,
            'transfer_history': self.transfer_history,
            'is_valid': self.is_valid,
            'last_modified': self.last_modified.isoformat() if self.last_modified else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Ticket':
        """Create ticket from dictionary"""
        return cls(
            ticket_id=data['ticket_id'],
            event_id=data['event_id'],
            attendee_id=data['attendee_id'],
            attendee_name=data['attendee_name'],
            attendee_email=data['attendee_email'],
            ticket_type=TicketType(data['ticket_type']),
            status=TicketStatus(data['status']),
            created_at=datetime.datetime.fromisoformat(data['created_at']) if data.get('created_at') else datetime.datetime.now(),
            expires_at=datetime.datetime.fromisoformat(data['expires_at']) if data.get('expires_at') else None,
            check_in_time=datetime.datetime.fromisoformat(data['check_in_time']) if data.get('check_in_time') else None,
            check_in_method=CheckInMethod(data['check_in_method']) if data.get('check_in_method') else None,
            checked_in_by=data.get('checked_in_by'),
            qr_code_data=data.get('qr_code_data', ''),
            verification_code=data.get('verification_code', ''),
            seat_number=data.get('seat_number', ''),
            section=data.get('section', ''),
            row=data.get('row', ''),
            notes=data.get('notes', ''),
            metadata=data.get('metadata', {}),
            transfer_history=data.get('transfer_history', []),
            is_valid=data.get('is_valid', True),
            last_modified=datetime.datetime.fromisoformat(data['last_modified']) if data.get('last_modified') else datetime.datetime.now()
        )


@dataclass
class TicketBatch:
    """Batch of tickets for offline processing"""
    batch_id: str
    event_id: str
    tickets: List[Ticket]
    created_at: datetime.datetime
    processed_at: Optional[datetime.datetime] = None
    total_tickets: int = 0
    processed_count: int = 0
    is_synced: bool = False
    sync_attempts: int = 0
    last_sync_attempt: Optional[datetime.datetime] = None
    
    def __post_init__(self):
        self.total_tickets = len(self.tickets)
    
    def add_ticket(self, ticket: Ticket):
        """Add a ticket to the batch"""
        self.tickets.append(ticket)
        self.total_tickets = len(self.tickets)
    
    def process_ticket(self, ticket_id: str) -> bool:
        """Process a ticket in the batch"""
        for ticket in self.tickets:
            if ticket.ticket_id == ticket_id:
                self.processed_count += 1
                return True
        return False
    
    def to_dict(self) -> Dict:
        """Convert batch to dictionary"""
        return {
            'batch_id': self.batch_id,
            'event_id': self.event_id,
            'tickets': [t.to_dict() for t in self.tickets],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
            'total_tickets': self.total_tickets,
            'processed_count': self.processed_count,
            'is_synced': self.is_synced,
            'sync_attempts': self.sync_attempts,
            'last_sync_attempt': self.last_sync_attempt.isoformat() if self.last_sync_attempt else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'TicketBatch':
        """Create batch from dictionary"""
        return cls(
            batch_id=data['batch_id'],
            event_id=data['event_id'],
            tickets=[Ticket.from_dict(t) for t in data['tickets']],
            created_at=datetime.datetime.fromisoformat(data['created_at']) if data.get('created_at') else datetime.datetime.now(),
            processed_at=datetime.datetime.fromisoformat(data['processed_at']) if data.get('processed_at') else None,
            total_tickets=data.get('total_tickets', 0),
            processed_count=data.get('processed_count', 0),
            is_synced=data.get('is_synced', False),
            sync_attempts=data.get('sync_attempts', 0),
            last_sync_attempt=datetime.datetime.fromisoformat(data['last_sync_attempt']) if data.get('last_sync_attempt') else None
        )


class OfflineStorage:
    """Handles offline storage and synchronization"""
    
    def __init__(self, storage_dir: str = "./offline_data"):
        self.storage_dir = storage_dir
        self.cache = {}
        self.is_online = False
        self.sync_thread = None
        self.sync_lock = threading.Lock()
        
        # Create storage directory if it doesn't exist
        if not os.path.exists(storage_dir):
            os.makedirs(storage_dir)
        
        # Initialize subdirectories
        self.tickets_dir = os.path.join(storage_dir, "tickets")
        self.batches_dir = os.path.join(storage_dir, "batches")
        self.sync_dir = os.path.join(storage_dir, "sync")
        
        for directory in [self.tickets_dir, self.batches_dir, self.sync_dir]:
            if not os.path.exists(directory):
                os.makedirs(directory)
    
    def save_ticket(self, ticket: Ticket) -> bool:
        """Save a ticket to offline storage"""
        try:
            ticket_data = ticket.to_dict()
            filename = os.path.join(self.tickets_dir, f"{ticket.ticket_id}.json")
            with open(filename, 'w') as f:
                json.dump(ticket_data, f, indent=2)
            
            # Update cache
            self.cache[ticket.ticket_id] = ticket
            return True
        except Exception as e:
            print(f"Error saving ticket: {e}")
            return False
    
    def load_ticket(self, ticket_id: str) -> Optional[Ticket]:
        """Load a ticket from offline storage"""
        # Check cache first
        if ticket_id in self.cache:
            return self.cache[ticket_id]
        
        try:
            filename = os.path.join(self.tickets_dir, f"{ticket_id}.json")
            if os.path.exists(filename):
                with open(filename, 'r') as f:
                    data = json.load(f)
                ticket = Ticket.from_dict(data)
                self.cache[ticket_id] = ticket
                return ticket
        except Exception as e:
            print(f"Error loading ticket: {e}")
        return None
    
    def save_batch(self, batch: TicketBatch) -> bool:
        """Save a ticket batch to offline storage"""
        try:
            batch_data = batch.to_dict()
            filename = os.path.join(self.batches_dir, f"{batch.batch_id}.json")
            with open(filename, 'w') as f:
                json.dump(batch_data, f, indent=2)
            return True
        except Exception as e:
            print(f"Error saving batch: {e}")
            return False
    
    def load_batch(self, batch_id: str) -> Optional[TicketBatch]:
        """Load a ticket batch from offline storage"""
        try:
            filename = os.path.join(self.batches_dir, f"{batch_id}.json")
            if os.path.exists(filename):
                with open(filename, 'r') as f:
                    data = json.load(f)
                return TicketBatch.from_dict(data)
        except Exception as e:
            print(f"Error loading batch: {e}")
        return None
    
    def load_all_tickets(self) -> List[Ticket]:
        """Load all tickets from offline storage"""
        tickets = []
        try:
            for filename in os.listdir(self.tickets_dir):
                if filename.endswith('.json'):
                    with open(os.path.join(self.tickets_dir, filename), 'r') as f:
                        data = json.load(f)
                    ticket = Ticket.from_dict(data)
                    tickets.append(ticket)
                    self.cache[ticket.ticket_id] = ticket
        except Exception as e:
            print(f"Error loading all tickets: {e}")
        return tickets
    
    def sync_to_cloud(self) -> Dict:
        """Sync offline data to cloud (simulated)"""
        sync_results = {
            'tickets_synced': 0,
            'batches_synced': 0,
            'errors': [],
            'timestamp': datetime.datetime.now().isoformat()
        }
        
        with self.sync_lock:
            # Sync tickets
            for filename in os.listdir(self.tickets_dir):
                if filename.endswith('.json'):
                    try:
                        # Simulate cloud sync
                        time.sleep(0.1)  # Simulate network delay
                        sync_results['tickets_synced'] += 1
                        
                        # Mark as synced (could move to synced directory)
                        src_path = os.path.join(self.tickets_dir, filename)
                        dst_path = os.path.join(self.sync_dir, f"synced_{filename}")
                        os.rename(src_path, dst_path)
                    except Exception as e:
                        sync_results['errors'].append(f"Error syncing {filename}: {e}")
            
            # Sync batches
            for filename in os.listdir(self.batches_dir):
                if filename.endswith('.json'):
                    try:
                        time.sleep(0.1)
                        sync_results['batches_synced'] += 1
                        
                        src_path = os.path.join(self.batches_dir, filename)
                        dst_path = os.path.join(self.sync_dir, f"synced_{filename}")
                        os.rename(src_path, dst_path)
                    except Exception as e:
                        sync_results['errors'].append(f"Error syncing {filename}: {e}")
            
            self.is_online = True
        
        return sync_results
    
    def get_offline_stats(self) -> Dict:
        """Get statistics about offline data"""
        stats = {
            'total_tickets': 0,
            'total_batches': 0,
            'cache_size': len(self.cache),
            'storage_used_mb': 0,
            'is_online': self.is_online
        }
        
        # Calculate storage used
        total_size = 0
        for directory in [self.tickets_dir, self.batches_dir, self.sync_dir]:
            for file in os.listdir(directory):
                file_path = os.path.join(directory, file)
                if os.path.isfile(file_path):
                    total_size += os.path.getsize(file_path)
        
        stats['storage_used_mb'] = total_size / (1024 * 1024)
        stats['total_tickets'] = len(os.listdir(self.tickets_dir))
        stats['total_batches'] = len(os.listdir(self.batches_dir))
        
        return stats


class QRCodeGenerator:
    """Generates and validates QR codes for tickets"""
    
    def __init__(self):
        self.qr_cache = {}
    
    def generate_qr_code(self, ticket: Ticket, size: int = 300) -> str:
        """Generate QR code image as base64 string"""
        try:
            # Create QR code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_H,
                box_size=10,
                border=4,
            )
            qr.add_data(ticket.qr_code_data)
            qr.make(fit=True)
            
            # Create image
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Resize if needed
            if size != 300:
                img = img.resize((size, size), Image.Resampling.LANCZOS)
            
            # Convert to base64
            buffered = BytesIO()
            img.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            
            # Cache the QR code
            self.qr_cache[ticket.ticket_id] = img_str
            
            return img_str
        except Exception as e:
            print(f"Error generating QR code: {e}")
            return ""
    
    def validate_qr_code(self, qr_data: str) -> Optional[Dict]:
        """Validate QR code data and extract ticket information"""
        try:
            # Decode base64
            decoded = base64.b64decode(qr_data).decode()
            data = json.loads(decoded)
            
            # Validate required fields
            required_fields = ['ticket_id', 'event_id', 'attendee_id', 'verification_code']
            for field in required_fields:
                if field not in data:
                    return None
            
            return data
        except Exception:
            return None
    
    def generate_batch_qr_codes(self, tickets: List[Ticket]) -> Dict[str, str]:
        """Generate QR codes for multiple tickets"""
        qr_codes = {}
        for ticket in tickets:
            qr_codes[ticket.ticket_id] = self.generate_qr_code(ticket)
        return qr_codes


class OfflineCheckInSystem:
    """Offline check-in system with conflict detection"""
    
    def __init__(self, storage: OfflineStorage, qr_generator: QRCodeGenerator):
        self.storage = storage
        self.qr_generator = qr_generator
        self.check_in_log: List[Dict] = []
        self.check_in_cache: Dict[str, Ticket] = {}
        self.conflict_detection = ConflictDetector()
    
    def process_check_in(self, ticket_id: str, check_in_by: str, 
                        method: CheckInMethod = CheckInMethod.QR_CODE) -> Dict:
        """Process a check-in attempt"""
        result = {
            'success': False,
            'ticket_id': ticket_id,
            'message': '',
            'timestamp': datetime.datetime.now().isoformat(),
            'checked_in_by': check_in_by
        }
        
        # Check if already checked in
        if ticket_id in self.check_in_cache:
            cached_ticket = self.check_in_cache[ticket_id]
            if cached_ticket.status == TicketStatus.CHECKED_IN:
                result['message'] = 'Ticket already checked in'
                result['ticket'] = cached_ticket.to_dict()
                return result
        
        # Load ticket from storage
        ticket = self.storage.load_ticket(ticket_id)
        if not ticket:
            result['message'] = 'Ticket not found'
            return result
        
        # Validate ticket
        if not ticket.is_valid:
            result['message'] = 'Ticket is invalid'
            return result
        
        if ticket.status == TicketStatus.EXPIRED:
            result['message'] = 'Ticket has expired'
            return result
        
        if ticket.status == TicketStatus.USED:
            result['message'] = 'Ticket already used'
            return result
        
        if ticket.status == TicketStatus.CANCELLED:
            result['message'] = 'Ticket has been cancelled'
            return result
        
        # Check for conflicts
        conflicts = self.conflict_detection.detect_all_conflicts([ticket])
        if conflicts:
            result['message'] = 'Conflict detected in check-in'
            result['conflicts'] = conflicts
            return result
        
        # Perform check-in
        success = ticket.check_in(method, check_in_by)
        if success:
            # Save updated ticket
            self.storage.save_ticket(ticket)
            
            # Cache the checked-in ticket
            self.check_in_cache[ticket_id] = ticket
            
            # Log the check-in
            self.check_in_log.append({
                'ticket_id': ticket_id,
                'attendee_name': ticket.attendee_name,
                'check_in_time': ticket.check_in_time.isoformat() if ticket.check_in_time else None,
                'check_in_method': method.value,
                'checked_in_by': check_in_by,
                'status': 'success'
            })
            
            result['success'] = True
            result['message'] = 'Check-in successful'
            result['ticket'] = ticket.to_dict()
        else:
            result['message'] = 'Check-in failed'
        
        return result
    
    def process_offline_batch(self, batch_id: str, check_in_by: str) -> Dict:
        """Process an entire batch of tickets offline"""
        result = {
            'success': False,
            'batch_id': batch_id,
            'processed': 0,
            'failed': 0,
            'errors': [],
            'timestamp': datetime.datetime.now().isoformat()
        }
        
        batch = self.storage.load_batch(batch_id)
        if not batch:
            result['errors'].append('Batch not found')
            return result
        
        for ticket in batch.tickets:
            check_in_result = self.process_check_in(
                ticket.ticket_id, 
                check_in_by, 
                CheckInMethod.MANUAL
            )
            
            if check_in_result['success']:
                result['processed'] += 1
            else:
                result['failed'] += 1
                result['errors'].append(f"Failed to check in {ticket.ticket_id}: {check_in_result['message']}")
        
        batch.processed_at = datetime.datetime.now()
        batch.processed_count = result['processed']
        self.storage.save_batch(batch)
        
        if result['processed'] > 0:
            result['success'] = True
        
        return result
    
    def get_check_in_stats(self) -> Dict:
        """Get check-in statistics"""
        return {
            'total_check_ins': len(self.check_in_log),
            'successful_check_ins': sum(1 for log in self.check_in_log if log.get('status') == 'success'),
            'failed_check_ins': sum(1 for log in self.check_in_log if log.get('status') == 'failed'),
            'cache_size': len(self.check_in_cache),
            'last_check_in': self.check_in_log[-1] if self.check_in_log else None
        }
    
    def sync_check_ins(self) -> Dict:
        """Sync check-in data to cloud"""
        sync_result = {
            'synced_count': 0,
            'errors': [],
            'timestamp': datetime.datetime.now().isoformat()
        }
        
        # Simulate sync of check-in logs
        try:
            # In production, this would send to a server
            time.sleep(0.5)  # Simulate network
            sync_result['synced_count'] = len(self.check_in_log)
            
            # Clear the log after syncing (or move to synced storage)
            self.check_in_log = []
        except Exception as e:
            sync_result['errors'].append(str(e))
        
        return sync_result


class OfflineTicketManager:
    """Main offline-first ticket management system"""
    
    def __init__(self, event_manager=None, sustainability_system=None, 
                 skill_wallet_manager=None):
        self.event_manager = event_manager
        self.sustainability_system = sustainability_system
        self.skill_wallet_manager = skill_wallet_manager
        
        # Core components
        self.storage = OfflineStorage()
        self.qr_generator = QRCodeGenerator()
        self.check_in_system = OfflineCheckInSystem(self.storage, self.qr_generator)
        
        # Ticket management
        self.tickets: Dict[str, Ticket] = {}
        self.batches: Dict[str, TicketBatch] = {}
        self.event_tickets: Dict[str, List[str]] = defaultdict(list)
        
        # Statistics
        self.total_tickets = 0
        self.checked_in_count = 0
        self.sync_required = False
        
        # Background sync thread
        self.sync_thread = None
        self.is_running = True
        
        # Initialize skills
        self._initialize_ticket_skills()
        
        # Load existing data
        self._load_offline_data()
    
    def _initialize_ticket_skills(self):
        """Initialize skills related to ticket management"""
        if self.skill_wallet_manager:
            ticket_skills = [
                {
                    'id': 'skill_tkt_001',
                    'name': 'Ticket Management',
                    'description': 'Managing event tickets and check-ins',
                    'category': SkillCategory.TECHNICAL,
                    'level': SkillLevel.BEGINNER
                },
                {
                    'id': 'skill_tkt_002',
                    'name': 'Event Check-in',
                    'description': 'Processing event check-ins efficiently',
                    'category': SkillCategory.SOFT,
                    'level': SkillLevel.BEGINNER
                },
                {
                    'id': 'skill_tkt_003',
                    'name': 'QR Code Management',
                    'description': 'Generating and validating QR codes',
                    'category': SkillCategory.TECHNICAL,
                    'level': SkillLevel.BEGINNER
                },
                {
                    'id': 'skill_tkt_004',
                    'name': 'Offline Operations',
                    'description': 'Managing operations without internet',
                    'category': SkillCategory.TECHNICAL,
                    'level': SkillLevel.BEGINNER
                }
            ]
            
            for skill_data in ticket_skills:
                skill = Skill(
                    skill_id=skill_data['id'],
                    name=skill_data['name'],
                    description=skill_data['description'],
                    category=skill_data['category'],
                    level=skill_data['level']
                )
                self.skill_wallet_manager.skill_definitions[skill.skill_id] = skill
    
    def _load_offline_data(self):
        """Load data from offline storage"""
        # Load tickets
        tickets = self.storage.load_all_tickets()
        for ticket in tickets:
            self.tickets[ticket.ticket_id] = ticket
            self.event_tickets[ticket.event_id].append(ticket.ticket_id)
        
        self.total_tickets = len(tickets)
        
        # Load batches
        # (simplified - would load all batches in production)
    
    def create_ticket(self, event_id: str, attendee_id: str, attendee_name: str,
                     attendee_email: str, ticket_type: TicketType = TicketType.GENERAL,
                     expires_at: Optional[datetime.datetime] = None,
                     seat_number: str = "", section: str = "", row: str = "") -> Ticket:
        """Create a new ticket"""
        ticket = Ticket(
            ticket_id=str(uuid.uuid4()),
            event_id=event_id,
            attendee_id=attendee_id,
            attendee_name=attendee_name,
            attendee_email=attendee_email,
            ticket_type=ticket_type,
            status=TicketStatus.CONFIRMED,
            created_at=datetime.datetime.now(),
            expires_at=expires_at,
            seat_number=seat_number,
            section=section,
            row=row,
            is_valid=True
        )
        
        # Store ticket
        self.tickets[ticket.ticket_id] = ticket
        self.event_tickets[event_id].append(ticket.ticket_id)
        self.total_tickets += 1
        
        # Save to offline storage
        self.storage.save_ticket(ticket)
        
        # Update sustainability system
        if self.sustainability_system:
            self._update_sustainability_for_ticket(attendee_id, ticket)
        
        # Update skill wallet
        if self.skill_wallet_manager:
            self._update_skill_wallet_for_ticket(attendee_id, ticket)
        
        return ticket
    
    def _update_sustainability_for_ticket(self, user_id: str, ticket: Ticket):
        """Update sustainability system for ticket creation"""
        user = self.sustainability_system.get_user(user_id)
        if not user:
            return
        
        points = 5  # Base points for ticket creation
        
        # Bonus for VIP tickets
        if ticket.ticket_type == TicketType.VIP:
            points += 10
        
        # Bonus for early bird
        if ticket.ticket_type == TicketType.EARLY_BIRD:
            points += 5
        
        user.total_points += points
        user.add_xp(points // 2)
        print(f"  🎫 Ticket created! +{points} sustainability points")
    
    def _update_skill_wallet_for_ticket(self, user_id: str, ticket: Ticket):
        """Update skill wallet for ticket creation"""
        wallet = self.skill_wallet_manager.get_skill_wallet(user_id)
        if not wallet:
            return
        
        # Award Ticket Management skill
        skill_id = 'skill_tkt_001'
        if skill_id in wallet.skills:
            skill = wallet.skills[skill_id]
            skill.add_experience(5)
            if skill.experience_points > 100:
                skill.level = SkillLevel.INTERMEDIATE
                print(f"  📈 Upgraded Ticket Management skill to INTERMEDIATE!")
        else:
            self.skill_wallet_manager.award_skill(user_id, skill_id, SkillLevel.BEGINNER)
            print(f"  🎯 Awarded Ticket Management skill!")
    
    def create_ticket_batch(self, event_id: str, tickets_data: List[Dict]) -> TicketBatch:
        """Create a batch of tickets for offline processing"""
        batch = TicketBatch(
            batch_id=str(uuid.uuid4()),
            event_id=event_id,
            tickets=[],
            created_at=datetime.datetime.now()
        )
        
        for data in tickets_data:
            ticket = self.create_ticket(
                event_id=event_id,
                attendee_id=data.get('attendee_id', str(uuid.uuid4())),
                attendee_name=data.get('attendee_name', 'Unknown'),
                attendee_email=data.get('attendee_email', 'unknown@campus.edu'),
                ticket_type=data.get('ticket_type', TicketType.GENERAL),
                expires_at=data.get('expires_at'),
                seat_number=data.get('seat_number', ''),
                section=data.get('section', ''),
                row=data.get('row', '')
            )
            batch.add_ticket(ticket)
        
        # Store batch
        self.batches[batch.batch_id] = batch
        self.storage.save_batch(batch)
        
        return batch
    
    def check_in_ticket(self, ticket_id: str, check_in_by: str, 
                        method: CheckInMethod = CheckInMethod.QR_CODE) -> Dict:
        """Check in a ticket"""
        result = self.check_in_system.process_check_in(ticket_id, check_in_by, method)
        
        if result['success']:
            self.checked_in_count += 1
            
            # Update sustainability system
            if self.sustainability_system:
                ticket = self.tickets.get(ticket_id)
                if ticket:
                    user = self.sustainability_system.get_user(ticket.attendee_id)
                    if user:
                        points = 10
                        user.total_points += points
                        user.add_xp(points // 2)
                        print(f"  ✅ Check-in successful! +{points} sustainability points")
            
            # Update skill wallet
            if self.skill_wallet_manager:
                ticket = self.tickets.get(ticket_id)
                if ticket:
                    wallet = self.skill_wallet_manager.get_skill_wallet(ticket.attendee_id)
                    if wallet:
                        skill_id = 'skill_tkt_002'
                        if skill_id not in wallet.skills:
                            self.skill_wallet_manager.award_skill(
                                ticket.attendee_id, skill_id, SkillLevel.BEGINNER
                            )
                            print(f"  🎯 Awarded Event Check-in skill!")
        
        return result
    
    def check_in_by_qr_code(self, qr_code_data: str, check_in_by: str) -> Dict:
        """Check in a ticket by scanning QR code"""
        # Validate QR code
        qr_data = self.qr_generator.validate_qr_code(qr_code_data)
        if not qr_data:
            return {
                'success': False,
                'message': 'Invalid QR code',
                'timestamp': datetime.datetime.now().isoformat()
            }
        
        ticket_id = qr_data.get('ticket_id')
        if not ticket_id:
            return {
                'success': False,
                'message': 'Ticket ID not found in QR code',
                'timestamp': datetime.datetime.now().isoformat()
            }
        
        # Process check-in
        return self.check_in_ticket(ticket_id, check_in_by, CheckInMethod.QR_CODE)
    
    def get_ticket(self, ticket_id: str) -> Optional[Ticket]:
        """Get a ticket by ID"""
        return self.tickets.get(ticket_id)
    
    def get_event_tickets(self, event_id: str) -> List[Ticket]:
        """Get all tickets for an event"""
        ticket_ids = self.event_tickets.get(event_id, [])
        return [self.tickets[tid] for tid in ticket_ids if tid in self.tickets]
    
    def get_ticket_stats(self) -> Dict:
        """Get ticket statistics"""
        stats = {
            'total_tickets': self.total_tickets,
            'checked_in': self.checked_in_count,
            'pending': 0,
            'cancelled': 0,
            'expired': 0,
            'by_type': Counter(),
            'check_in_rate': 0.0
        }
        
        # Count by status and type
        for ticket in self.tickets.values():
            if ticket.status == TicketStatus.CHECKED_IN:
                stats['pending'] += 1
            elif ticket.status == TicketStatus.CANCELLED:
                stats['cancelled'] += 1
            elif ticket.status == TicketStatus.EXPIRED:
                stats['expired'] += 1
            
            stats['by_type'][ticket.ticket_type.value] += 1
        
        # Calculate check-in rate
        if self.total_tickets > 0:
            stats['check_in_rate'] = (self.checked_in_count / self.total_tickets) * 100
        
        return stats
    
    def generate_ticket_qr(self, ticket_id: str) -> Optional[str]:
        """Generate QR code for a ticket"""
        ticket = self.tickets.get(ticket_id)
        if not ticket:
            return None
        
        return self.qr_generator.generate_qr_code(ticket)
    
    def batch_check_in(self, batch_id: str, check_in_by: str) -> Dict:
        """Process a batch of tickets for check-in"""
        return self.check_in_system.process_offline_batch(batch_id, check_in_by)
    
    def sync_offline_data(self) -> Dict:
        """Sync offline data to cloud"""
        # Sync storage
        sync_result = self.storage.sync_to_cloud()
        
        # Sync check-in logs
        check_in_sync = self.check_in_system.sync_check_ins()
        sync_result['check_in_sync'] = check_in_sync
        
        self.sync_required = False
        return sync_result
    
    def get_offline_status(self) -> Dict:
        """Get offline system status"""
        storage_stats = self.storage.get_offline_stats()
        check_in_stats = self.check_in_system.get_check_in_stats()
        
        return {
            'storage': storage_stats,
            'check_ins': check_in_stats,
            'sync_required': self.sync_required,
            'total_tickets': self.total_tickets,
            'cached_tickets': len(self.check_in_system.check_in_cache)
        }
    
    def generate_ticket_report(self, event_id: str) -> Dict:
        """Generate a report for event tickets"""
        tickets = self.get_event_tickets(event_id)
        
        if not tickets:
            return {'message': 'No tickets found for this event'}
        
        report = {
            'event_id': event_id,
            'total_tickets': len(tickets),
            'checked_in': sum(1 for t in tickets if t.status == TicketStatus.CHECKED_IN),
            'pending': sum(1 for t in tickets if t.status == TicketStatus.CONFIRMED),
            'cancelled': sum(1 for t in tickets if t.status == TicketStatus.CANCELLED),
            'by_type': Counter(),
            'check_in_rate': 0.0,
            'tickets': []
        }
        
        for ticket in tickets:
            report['by_type'][ticket.ticket_type.value] += 1
            report['tickets'].append({
                'ticket_id': ticket.ticket_id,
                'attendee_name': ticket.attendee_name,
                'status': ticket.status.value,
                'check_in_time': ticket.check_in_time.isoformat() if ticket.check_in_time else None
            })
        
        if report['total_tickets'] > 0:
            report['check_in_rate'] = (report['checked_in'] / report['total_tickets']) * 100
        
        return report


# Demo function
def demo_offline_ticket_system():
    """Demonstrate the offline ticket and check-in system"""
    print("🎫 OFFLINE-FIRST EVENT TICKETS & CHECK-IN SYSTEM 🎫")
    print("=" * 80)
    
    # Initialize integrated systems
    from sustainability_gamification import SustainabilityGamification
    from skill_wallet_project_management import SkillWalletProjectManager
    
    sustainability = SustainabilityGamification()
    skill_manager = SkillWalletProjectManager(sustainability)
    
    # Register users
    print("\n📝 Registering users...")
    sustainability.register_user("user_001", "EventOrganizer")
    sustainability.register_user("user_002", "AttendeeAlice")
    sustainability.register_user("user_003", "AttendeeBob")
    print("✅ Users registered")
    
    # Initialize ticket manager
    ticket_manager = OfflineTicketManager(
        event_manager=None,
        sustainability_system=sustainability,
        skill_wallet_manager=skill_manager
    )
    
    # Create tickets
    print("\n🎫 Creating tickets...")
    
    # Create individual tickets
    tickets_data = [
        {
            'attendee_id': 'user_002',
            'attendee_name': 'Alice Student',
            'attendee_email': 'alice@campus.edu',
            'ticket_type': TicketType.STUDENT,
            'seat_number': 'A1',
            'section': 'Front',
            'row': 'A'
        },
        {
            'attendee_id': 'user_003',
            'attendee_name': 'Bob Student',
            'attendee_email': 'bob@campus.edu',
            'ticket_type': TicketType.STUDENT,
            'seat_number': 'A2',
            'section': 'Front',
            'row': 'A'
        },
        {
            'attendee_id': 'user_001',
            'attendee_name': 'Event Organizer',
            'attendee_email': 'organizer@campus.edu',
            'ticket_type': TicketType.VIP,
            'seat_number': 'V1',
            'section': 'VIP',
            'row': 'VIP'
        }
    ]
    
    event_id = "evt_001"
    created_tickets = []
    
    for data in tickets_data:
        ticket = ticket_manager.create_ticket(
            event_id=event_id,
            attendee_id=data['attendee_id'],
            attendee_name=data['attendee_name'],
            attendee_email=data['attendee_email'],
            ticket_type=data['ticket_type'],
            seat_number=data.get('seat_number', ''),
            section=data.get('section', ''),
            row=data.get('row', '')
        )
        created_tickets.append(ticket)
        print(f"  ✅ Created: {ticket.attendee_name} - {ticket.ticket_type.value} ticket")
    
    # Create ticket batch
    print("\n📦 Creating ticket batch...")
    batch_tickets = [
        {
            'attendee_id': str(uuid.uuid4()),
            'attendee_name': 'Group Student 1',
            'attendee_email': 'group1@campus.edu',
            'ticket_type': TicketType.STUDENT
        },
        {
            'attendee_id': str(uuid.uuid4()),
            'attendee_name': 'Group Student 2',
            'attendee_email': 'group2@campus.edu',
            'ticket_type': TicketType.STUDENT
        },
        {
            'attendee_id': str(uuid.uuid4()),
            'attendee_name': 'Group Faculty',
            'attendee_email': 'faculty@campus.edu',
            'ticket_type': TicketType.FACULTY
        }
    ]
    
    batch = ticket_manager.create_ticket_batch(event_id, batch_tickets)
    print(f"  ✅ Created batch with {len(batch.tickets)} tickets")
    
    # Generate QR codes
    print("\n📱 Generating QR codes...")
    for ticket in created_tickets[:2]:
        qr_data = ticket_manager.generate_ticket_qr(ticket.ticket_id)
        if qr_data:
            print(f"  ✅ QR code generated for {ticket.attendee_name}")
    
    # Perform check-ins
    print("\n✅ Performing check-ins...")
    
    # Check-in first ticket
    result1 = ticket_manager.check_in_ticket(
        created_tickets[0].ticket_id,
        'user_001',
        CheckInMethod.QR_CODE
    )
    print(f"  Check-in 1: {result1['message']}")
    
    # Check-in second ticket
    result2 = ticket_manager.check_in_ticket(
        created_tickets[1].ticket_id,
        'user_001',
        CheckInMethod.MANUAL
    )
    print(f"  Check-in 2: {result2['message']}")
    
    # Try to check-in already checked-in ticket
    result3 = ticket_manager.check_in_ticket(
        created_tickets[0].ticket_id,
        'user_001',
        CheckInMethod.QR_CODE
    )
    print(f"  Check-in 3 (duplicate): {result3['message']}")
    
    # Check-in by QR code
    if created_tickets:
        ticket = created_tickets[0]
        qr_data = ticket_manager.generate_ticket_qr(ticket.ticket_id)
        if qr_data:
            result4 = ticket_manager.check_in_by_qr_code(qr_data, 'user_001')
            print(f"  Check-in by QR: {result4['message']}")
    
    # Process batch check-in
    print("\n📦 Processing batch check-in...")
    batch_result = ticket_manager.batch_check_in(batch.batch_id, 'user_001')
    print(f"  Processed: {batch_result['processed']} tickets")
    print(f"  Failed: {batch_result['failed']} tickets")
    
    # Generate ticket report
    print("\n📊 Ticket Report:")
    report = ticket_manager.generate_ticket_report(event_id)
    print(f"  Total Tickets: {report['total_tickets']}")
    print(f"  Checked In: {report['checked_in']}")
    print(f"  Check-in Rate: {report['check_in_rate']:.1f}%")
    
    # Get ticket stats
    print("\n📊 Ticket Statistics:")
    stats = ticket_manager.get_ticket_stats()
    print(f"  Total Tickets: {stats['total_tickets']}")
    print(f"  Checked In: {stats['checked_in']}")
    print(f"  Check-in Rate: {stats['check_in_rate']:.1f}%")
    print(f"  By Type: {dict(stats['by_type'])}")
    
    # Get offline status
    print("\n📡 Offline Status:")
    offline_status = ticket_manager.get_offline_status()
    print(f"  Storage Used: {offline_status['storage']['storage_used_mb']:.2f} MB")
    print(f"  Offline Tickets: {offline_status['storage']['total_tickets']}")
    print(f"  Cached Check-ins: {offline_status['cached_tickets']}")
    
    # Sync offline data
    print("\n🔄 Syncing offline data...")
    sync_result = ticket_manager.sync_offline_data()
    print(f"  Tickets Synced: {sync_result['tickets_synced']}")
    print(f"  Batches Synced: {sync_result['batches_synced']}")
    
    # Check sustainability integration
    print("\n🌱 Sustainability Integration:")
    user = sustainability.get_user('user_002')
    if user:
        print(f"  User: {user.username}")
        print(f"  Sustainability Points: {user.total_points}")
        print(f"  Level: {user.level}")
    
    # Check skill wallet integration
    print("\n🎯 Skill Wallet Integration:")
    wallet = skill_manager.get_skill_wallet('user_002')
    if wallet:
        print(f"  Skill Points: {wallet.total_skill_points}")
        print(f"  Skills: {len(wallet.skills)}")
        for skill in wallet.skills.values():
            if skill.skill_id.startswith('skill_tkt_'):
                print(f"    • {skill.name}: {skill.level.value.title()}")
    
    print("\n✨ Demonstration complete! ✨")


if __name__ == "__main__":
    demo_offline_ticket_system()
