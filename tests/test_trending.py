import os
import requests
import uuid
import pytest

# Assuming local Supabase instance
SUPABASE_URL = os.getenv("SUPABASE_URL", "http://127.0.0.1:54321")
EDGE_FUNCTION_BASE = f"{SUPABASE_URL}/functions/v1"

def test_trending_events_flow():
    # 1. Query the trending API. Note the order.
    # If the edge function is not running locally, this test might fail in CI
    # We use a try-except to gracefully skip if the local dev server isn't up
    try:
        resp = requests.get(f"{EDGE_FUNCTION_BASE}/trending-events")
        resp.raise_for_status()
    except requests.exceptions.ConnectionError:
        pytest.skip("Local Supabase Edge Functions not running. Run `supabase start` first.")
        return
        
    initial_trending = resp.json().get("events", [])
    
    # 2. Programmatically fire 50 "RSVP" events for a specific, low-ranked event.
    target_event_id = str(uuid.uuid4())
    
    # Simulate 50 RSVPs
    for _ in range(50):
        res = requests.post(
            f"{EDGE_FUNCTION_BASE}/update-trending-score",
            json={"event_id": target_event_id, "action": "rsvp"}
        )
        res.raise_for_status()
        
    # 3. Query the trending API again. Verify the event instantly shoots to the #1 position.
    resp2 = requests.get(f"{EDGE_FUNCTION_BASE}/trending-events")
    resp2.raise_for_status()
    new_trending = resp2.json().get("events", [])
    
    assert len(new_trending) > 0, "Trending list should not be empty"
    assert new_trending[0] == target_event_id, f"Expected {target_event_id} to be #1, got {new_trending[0]}"
    
    # 4. Run the decay script manually.
    decay_resp = requests.post(f"{EDGE_FUNCTION_BASE}/trending-decay")
    decay_resp.raise_for_status()
    
    # We can't directly read the exact score from trending-events API (it only returns UUIDs),
    # but we can verify the API succeeds and the decay logic didn't crash.
    assert decay_resp.json().get("success") is True
