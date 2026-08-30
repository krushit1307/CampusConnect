from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, not_, or_
from src.models import Event, Venue
from src.services.email import send_email_notification

def evaluate_event_demand(event_id: int, db: Session):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        return
    
    current_capacity = event.venue.capacity
    total_demand = current_capacity + event.waitlist_count
    ratio = total_demand / current_capacity if current_capacity > 0 else 0.0

    # Trigger threshold: Waitlist exceeds 200% of current capacity (ratio > 2.0)
    if ratio > 2.0:
        trigger_venue_auto_scaler(event, total_demand, db)

def trigger_venue_auto_scaler(event: Event, total_demand: int, db: Session):
    # Find venues with capacity >= total_demand that do not overlap with event time
    conflicting_event_venues = db.query(Event.venue_id).filter(
        and_(
            Event.start_time < event.end_time,
            Event.end_time > event.start_time
        )
    ).subquery()

    larger_available_venue = db.query(Venue).filter(
        Venue.capacity >= total_demand,
        not_(Venue.id.in_(conflicting_event_venues))
    ).order_by(Venue.capacity.asc()).first()

    if larger_available_venue:
        upgrade_link = f"https://campusconnect.edu/events/{event.id}/upgrade-venue?venue_id={larger_available_venue.id}"
        send_email_notification(
            to_email=event.organizer.email,
            subject=f"🚨 Massive Demand Detected for '{event.title}'!",
            body=f"Hi {event.organizer.full_name},\n\nYour event has {event.waitlist_count} waitlisted users. The '{larger_available_venue.name}' (Capacity: {larger_available_venue.capacity}) is available at this time.\n\nClick here to instantly request a venue change: {upgrade_link}"
        )
