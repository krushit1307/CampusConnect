from flask import Blueprint, request, jsonify
from services.accessibility_survey_service import AccessibilitySurveyService

accessibility_bp = Blueprint('accessibility_survey', __name__)
survey_service = AccessibilitySurveyService(db_client=None, email_client=None, notification_client=None) # Injected via app factory

@accessibility_bp.route('/api/surveys/accessibility/<token>', methods=['POST'])
def submit_accessibility_survey(token):
    data = request.get_json()
    rating = data.get('rating')
    feedback_text = data.get('feedback_text', '')

    if not rating or not isinstance(rating, int) or not (1 <= rating <= 5):
        return jsonify({"error": "A valid rating between 1 and 5 is required."}), 400

    try:
        result = survey_service.submit_audit_response(token, rating, feedback_text)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": "Internal server error processing audit response."}), 500
