-- Add image_url column to medications table
ALTER TABLE public.medications 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create storage bucket for medicine images
INSERT INTO storage.buckets (id, name, public)
VALUES ('medicine-images', 'medicine-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for medicine images
CREATE POLICY "Anyone can view medicine images"
ON storage.objects FOR SELECT
USING (bucket_id = 'medicine-images');

CREATE POLICY "Authenticated users can upload medicine images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'medicine-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own medicine images"
ON storage.objects FOR DELETE
USING (bucket_id = 'medicine-images' AND auth.uid()::text = (storage.foldername(name))[1]);