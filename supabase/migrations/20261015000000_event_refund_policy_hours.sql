-- Migration: 20261015000000_event_refund_policy_hours.sql
-- Description: Adds refund_policy_hours column to events table.

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS refund_policy_hours INTEGER DEFAULT 48 NOT NULL;
