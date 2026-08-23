import math
import logging

logger = logging.getLogger("CampusConnect.Mythology")

class CampusSecretsService:
    def __init__(self, db_client):
        self.db = db_client

    def get_all_secrets_for_user(self, user_id: int):
        """Fetches all campus secrets and marks whether the user has unlocked them."""
        secrets = self.db.execute("SELECT * FROM campus_secrets;")
        unlocked = {row['secret_id'] for row in self.db.execute(
            "SELECT secret_id FROM user_unlocked_secrets WHERE user_id = %s;", (user_id,)
        )}

        result = []
        for s in secrets:
            result.append({
                "id": s['id'],
                "title": s['title'],
                "description": s['description'] if s['id'] in unlocked else "🔒 ??? (Explore to unlock)",
                "latitude": float(s['latitude']),
                "longitude": float(s['longitude']),
                "points_reward": s['points_reward'],
                "is_unlocked": s['id'] in unlocked
            })
        return result

    def check_and_unlock_secret(self, user_id: int, user_lat: float, user_lon: float):
        """
        Checks if the user is within 10 meters of any locked secret 
        using the Haversine formula. Unlocks and awards points if close enough.
        """
        secrets = self.db.execute("SELECT * FROM campus_secrets;")
        unlocked_ids = {row['secret_id'] for row in self.db.execute(
            "SELECT secret_id FROM user_unlocked_secrets WHERE user_id = %s;", (user_id,)
        )}

        newly_unlocked = []

        for s in secrets:
            if s['id'] in unlocked_ids:
                continue

            distance = self._calculate_haversine_distance(user_lat, user_lon, float(s['latitude']), float(s['longitude']))
            
            # Acceptance Criteria: Within 10 meters
            if distance <= 10.0:
                # Unlock secret
                self.db.execute(
                    "INSERT INTO user_unlocked_secrets (user_id, secret_id) VALUES (%s, %s) ON CONFLICT DO NOTHING;",
                    (user_id, s['id'])
                )
                # Award Gamification Points
                self.db.execute(
                    "UPDATE users SET gamification_points = gamification_points + %s WHERE id = %s;",
                    (s['points_reward'], user_id)
                )
                newly_unlocked.append({
                    "id": s['id'],
                    "title": s['title'],
                    "description": s['description'],
                    "points_awarded": s['points_reward']
                })
                logger.info(f"User {user_id} unlocked secret #{s['id']}: {s['title']}")

        return newly_unlocked

    @staticmethod
    def _calculate_haversine_distance(lat1, lon1, lat2, lon2):
        """Calculates great-circle distance between two GPS points in meters."""
        R = 6371000  # Earth radius in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = math.sin(delta_phi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c
