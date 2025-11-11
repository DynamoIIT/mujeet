-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away', 'busy')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create servers table
CREATE TABLE public.servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon_url TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create channels table
CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'voice')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create server_members table
CREATE TABLE public.server_members (
  server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (server_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Servers policies
CREATE POLICY "Servers viewable by members" ON public.servers FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.server_members 
    WHERE server_members.server_id = servers.id 
    AND server_members.user_id = auth.uid()
  ) OR owner_id = auth.uid());

CREATE POLICY "Authenticated users can create servers" ON public.servers FOR INSERT 
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Server owners can update their servers" ON public.servers FOR UPDATE 
  USING (auth.uid() = owner_id);

CREATE POLICY "Server owners can delete their servers" ON public.servers FOR DELETE 
  USING (auth.uid() = owner_id);

-- Channels policies
CREATE POLICY "Channels viewable by server members" ON public.channels FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.server_members 
    WHERE server_members.server_id = channels.server_id 
    AND server_members.user_id = auth.uid()
  ));

CREATE POLICY "Server owners can create channels" ON public.channels FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.servers 
    WHERE servers.id = channels.server_id 
    AND servers.owner_id = auth.uid()
  ));

CREATE POLICY "Server owners can update channels" ON public.channels FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.servers 
    WHERE servers.id = channels.server_id 
    AND servers.owner_id = auth.uid()
  ));

CREATE POLICY "Server owners can delete channels" ON public.channels FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.servers 
    WHERE servers.id = channels.server_id 
    AND servers.owner_id = auth.uid()
  ));

-- Messages policies
CREATE POLICY "Messages viewable by channel members" ON public.messages FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.channels 
    JOIN public.server_members ON server_members.server_id = channels.server_id
    WHERE channels.id = messages.channel_id 
    AND server_members.user_id = auth.uid()
  ));

CREATE POLICY "Server members can send messages" ON public.messages FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.channels 
    JOIN public.server_members ON server_members.server_id = channels.server_id
    WHERE channels.id = messages.channel_id 
    AND server_members.user_id = auth.uid()
  ) AND auth.uid() = user_id);

CREATE POLICY "Users can delete own messages" ON public.messages FOR DELETE 
  USING (auth.uid() = user_id);

-- Server members policies
CREATE POLICY "Members viewable by server members" ON public.server_members FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.server_members sm 
    WHERE sm.server_id = server_members.server_id 
    AND sm.user_id = auth.uid()
  ));

CREATE POLICY "Server owners can add members" ON public.server_members FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.servers 
    WHERE servers.id = server_members.server_id 
    AND servers.owner_id = auth.uid()
  ));

CREATE POLICY "Users can leave servers" ON public.server_members FOR DELETE 
  USING (auth.uid() = user_id);

-- Create function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamps trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add update trigger to profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.servers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;