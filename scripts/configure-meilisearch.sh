# !/usr/bin/env bash
# scripts/configure-meilisearch.sh
#
# Configures the Meilisearch index settings for events, clubs, and
# profiles after the initial bulk sync. Run once after deploying
# the meilisearch-sync Edge Function and running the bulk sync.
#
# Usage:
#   MEILI_HOST=http://localhost:7700 \
#   MEILI_API_KEY=local-dev-master-key-please-change \
#   ./scripts/configure-meilisearch.sh

set -euo pipefail

HOST="${MEILI_HOST:-http://localhost:7700}"
KEY="${MEILI_API_KEY:?MEILI_API_KEY is required}"

echo "Configuring Meilisearch indexes at $HOST..."

# ── Events index ────────────────────────────────────────────────
echo "→ Configuring 'events' index..."
curl -s -X PATCH "$HOST/indexes/events/settings" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "searchableAttributes": [
      "title",
      "description",
      "location"
    ],
    "displayedAttributes": [
      "id", "title", "description", "location", "event_date",
      "start_date", "end_date", "club_id", "banner_url",
"short_id", "max_attendees", "status", "deleted_at",
"_sync_version", "created_at"
],
"sortableAttributes": ["event_date", "created_at", "max_attendees"],
"filterableAttributes": ["club_id", "status", "deleted_at"],    "rankingRules": [
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness"
    ],
    "typoTolerance": {
      "enabled": true,
      "minWordSizeForTypos": {
        "oneTypo": 4,
        "twoTypos": 8
      }
    },
    "synonyms": {
      "tech": ["technology", "coding", "programming"],
      "meetup": ["meeting", "gathering"],
      "party": ["celebration", "social"],
      "workshop": ["class", "seminar", "tutorial"]
    }
  }' | jq .

# ── Clubs index ─────────────────────────────────────────────────
echo "→ Configuring 'clubs' index..."
curl -s -X PATCH "$HOST/indexes/clubs/settings" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "searchableAttributes": [
      "name",
      "description",
      "category"
    ],
    "displayedAttributes": [
      "id", "name", "slug", "description", "category",
      "member_count", "logo_url", "created_at"
    ],
    "sortableAttributes": ["member_count", "created_at"],
    "filterableAttributes": ["category"],
    "rankingRules": [
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness"
    ],
    "typoTolerance": {
      "enabled": true,
      "minWordSizeForTypos": {
        "oneTypo": 3,
        "twoTypos": 6
      }
    }
  }' | jq .

# ── Profiles index ──────────────────────────────────────────────
echo "→ Configuring 'profiles' index..."
curl -s -X PATCH "$HOST/indexes/profiles/settings" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "searchableAttributes": [
      "full_name",
      "first_name",
      "last_name",
      "handle",
      "bio"
    ],
    "displayedAttributes": [
      "id", "first_name", "last_name", "handle",
      "bio", "avatar_url", "full_name"
    ],
    "sortableAttributes": [],
    "filterableAttributes": [],
    "rankingRules": [
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness"
    ],
    "typoTolerance": {
      "enabled": true,
      "minWordSizeForTypos": {
        "oneTypo": 3,
        "twoTypos": 6
      }
    }
  }' | jq .

echo "✅ Meilisearch indexes configured."
