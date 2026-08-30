-- supabase/tests/tax_exempt_receipt.test.sql
-- pgTAP tests for Automated "Tax-Exempt" Receipt Generation

BEGIN;
SELECT plan(6);

-- 1. Verify columns exist on public.clubs
SELECT has_column('clubs', 'is_tax_exempt', 'clubs table has is_tax_exempt column');
SELECT has_column('clubs', 'tax_id_ein', 'clubs table has tax_id_ein column');

-- 2. Verify column types and defaults
SELECT col_type_is('clubs', 'is_tax_exempt', 'boolean', 'is_tax_exempt is boolean');
SELECT col_default_is('clubs', 'is_tax_exempt', 'false', 'is_tax_exempt defaults to false');
SELECT col_type_is('clubs', 'tax_id_ein', 'text', 'tax_id_ein is text');

-- 3. Test insert and select of tax exempt club
INSERT INTO public.clubs (name, slug, description, is_tax_exempt, tax_id_ein)
VALUES ('Tax Exempt Club', 'tax-exempt-club', 'A 501(c)(3) verified student organization.', true, '12-3456789');

SELECT results_eq(
    $$ SELECT is_tax_exempt, tax_id_ein FROM public.clubs WHERE slug = 'tax-exempt-club' $$,
    $$ VALUES (true, '12-3456789'::text) $$,
    'should correctly insert and retrieve tax exempt parameters'
);

SELECT * FROM finish();
ROLLBACK;
