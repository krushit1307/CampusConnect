# Advanced Search API Documentation

This document explains the technical details of the relevance-ranked search implementation for Events.

## Search Vectors & Weights

We use a combination of Postgres `tsvector` and `setweight` to prioritize fields when searching for events.

- **Title (Weight A):** The title of the event is the most important field. If a search term matches the title, it gets the highest possible ranking.
- **Description (Weight C):** The description is assigned a lower weight. Matches here are less important than title matches.

```sql
setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
setweight(to_tsvector('english', coalesce(description, '')), 'C')
```

## Ranking Algorithm

The backend search RPC uses `ts_rank` to evaluate relevance based on the matching lexical tokens in the document versus the query.

- It considers both the weights (A vs C) and the frequency/proximity of matches.
- The results are returned using `ORDER BY ts_rank(search_vector, search_query) DESC`.
- We use `created_at DESC` as the secondary sort key to break ties between events that have equal ranking score.

## Supported Search Syntax

The search function utilizes `websearch_to_tsquery('english', query)`. This parser understands natural-language input and provides Google-like query syntax:

- **Natural Language:** `react workshop` (Searches for "react" AND "workshop")
- **Quoted Phrases:** `"react workshop"` (Searches for the exact phrase)
- **OR Operator:** `react OR vue`
- **Exclusion:** `react -angular` (Searches for "react" but excludes events containing "angular")

## Performance Considerations

- A GIN (Generalized Inverted Index) on `search_vector` ensures the database can do rapid lookups without a sequential scan.
- Full-text search and ranking is computationally expensive compared to boolean matches. Thus, the database restricts results via `LIMIT 50` at the SQL level to ensure the CPU isn't overloaded when ranking thousands of events.

## Extending the Search

To add more searchable fields (e.g., location, organizer):

1. Modify the `search_vector` generation in the events table:
   ```sql
   ALTER TABLE public.events DROP COLUMN search_vector;
   ALTER TABLE public.events ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
       setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
       setweight(to_tsvector('english', coalesce(description, '')), 'C') ||
       setweight(to_tsvector('english', coalesce(location, '')), 'D')
   ) STORED;
   ```
2. Re-create the index.
