-- Migration: 20270826000000_club_tax_exempt.sql
-- Description: Adds is_tax_exempt and tax_id_ein columns to clubs table to support automated tax receipt generation.

ALTER TABLE public.clubs 
ADD COLUMN IF NOT EXISTS is_tax_exempt BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tax_id_ein TEXT;
