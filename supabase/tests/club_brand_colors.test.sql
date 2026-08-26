-- Test file: supabase/tests/club_brand_colors.test.sql
-- Issue: #1296 – per-club brand colors (dynamic club branding)
--
-- These pgTAP tests verify the `clubs.primary_color` / `clubs.secondary_color`
-- columns: the DEFAULT NULL semantics, and the strict hex-only CHECK
-- constraints that prevent CSS injection through club-supplied colors.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(27);

-- ════════════════════════════════════════════════════════════════════════════
-- 1.  Columns and constraints exist
-- ════════════════════════════════════════════════════════════════════════════

SELECT has_column('public', 'clubs', 'primary_color',
                  'clubs should have a primary_color column');
SELECT has_column('public', 'clubs', 'secondary_color',
                  'clubs should have a secondary_color column');

SELECT col_has_default('public', 'clubs', 'primary_color',
                       'primary_color should default to NULL');
SELECT col_has_default('public', 'clubs', 'secondary_color',
                       'secondary_color should default to NULL');

SELECT has_check(
    'public', 'clubs',
    'clubs should have a primary_color format check constraint'
);
SELECT has_check(
    'public', 'clubs',
    'clubs should have a secondary_color format check constraint'
);

SELECT constraint_col_is(
    'public', 'clubs', 'check_clubs_primary_color',
    ARRAY['primary_color'],
    'check_clubs_primary_color should operate on primary_color'
);
SELECT constraint_col_is(
    'public', 'clubs', 'check_clubs_secondary_color',
    ARRAY['secondary_color'],
    'check_clubs_secondary_color should operate on secondary_color'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 2.  Default / NULL means "use CampusConnect defaults"
-- ════════════════════════════════════════════════════════════════════════════

PREPARE insert_null_colors AS
    INSERT INTO public.clubs (name, slug, primary_color, secondary_color)
    VALUES ('Null Colors Club', 'null-colors-club', NULL, NULL);
SELECT lives_ok('insert_null_colors',
                'NULL colors should be allowed (club uses defaults)');

PREPARE insert_defaulted_colors AS
    INSERT INTO public.clubs (name, slug)
    VALUES ('Defaulted Colors Club', 'defaulted-colors-club');
SELECT lives_ok('insert_defaulted_colors',
                'Omitting colors should use the column defaults (NULL)');

-- ════════════════════════════════════════════════════════════════════════════
-- 3.  Valid hex colors (6-digit) are accepted
-- ════════════════════════════════════════════════════════════════════════════

PREPARE insert_valid_colors AS
    INSERT INTO public.clubs (name, slug, primary_color, secondary_color)
    VALUES ('Valid Colors Club', 'valid-colors-club', '#FF5733', '#3498DB');
SELECT lives_ok('insert_valid_colors',
                'Valid 6-digit hex colors should be accepted');

PREPARE insert_uppercase_hex AS
    INSERT INTO public.clubs (name, slug, primary_color, secondary_color)
    VALUES ('Uppercase Hex Club', 'uppercase-hex-club', '#ABCDEF', '#12EFAB');
SELECT lives_ok('insert_uppercase_hex',
                'Uppercase hex colors should be accepted');

-- ════════════════════════════════════════════════════════════════════════════
-- 4.  Valid 3-digit hex shorthand is accepted
-- ════════════════════════════════════════════════════════════════════════════

PREPARE insert_short_hex AS
    INSERT INTO public.clubs (name, slug, primary_color, secondary_color)
    VALUES ('Short Hex Club', 'short-hex-club', '#FFF', '#000');
SELECT lives_ok('insert_short_hex',
                'Valid 3-digit hex shorthand should be accepted');

-- ════════════════════════════════════════════════════════════════════════════
-- 5.  Non-hex / malformed values are rejected (SQLSTATE 23514)
-- ════════════════════════════════════════════════════════════════════════════

PREPARE insert_css_injection AS
    INSERT INTO public.clubs (name, slug, primary_color)
    VALUES ('CSS Injection Club', 'css-injection-club', '#FFF; display:none;');
SELECT throws_ok(
    'insert_css_injection', '23514', NULL,
    'CSS injection payload should be rejected for primary_color'
);

PREPARE insert_css_injection_secondary AS
    INSERT INTO public.clubs (name, slug, secondary_color)
    VALUES ('CSS Injection Club 2', 'css-injection-club-2', '#fff;background:red');
SELECT throws_ok(
    'insert_css_injection_secondary', '23514', NULL,
    'CSS injection payload should be rejected for secondary_color'
);

PREPARE insert_named_color AS
    INSERT INTO public.clubs (name, slug, primary_color)
    VALUES ('Named Color Club', 'named-color-club', 'red');
SELECT throws_ok(
    'insert_named_color', '23514', NULL,
    'Named colors like red should be rejected'
);

PREPARE insert_rgb_function AS
    INSERT INTO public.clubs (name, slug, primary_color)
    VALUES ('Rgb Club', 'rgb-club', 'rgb(255,0,0)');
SELECT throws_ok(
    'insert_rgb_function', '23514', NULL,
    'rgb() function syntax should be rejected'
);

PREPARE insert_rgba_function AS
    INSERT INTO public.clubs (name, slug, primary_color)
    VALUES ('Rgba Club', 'rgba-club', 'rgba(255,0,0,0.5)');
SELECT throws_ok(
    'insert_rgba_function', '23514', NULL,
    'rgba() function syntax should be rejected'
);

PREPARE insert_url_function AS
    INSERT INTO public.clubs (name, slug, primary_color)
    VALUES ('Url Club', 'url-club', 'url(https://evil.example)');
SELECT throws_ok(
    'insert_url_function', '23514', NULL,
    'url() payloads should be rejected'
);

PREPARE insert_too_short AS
    INSERT INTO public.clubs (name, slug, primary_color)
    VALUES ('Too Short Club', 'too-short-club', '#FFF;');
SELECT throws_ok(
    'insert_too_short', '23514', NULL,
    'Trailing punctuation should be rejected'
);

PREPARE insert_four_digit AS
    INSERT INTO public.clubs (name, slug, primary_color)
    VALUES ('Four Digit Club', 'four-digit-club', '#FFFF');
SELECT throws_ok(
    'insert_four_digit', '23514', NULL,
    '4-digit hex should be rejected'
);

PREPARE insert_five_digit AS
    INSERT INTO public.clubs (name, slug, primary_color)
    VALUES ('Five Digit Club', 'five-digit-club', '#FFFFF');
SELECT throws_ok(
    'insert_five_digit', '23514', NULL,
    '5-digit hex should be rejected'
);

PREPARE insert_seven_digit AS
    INSERT INTO public.clubs (name, slug, primary_color)
    VALUES ('Seven Digit Club', 'seven-digit-club', '#FFFFFFFF');
SELECT throws_ok(
    'insert_seven_digit', '23514', NULL,
    '8-digit hex (with alpha) should be rejected'
);

PREPARE insert_hsl_function AS
    INSERT INTO public.clubs (name, slug, primary_color)
    VALUES ('Hsl Club', 'hsl-club', 'hsl(120, 100%, 50%)');
SELECT throws_ok(
    'insert_hsl_function', '23514', NULL,
    'hsl() function syntax should be rejected'
);

PREPARE insert_quoted_value AS
    INSERT INTO public.clubs (name, slug, primary_color)
    VALUES ('Quoted Club', 'quoted-club', '"#FFF"');
SELECT throws_ok(
    'insert_quoted_value', '23514', NULL,
    'Quoted values should be rejected'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 6.  Updates are validated the same way
-- ════════════════════════════════════════════════════════════════════════════

PREPARE update_valid_color AS
    UPDATE public.clubs
    SET primary_color = '#00AA55'
    WHERE slug = 'valid-colors-club';
SELECT lives_ok('update_valid_color',
                'Updating to a valid hex color should be accepted');

PREPARE update_invalid_color AS
    UPDATE public.clubs
    SET primary_color = 'not-a-color'
    WHERE slug = 'valid-colors-club';
SELECT throws_ok(
    'update_invalid_color', '23514', NULL,
    'Updating to an invalid color should be rejected'
);

SELECT * FROM finish();
ROLLBACK;
