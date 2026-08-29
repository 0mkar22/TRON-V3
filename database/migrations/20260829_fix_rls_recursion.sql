-- 1. Create a Secure Definer function to check org membership without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER SET search_path = public
AS $x
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members 
    WHERE org_id = check_org_id AND user_id = auth.uid()
  );
END;
$x LANGUAGE plpgsql;

-- 2. Drop the recursive policies
DROP POLICY IF EXISTS "organization_members_select" ON organization_members;
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "organizations_select" ON organizations;
DROP POLICY IF EXISTS "workflows_select" ON workflows;
DROP POLICY IF EXISTS "repositories_select" ON repositories;
DROP POLICY IF EXISTS "integrations_select" ON integrations;
DROP POLICY IF EXISTS "project_assignments_select" ON project_assignments;

-- 3. Recreate them using the new function
CREATE POLICY "organization_members_select" ON organization_members
    FOR SELECT USING (user_id = auth.uid() OR public.is_org_member(org_id));

CREATE POLICY "users_select" ON users
    FOR SELECT USING (id = auth.uid() OR EXISTS (
        SELECT 1 FROM organization_members om 
        WHERE om.user_id = users.id AND public.is_org_member(om.org_id)
    ));

CREATE POLICY "organizations_select" ON organizations
    FOR SELECT USING (public.is_org_member(id));

CREATE POLICY "workflows_select" ON workflows
    FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY "repositories_select" ON repositories
    FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY "integrations_select" ON integrations
    FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY "project_assignments_select" ON project_assignments
    FOR SELECT USING (public.is_org_member(org_id));
