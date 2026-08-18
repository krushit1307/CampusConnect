-- =============================================================================
-- Migration: Group Discounts for Event Ticketing
-- Issue: #2902 - Implement 'Group Discounts' for Event Ticketing
-- Description: Adds a `discount_rules` JSONB column to the `ticket_tiers` 
-- table to support dynamic quantity-based pricing (e.g., Buy 5 get 10% off).
-- =============================================================================

-- Add discount_rules column to ticket_tiers
ALTER TABLE public.ticket_tiers
ADD COLUMN IF NOT EXISTS discount_rules JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.ticket_tiers.discount_rules IS 
'Array of discount threshold objects: [{"min_qty": 5, "discount_pct": 10}, {"min_qty": 10, "discount_pct": 20}]';

-- Add a check constraint to ensure the JSONB structure is valid
ALTER TABLE public.ticket_tiers
ADD CONSTRAINT chk_discount_rules_format
CHECK (
    jsonb_typeof(discount_rules) = 'array' AND
    NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(discount_rules) AS elem
        WHERE jsonb_typeof(elem) != 'object' 
           OR jsonb_typeof(elem->'min_qty') != 'number' 
           OR jsonb_typeof(elem->'discount_pct') != 'number'
           OR (elem->>'min_qty')::int <= 0
           OR (elem->>'discount_pct')::numeric < 0
           OR (elem->>'discount_pct')::numeric > 100
    )
);
