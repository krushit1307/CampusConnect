# Weather widget (issue #1915)

A campus dashboard surface for live weather via OpenWeather.

## Architecture

```
  React (WeatherWidget / useWeather)
        │   fetch /api/weather
        ▼
  Edge Function (supabase/functions/weather)
        │   GET api.openweathermap.org/data/2.5/weather
        ▼
  OpenWeather API (translated to WeatherSnapshot)
```

The React layer never sees the upstream provider — the Edge Function
translates the raw OpenWeather response into the
`WeatherSnapshot` contract defined in `types.ts`.

## Required Edge Function secrets

Set these via `supabase secrets set`:

- `OPENWEATHER_API_KEY` — mandatory
- `CAMPUS_LAT`, `CAMPUS_LON` — fallback default location (Lat/Lng)
  OR
- `CAMPUS_ZIP` — fallback default location (zip code)

The widget accepts `?lat=…&lon=…` or `?q=…` overrides; if neither is
supplied it falls back to `CAMPUS_*`.

## Fail-open behaviour

- Network failure or 5xx → widget shows "Weather unavailable"
- Missing/invalid API key → widget never receives a snapshot
- During loading → widget renders nothing (preserves dashboard layout)
- All "unknown" upstream conditions bucket to a CloudOff icon

## Caching

Successful responses are cached **in-process for 30 minutes** per location
key (lat/lon pair or `q=` string). Cold starts pay the full request cost;
warm invocations hit the cache.

## Tests

```
npm run test -- --run src/components/weather
```
