-- Seed data for CampusConnect local development

-- 1. Create dummy authenticated users in auth.users
-- Default password: password123 (encrypted using blowfish crypt)
INSERT INTO
    auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
    )
VALUES (
        '00000000-0000-0000-0000-000000000000',
        'd0000000-0000-0000-0000-000000000001',
        'authenticated',
        'authenticated',
        'admin@campusconnect.edu',
        crypt (
            'password123',
            gen_salt ('bf')
        ),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"full_name": "Admin User", "first_name": "Admin", "last_name": "User", "avatar_url": "https://api.dicebear.com/7.x/adventurer/svg?seed=Admin"}',
        NOW(),
        NOW()
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        'd0000000-0000-0000-0000-000000000002',
        'authenticated',
        'authenticated',
        'student@campusconnect.edu',
        crypt (
            'password123',
            gen_salt ('bf')
        ),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"full_name": "John Doe", "first_name": "John", "last_name": "Doe", "avatar_url": "https://api.dicebear.com/7.x/adventurer/svg?seed=John"}',
        NOW(),
        NOW()
    )
ON CONFLICT (id) DO NOTHING;

-- 2. Update profiles details (triggers automatically created them on auth.users insert)
UPDATE public.profiles
SET role = 'club_admin',
college = 'Tech Institute of Technology',
bio = 'Project administrator and Tech Club advisor.'
WHERE
    id = 'd0000000-0000-0000-0000-000000000001';

UPDATE public.profiles
SET role = 'student',
college = 'School of Fine Arts',
bio = 'Sophomore student interested in design and music.'
WHERE
    id = 'd0000000-0000-0000-0000-000000000002';

-- 3. Dummy Clubs
INSERT INTO
    clubs (
        id,
        name,
        slug,
        description,
        banner_url,
        logo_url,
        created_by
    )
VALUES (
        'c0000000-0000-0000-0000-000000000001',
        'Tech Club',
        'tech-club',
        'A club for tech enthusiasts, programmers, and builders.',
        'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800&auto=format&fit=crop',
        'https://api.dicebear.com/7.x/initials/svg?seed=TC',
        'd0000000-0000-0000-0000-000000000001'
    ),
    (
        'c0000000-0000-0000-0000-000000000002',
        'Art & Design',
        'art-design',
        'Exploring creative limits and visual communication mediums.',
        'https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=800&auto=format&fit=crop',
        'https://api.dicebear.com/7.x/initials/svg?seed=AD',
        'd0000000-0000-0000-0000-000000000001'
    ),
    (
        'c0000000-0000-0000-0000-000000000003',
        'Music Society',
        'music-society',
        'Jam sessions, songwriting workshops, and campus concerts.',
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop',
        'https://api.dicebear.com/7.x/initials/svg?seed=MS',
        'd0000000-0000-0000-0000-000000000002'
    )
ON CONFLICT (id) DO NOTHING;

-- 3.5 Dummy Club Roles
INSERT INTO
    club_roles (id, club_id, title, permissions_level)
VALUES
    ('90000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Admin', 100),
    ('90000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Member', 10),
    ('90000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'Admin', 100),
    ('90000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'Member', 10),
    ('90000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000003', 'Admin', 100),
    ('90000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000003', 'Member', 10)
ON CONFLICT (id) DO NOTHING;

-- 4. Club Memberships
INSERT INTO
    club_members (
        id,
        club_id,
        user_id,
        role_id,
        status
    )
VALUES (
        'b0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000001',
        'd0000000-0000-0000-0000-000000000001',
        '90000000-0000-0000-0000-000000000001',
        'approved'
    ),
    (
        'b0000000-0000-0000-0000-000000000002',
        'c0000000-0000-0000-0000-000000000002',
        'd0000000-0000-0000-0000-000000000002',
        '90000000-0000-0000-0000-000000000003',
        'approved'
    ),
    (
        'b0000000-0000-0000-0000-000000000003',
        'c0000000-0000-0000-0000-000000000001',
        'd0000000-0000-0000-0000-000000000002',
        '90000000-0000-0000-0000-000000000002',
        'approved'
    )
ON CONFLICT (id) DO NOTHING;

-- 5. Dummy Events
INSERT INTO
    events (
        id,
        club_id,
        category_id,
        title,
        description,
        banner_url,
        event_date,
        start_date,
        end_date,
        location,
        created_by
    )
VALUES (
        'e0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000001',
        (
            SELECT id
            FROM event_categories
            WHERE
                name = 'Tech'
            LIMIT 1
        ),
        'Hackathon 2024',
        'Annual college hackathon. Build something awesome in 24 hours!',
        'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=800&auto=format&fit=crop',
        NOW() + INTERVAL '7 days',
        NOW() + INTERVAL '7 days',
        NOW() + INTERVAL '8 days',
        'Main Auditorium',
        'd0000000-0000-0000-0000-000000000001'
    ),
    (
        'e0000000-0000-0000-0000-000000000002',
        'c0000000-0000-0000-0000-000000000002',
        (
            SELECT id
            FROM event_categories
            WHERE
                name = 'Workshop'
            LIMIT 1
        ),
        'Watercolor Workshop',
        'Learn the basics of watercolor painting with live demonstrations.',
        'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=800&auto=format&fit=crop',
        NOW() + INTERVAL '3 days',
        NOW() + INTERVAL '3 days',
        NOW() + INTERVAL '3 days' + INTERVAL '3 hours',
        'Art Studio 3',
        'd0000000-0000-0000-0000-000000000001'
    ),
    (
        'e0000000-0000-0000-0000-000000000003',
        'c0000000-0000-0000-0000-000000000003',
        (
            SELECT id
            FROM event_categories
            WHERE
                name = 'Cultural'
            LIMIT 1
        ),
        'Open Mic Night',
        'Showcase your music talent or just come to enjoy the acoustic performances.',
        'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop',
        NOW() + INTERVAL '14 days',
        NOW() + INTERVAL '14 days',
        NOW() + INTERVAL '14 days' + INTERVAL '4 hours',
        'Student Center Lounge',
        'd0000000-0000-0000-0000-000000000002'
    )
ON CONFLICT (id) DO NOTHING;

-- 6. Event RSVPs
INSERT INTO event_rsvps (id, event_id, user_id, checked_in)
VALUES
(
  'f0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  false
)
ON CONFLICT (id) DO NOTHING;

-- 7. Dummy Feed Posts
INSERT INTO posts (id, club_id, author_id, content)
VALUES
(
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001',
  'Welcome to the Tech Club! Looking forward to hacking together at our annual hackathon next week.'
),
(
  'a0000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000002',
  'Check out this weeks palette recommendations for watercolor painting! Feel free to share your works here.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO
    comments (
        id,
        post_id,
        author_id,
        content
    )
VALUES (
        'cc000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001',
        'd0000000-0000-0000-0000-000000000002',
        'Super excited! Cant wait to see what teams build.'
    )
ON CONFLICT (id) DO NOTHING;
