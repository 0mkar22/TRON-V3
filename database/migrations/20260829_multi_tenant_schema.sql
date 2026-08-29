CREATE TABLE organization_members (
    org_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role TEXT NOT NULL,
    PRIMARY KEY (org_id, user_id)
);

ALTER TABLE users DROP COLUMN org_id;
ALTER TABLE users DROP COLUMN role;
