-- =============================================================================
-- Migration: Interactive Campus "Safe Space" Directory
-- Issue: #3562 - Build an 'Interactive Campus "Safe Space" Directory'
-- Description: Creates the campus_resources table to store critical safety,
-- mental health, and identity center locations. Includes categories and
-- emergency contact information.
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- 1. Campus Resources Table
CREATE TYPE resource_category AS ENUM (
    'mental_health',
    'lgbtq_center',
    'womens_center',
    'counseling',
    'security',
    'medical',
    'spiritual'
);
CREATE TABLE IF NOT EXISTS public.campus_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category resource_category NOT NULL,
    description TEXT,
    building_name TEXT NOT NULL,
    room_number TEXT,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    phone_number TEXT,
    emergency_phone TEXT,
    hours_of_operation TEXT,
    website_url TEXT,
    is_confidential BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campus_resources_category ON public.campus_resources(category);
-- 2. Insert seed data for common campus resources
INSERT INTO public.campus_resources (
        name,
        category,
        description,
        building_name,
        room_number,
        phone_number,
        hours_of_operation,
        is_confidential
    )
VALUES (
        'University Counseling Center',
        'counseling',
        'Free, confidential short-term counseling for all enrolled students.',
        'Student Health Building',
        'Suite 200',
        '555-0100',
        'Mon-Fri: 8:00 AM - 5:00 PM',
        TRUE
    ),
    (
        'Pride Center',
        'lgbtq_center',
        'A safe, affirming space for LGBTQ+ students to connect and access resources.',
        'Student Union',
        'Room 305',
        '555-0101',
        'Mon-Fri: 9:00 AM - 8:00 PM',
        TRUE
    ),
    (
        'Women\'s Empowerment Center',
        'womens_center',
        'Advocacy, support, and resources for women and gender-marginalized students.',
        'Humanities Building',
        'Room 112',
        '555-0102',
        'Mon-Fri: 9:00 AM - 6:00 PM',
        TRUE
    ),
    (
        'Campus Security Dispatch',
        'security',
        '24/7 emergency response and safe walk services.',
        'Public Safety HQ',
        'Main Desk',
        '555-9111',
        '24/7',
        FALSE
    ),
    (
        'Mental Health Crisis Hotline',
        'mental_health',
        'Immediate support for students experiencing a mental health emergency.',
        'Off-Campus',
        'N/A',
        '555-8000',
        '24/7',
        TRUE
    ) ON CONFLICT DO NOTHING;
-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.campus_resources ENABLE ROW LEVEL SECURITY;
-- Anyone can view campus resources (public information)
CREATE POLICY "Public can view campus resources" ON public.campus_resources FOR
SELECT USING (true);
-- Only admins can manage resources
CREATE POLICY "Admins can manage campus resources" ON public.campus_resources FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
            AND role = 'admin'
    )
);
