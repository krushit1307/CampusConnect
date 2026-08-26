import logging
from datetime import datetime

logger = logging.getLogger("CampusConnect.Accessibility")

class AccessibilitySurveyService:
    def __init__(self, db_client, email_client, notification_client):
        self.db = db_client
        self.email_client = email_client
        self.notification_client = notification_client

    def handle_post_event_trigger(self, event_id: str):
        """
        Hooks into the post-event survey dispatcher. 
        Identifies attendees with specific accessibility requests and routes them 
        to the specialized audit survey instead of the generic feedback form.
        """
        event = self.db.events.find_by_id(event_id)
        if not event:
            logger.error(f"Event {event_id} not found for survey dispatch.")
            return

        # Fetch all confirmed RSVPs for the event
        rsvps = self.db.rsvps.find_by_event(event_id)

        for rsvp in rsvps:
            user_id = rsvp['user_id']
            accessibility_requests = rsvp.get('accessibility_request', [])

            if accessibility_requests:
                # Bypass generic survey and dispatch specialized accessibility audit
                self._dispatch_audit_survey(user_id, event, accessibility_requests)
            else:
                # Trigger standard generic post-event survey (Issue #3323)
                self._dispatch_standard_survey(user_id, event)

    def _dispatch_audit_survey(self, user_id: str, event: dict, requests: list):
        user = self.db.users.find_by_id(user_id)
        if not user or not user.get('email'):
            return

        request_str = ", ".join(requests)
        survey_token = self.db.surveys.create_token(user_id=user_id, event_id=event['id'], type='accessibility_audit')

        subject = f"Feedback on your accessibility accommodations for {event['title']}"
        body = (
            f"Hi {user['name']},\n\n"
            f"We noticed you requested the following accommodation(s) for {event['title']}: {request_str}.\n"
            f"Your comfort and safety are our highest priorities. Did this accommodation meet your needs?\n\n"
            f"Please complete your brief accessibility audit survey here (Scale 1-5 with details):\n"
            f"https://campusconnect.edu/surveys/accessibility/{survey_token}\n\n"
            f"Thank you for helping us hold our community accountable."
        )

        self.email_client.send(to=user['email'], subject=subject, body=body)
        logger.info(f"Dispatched specialized accessibility survey to user {user_id} for event {event['id']}.")

    def submit_audit_response(self, survey_token: str, rating: int, feedback_text: str):
        """
        Processes submitted accessibility audit responses. 
        If rating < 3, triggers immediate compliance escalation.
        """
        survey_record = self.db.surveys.verify_token(survey_token)
        if not survey_record or survey_record['status'] == 'completed':
            raise ValueError("Invalid or already completed survey token.")

        response_data = {
            'user_id': survey_record['user_id'],
            'event_id': survey_record['event_id'],
            'rating': rating,
            'feedback_text': feedback_text,
            'submitted_at': datetime.utcnow()
        }
        self.db.accessibility_responses.insert(response_data)
        self.db.surveys.mark_completed(survey_token)

        # Compliance Check: Severe failure threshold (rating < 3)
        if rating < 3:
            self._escalate_compliance_failure(response_data)

        return {"status": "success", "message": "Feedback recorded successfully."}

    def _escalate_compliance_failure(self, response: dict):
        event = self.db.events.find_by_id(response['event_id'])
        organizer_id = event['organizer_id']
        
        # 1. Flag Organizer Account for Review
        self.db.users.flag_account(
            user_id=organizer_id,
            reason=f"Accessibility compliance failure on event {event['title']} (Rating: {response['rating']}/5)"
        )

        # 2. Alert University Disability Resource Center (DRC)
        drc_email = "drc-compliance@campusconnect.edu"
        alert_subject = f"🚨 URGENT: Accessibility Compliance Failure - Event #{event['id']}"
        alert_body = (
            f"A student reported a severe failure regarding accommodations for the event '{event['title']}'.\n\n"
            f"- Rating Given: {response['rating']}/5\n"
            f"- Student Feedback: \"{response['feedback_text']}\"\n"
            f"- Event Organizer ID: {organizer_id}\n\n"
            f"Action Required: Immediate audit and organizer review mandated."
        )
        self.email_client.send(to=drc_email, subject=alert_subject, body=alert_body)
        self.notification_client.send_push_to_role(role='drc_admin', message=alert_subject)

        logger.critical(f"Escalated accessibility failure for event {event['id']} to DRC and flagged organizer {organizer_id}.")

    def _dispatch_standard_survey(self, user_id: str, event: dict):
        # Placeholder for standard survey hook (Issue #3323)
        pass
