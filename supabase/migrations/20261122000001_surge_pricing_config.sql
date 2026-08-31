-- Migration: 20261122000001_surge_pricing_config.sql
-- Description: Add Surge Pricing Configuration for Dynamic Pricing

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS surge_config JSONB DEFAULT '{"enabled": false, "threshold": 10, "multiplier": 1.2}'::jsonb;
