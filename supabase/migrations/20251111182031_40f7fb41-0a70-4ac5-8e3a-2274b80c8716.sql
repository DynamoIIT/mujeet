-- Create friend requests table
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

-- Create friendships table
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_1 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id_2 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id_1, user_id_2),
  CHECK (user_id_1 < user_id_2)
);

-- Create DM channels table
CREATE TABLE IF NOT EXISTS public.dm_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_1 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id_2 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id_1, user_id_2),
  CHECK (user_id_1 < user_id_2)
);

-- Enable RLS
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_channels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for friend_requests
CREATE POLICY "Users can view their own friend requests"
ON public.friend_requests FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send friend requests"
ON public.friend_requests FOR INSERT
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update received requests"
ON public.friend_requests FOR UPDATE
USING (auth.uid() = receiver_id);

CREATE POLICY "Users can delete their own requests"
ON public.friend_requests FOR DELETE
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- RLS Policies for friendships
CREATE POLICY "Users can view their friendships"
ON public.friendships FOR SELECT
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

CREATE POLICY "System creates friendships"
ON public.friendships FOR INSERT
WITH CHECK (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

CREATE POLICY "Users can delete their friendships"
ON public.friendships FOR DELETE
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- RLS Policies for dm_channels
CREATE POLICY "Users can view their DM channels"
ON public.dm_channels FOR SELECT
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

CREATE POLICY "Friends can create DM channels"
ON public.dm_channels FOR INSERT
WITH CHECK (
  auth.uid() = user_id_1 OR auth.uid() = user_id_2
);

-- Update messages table to support DM channels
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_channel_id_fkey;

-- Add RLS policy for DM messages
CREATE POLICY "Users can view DM messages"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.dm_channels
    WHERE dm_channels.id = messages.channel_id
    AND (dm_channels.user_id_1 = auth.uid() OR dm_channels.user_id_2 = auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM public.channels
    JOIN public.server_members ON server_members.server_id = channels.server_id
    WHERE channels.id = messages.channel_id
    AND server_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can send DM messages"
ON public.messages FOR INSERT
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.dm_channels
    WHERE dm_channels.id = messages.channel_id
    AND (dm_channels.user_id_1 = auth.uid() OR dm_channels.user_id_2 = auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM public.channels
    JOIN public.server_members ON server_members.server_id = channels.server_id
    WHERE channels.id = messages.channel_id
    AND server_members.user_id = auth.uid()
  ))
  AND auth.uid() = user_id
);

-- Add profile lighting color column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lighting_color text DEFAULT '#5865F2';

-- Enable realtime for DM channels and friend requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;