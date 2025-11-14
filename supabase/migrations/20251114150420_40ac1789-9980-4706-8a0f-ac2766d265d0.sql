-- Allow all authenticated users to view servers for search purposes
DROP POLICY IF EXISTS "Servers viewable by members or owners" ON public.servers;

CREATE POLICY "Authenticated users can view all servers"
ON public.servers
FOR SELECT
TO authenticated
USING (true);

-- Allow users to join servers by adding themselves to server_members
DROP POLICY IF EXISTS "Server owners can add members" ON public.server_members;

CREATE POLICY "Server owners can add members"
ON public.server_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM servers
    WHERE servers.id = server_members.server_id
    AND servers.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can join servers"
ON public.server_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);