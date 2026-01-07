-- Fix 1: Remove overly permissive patient_codes SELECT policy
DROP POLICY IF EXISTS "Anyone can read codes for linking" ON public.patient_codes;

-- Create a secure function to verify a patient code without exposing all codes
CREATE OR REPLACE FUNCTION public.verify_patient_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _patient_id uuid;
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find valid code
  SELECT patient_id INTO _patient_id
  FROM patient_codes
  WHERE code = upper(_code)
    AND expires_at > now();

  -- Return patient_id if found (NULL if not found)
  RETURN _patient_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.verify_patient_code(text) TO authenticated;

-- Fix 2: Make medicine-images bucket private
UPDATE storage.buckets SET public = false WHERE id = 'medicine-images';

-- Remove the public SELECT policy
DROP POLICY IF EXISTS "Anyone can view medicine images" ON storage.objects;

-- Create a proper RLS policy for medicine images - only owner or linked caregiver can view
CREATE POLICY "Users can view their medicine images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'medicine-images' 
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (storage.foldername(name))[1] = get_linked_patient(auth.uid())::text
    )
  );