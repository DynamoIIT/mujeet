-- Drop the problematic recursive policies
DROP POLICY IF EXISTS "Members viewable by server members" ON public.server_members;

-- Create a simpler, non-recursive policy for server_members
-- Users can see memberships where they are the member OR where they are in the same server
CREATE POLICY "Users can view server members" ON public.server_members FOR SELECT 
  USING (
    auth.uid() = user_id 
    OR 
    EXISTS (
      SELECT 1 FROM public.servers 
      WHERE servers.id = server_members.server_id 
      AND servers.owner_id = auth.uid()
    )
  );