CREATE TABLE IF NOT EXISTS organization_members (
    org_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role TEXT NOT NULL,
    PRIMARY KEY (org_id, user_id)
);

-- Safely copy existing user data to the new junction table
INSERT INTO organization_members (org_id, user_id, role)
SELECT org_id, id, role 
FROM users 
WHERE org_id IS NOT NULL 
ON CONFLICT (org_id, user_id) DO NOTHING;

-- Drop the old columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS org_id;
ALTER TABLE users DROP COLUMN IF EXISTS role;
