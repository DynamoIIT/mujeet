-- Fix recursion by using a SECURITY DEFINER function for membership checks
-- 1) Drop recursive servers policy
DROP POLICY IF EXISTS "Servers viewable by members" ON public.servers;

-- 2) Create helper function that bypasses RLS on server_members
CREATE OR REPLACE FUNCTION public.is_server_member(_server_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.server_members
    WHERE server_id = _server_id AND user_id = _user_id
  );
$$;

-- 3) Recreate servers SELECT policy using the helper function
CREATE POLICY "Servers viewable by members or owners"
ON public.servers
FOR SELECT
USING (public.is_server_member(id, auth.uid()) OR owner_id = auth.uid());

-- 4) Simplify server_members SELECT policy to avoid referencing servers
DROP POLICY IF EXISTS "Users can view server members" ON public.server_members;
CREATE POLICY "Users can view their own membership" ON public.server_members
FOR SELECT USING (auth.uid() = user_id);
