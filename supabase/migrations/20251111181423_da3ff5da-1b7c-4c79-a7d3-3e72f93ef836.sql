-- Add profile customization fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#5865F2';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges TEXT[] DEFAULT '{}';

-- Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policies for banners
CREATE POLICY "Banner images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'banners');

CREATE POLICY "Users can upload their own banner"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'banners' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own banner"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'banners' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own banner"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'banners' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);