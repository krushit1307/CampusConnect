-- Refactor club_roles to support JSONB permissions array
ALTER TABLE club_roles 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;

-- Seed default roles with precise scopes
UPDATE club_roles SET permissions = '["finance:write", "members:write", "events:write", "constitution:write"]'::jsonb WHERE title = 'President';
UPDATE club_roles SET permissions = '["finance:write", "finance:read"]'::jsonb WHERE title = 'Treasurer';
UPDATE club_roles SET permissions = '["events:write", "events:read", "members:read"]'::jsonb WHERE title = 'Marketing Director';
