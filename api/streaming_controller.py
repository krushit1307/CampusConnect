from flask import Blueprint, request, jsonify
from datetime import datetime

streaming_bp = Blueprint('streaming', __name__)

@streaming_bp.route('/api/streams/ping', methods=['POST'])
def ping_stream_watch():
    """
    Called every 60 seconds by the video player heartbeat.
    Automatically marks user as 'attended' if cumulative watch time >= 15 minutes (900 seconds).
    """
    data = request.get_json()
    user_id = data.get('user_id')
    event_id = data.get('event_id')
    increment_seconds = 60

    session = db.query("SELECT * FROM stream_watch_sessions WHERE user_id = %s AND event_id = %s", (user_id, event_id))
    
    if not session:
        db.execute(
            "INSERT INTO stream_watch_sessions (user_id, event_id, watch_duration_seconds) VALUES (%s, %s, %s)",
            (user_id, event_id, increment_seconds)
        )
        total_duration = increment_seconds
    else:
        total_duration = session['watch_duration_seconds'] + increment_seconds
        has_attended = session['has_attended'] or (total_duration >= 900) # 15 minutes threshold
        
        db.execute(
            "UPDATE stream_watch_sessions SET watch_duration_seconds = %s, has_attended = %s, last_ping_at = %s WHERE user_id = %s AND event_id = %s",
            (total_duration, has_attended, datetime.utcnow(), user_id, event_id)
        )

        if has_attended and not session['has_attended']:
            # Automatically record official event attendance
            db.execute(
                "INSERT INTO event_attendance (user_id, event_id, verified_via) VALUES (%s, %s, 'live_stream') ON CONFLICT DO NOTHING;",
                (user_id, event_id)
            )

    return jsonify({"status": "success", "watch_duration_seconds": total_duration, "attended_recorded": total_duration >= 900}), 200
