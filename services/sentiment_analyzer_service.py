import logging
from textblob import TextBlob

logger = logging.getLogger("CampusConnect.Sentiment")

class SentimentAnalyzerService:
    def __init__(self, db_client, websocket_client):
        self.db = db_client
        self.ws = websocket_client

    def process_incoming_question(self, event_id: str, question_text: str):
        """
        Analyzes the sentiment of an incoming question using NLP (Polarity scoring: -1.0 to +1.0),
        saves the score, updates the rolling aggregate score for the event, and broadcasts the Vibe Meter update.
        """
        # 1. Perform Sentiment Analysis (-1.0 to +1.0)
        blob = TextBlob(question_text)
        polarity = blob.sentiment.polarity 
        
        # Scale to a -5 to +5 range for intuitive UI scaling
        scaled_score = polarity * 5.0

        # 2. Store question sentiment in DB
        self.db.execute(
            "INSERT INTO live_questions (event_id, question_text, sentiment_score) VALUES (%s, %s, %s);",
            (event_id, question_text, scaled_score)
        )

        # 3. Calculate rolling average for the last 50 questions
        recent_questions = self.db.execute(
            "SELECT sentiment_score FROM live_questions WHERE event_id = %s ORDER BY created_at DESC LIMIT 50;",
            (event_id,)
        )
        
        scores = [q['sentiment_score'] for q in recent_questions]
        rolling_avg = sum(scores) / len(scores) if scores else 0.0

        # 4. Check Hostility Threshold (< -3.0 triggers red warning alert)
        is_hostile = rolling_avg < -3.0

        # 5. Broadcast real-time Vibe Meter update to moderator dashboard via WebSocket
        vibe_payload = {
            "event_id": event_id,
            "rolling_sentiment": round(rolling_avg, 2),
            "is_hostile": is_hostile,
            "warning_message": "🚨 Crowd sentiment is turning hostile. Suggest shifting topics." if is_hostile else None
        }
        
        self.ws.broadcast_to_room(f"moderator_{event_id}", "vibe_update", vibe_payload)
        
        if is_hostile:
            logger.warning(f"Hostile crowd sentiment detected for event {event_id}. Rolling score: {rolling_avg}")

        return vibe_payload
