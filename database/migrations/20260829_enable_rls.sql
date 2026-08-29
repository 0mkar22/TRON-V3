-- Enable Row-Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 1. Policies for `organizations`
CREATE POLICY "organizations_select" ON organizations
    FOR SELECT
    USING (id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "organizations_insert" ON organizations
    FOR INSERT
    WITH CHECK (id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "organizations_update" ON organizations
    FOR UPDATE
    USING (id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "organizations_delete" ON organizations
    FOR DELETE
    USING (id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

-- 2. Policies for `organization_members`
CREATE POLICY "organization_members_select" ON organization_members
    FOR SELECT
    USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "organization_members_insert" ON organization_members
    FOR INSERT
    WITH CHECK (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "organization_members_update" ON organization_members
    FOR UPDATE
    USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "organization_members_delete" ON organization_members
    FOR DELETE
    USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

-- 3. Policies for `integrations`
CREATE POLICY "integrations_select" ON integrations
    FOR SELECT
    USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "integrations_insert" ON integrations
    FOR INSERT
    WITH CHECK (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "integrations_update" ON integrations
    FOR UPDATE
    USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "integrations_delete" ON integrations
    FOR DELETE
    USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

-- 4. Policies for `project_assignments`
CREATE POLICY "project_assignments_select" ON project_assignments
    FOR SELECT
    USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "project_assignments_insert" ON project_assignments
    FOR INSERT
    WITH CHECK (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "project_assignments_update" ON project_assignments
    FOR UPDATE
    USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "project_assignments_delete" ON project_assignments
    FOR DELETE
    USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

-- 5. Policies for `users`
-- Note: users don't have an org_id directly, so we check if the user shares an org with the requester
CREATE POLICY "users_select" ON users
    FOR SELECT
    USING (
        id = auth.uid() OR
        id IN (
            SELECT user_id FROM organization_members 
            WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "users_insert" ON users
    FOR INSERT
    WITH CHECK (id = auth.uid());

CREATE POLICY "users_update" ON users
    FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY "users_delete" ON users
    FOR DELETE
    USING (id = auth.uid());
