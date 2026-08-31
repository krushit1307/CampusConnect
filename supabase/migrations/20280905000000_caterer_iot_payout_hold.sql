-- Migration: 20280905000000_caterer_iot_payout_hold.sql
-- Description: Extend shipment_status states to support Pending_Environmental_Clearance

BEGIN;

-- Drop check constraint if exists
ALTER TABLE public.event_caterer_contracts 
DROP CONSTRAINT IF EXISTS event_caterer_contracts_shipment_status_check;

-- Add updated check constraint
ALTER TABLE public.event_caterer_contracts 
ADD CONSTRAINT event_caterer_contracts_shipment_status_check 
CHECK (shipment_status IN ('PENDING', 'Pending_Environmental_Clearance', 'SAFE', 'CONDEMNED'));

-- Set default to Pending_Environmental_Clearance for new agreements
ALTER TABLE public.event_caterer_contracts 
ALTER COLUMN shipment_status SET DEFAULT 'Pending_Environmental_Clearance';

COMMIT;
