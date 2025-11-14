-- Add banner_url to servers table
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Allow server owners to update banner
-- (UPDATE policy already exists for server owners)