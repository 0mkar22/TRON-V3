CREATE TABLE IF NOT EXISTS public.organization_members (
    org_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'developer'::text,
    CONSTRAINT organization_members_pkey PRIMARY KEY (org_id, user_id),
    CONSTRAINT fk_organization_members_org FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_organization_members_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Safely copy existing user data to the new junction table
INSERT INTO public.organization_members (org_id, user_id, role)
SELECT org_id, id, role 
FROM public.users 
WHERE org_id IS NOT NULL 
ON CONFLICT (org_id, user_id) DO NOTHING;

-- Drop existing foreign key constraints on the old org_id column
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_org_id_fkey;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS fk_users_organization;

-- Drop the old columns from users table
ALTER TABLE public.users DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.users DROP COLUMN IF EXISTS role;
