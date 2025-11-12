-- Create mentions table
CREATE TABLE public.mentions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL,
  mentioned_user_id UUID NOT NULL,
  channel_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

-- Users can view their mentions
CREATE POLICY "Users can view their mentions"
ON public.mentions
FOR SELECT
USING (auth.uid() = mentioned_user_id);

-- Anyone can create mentions
CREATE POLICY "Authenticated users can create mentions"
ON public.mentions
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create unread_messages table
CREATE TABLE public.unread_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel_id UUID NOT NULL,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unread_count INT NOT NULL DEFAULT 0,
  has_mention BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.unread_messages ENABLE ROW LEVEL SECURITY;

-- Users can view their own unread messages
CREATE POLICY "Users can view their own unread messages"
ON public.unread_messages
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own unread messages
CREATE POLICY "Users can update their own unread messages"
ON public.unread_messages
FOR ALL
USING (auth.uid() = user_id);
