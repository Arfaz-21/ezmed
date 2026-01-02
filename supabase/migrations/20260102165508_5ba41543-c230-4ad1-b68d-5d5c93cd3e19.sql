-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('patient', 'caregiver');

-- Create enum for medication status
CREATE TYPE public.medication_status AS ENUM ('pending', 'taken', 'snoozed', 'missed');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create patient_codes table for linking
CREATE TABLE public.patient_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  code VARCHAR(8) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '24 hours') NOT NULL
);

-- Create patient_caregiver_links table
CREATE TABLE public.patient_caregiver_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  caregiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (patient_id, caregiver_id)
);

-- Create medications table
CREATE TABLE public.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  scheduled_time TIME NOT NULL,
  frequency TEXT DEFAULT 'daily' NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL
);

-- Create medication_logs table
CREATE TABLE public.medication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID REFERENCES public.medications(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  status medication_status DEFAULT 'pending' NOT NULL,
  action_taken_at TIMESTAMP WITH TIME ZONE,
  snooze_count INTEGER DEFAULT 0,
  snoozed_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (medication_id, scheduled_date)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_caregiver_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get linked patient for a caregiver
CREATE OR REPLACE FUNCTION public.get_linked_patient(_caregiver_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT patient_id
  FROM public.patient_caregiver_links
  WHERE caregiver_id = _caregiver_id
    AND status = 'approved'
  LIMIT 1
$$;

-- Function to generate unique patient code
CREATE OR REPLACE FUNCTION public.generate_patient_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Patient codes policies
CREATE POLICY "Patients can manage their codes"
  ON public.patient_codes FOR ALL
  USING (auth.uid() = patient_id);

CREATE POLICY "Anyone can read codes for linking"
  ON public.patient_codes FOR SELECT
  USING (true);

-- Patient-caregiver links policies
CREATE POLICY "Patients can view their links"
  ON public.patient_caregiver_links FOR SELECT
  USING (auth.uid() = patient_id OR auth.uid() = caregiver_id);

CREATE POLICY "Caregivers can request links"
  ON public.patient_caregiver_links FOR INSERT
  WITH CHECK (auth.uid() = caregiver_id);

CREATE POLICY "Patients can approve/update links"
  ON public.patient_caregiver_links FOR UPDATE
  USING (auth.uid() = patient_id);

CREATE POLICY "Either party can delete links"
  ON public.patient_caregiver_links FOR DELETE
  USING (auth.uid() = patient_id OR auth.uid() = caregiver_id);

-- Medications policies
CREATE POLICY "Patients can view their medications"
  ON public.medications FOR SELECT
  USING (auth.uid() = patient_id OR public.get_linked_patient(auth.uid()) = patient_id);

CREATE POLICY "Caregivers can manage linked patient medications"
  ON public.medications FOR INSERT
  WITH CHECK (public.get_linked_patient(auth.uid()) = patient_id);

CREATE POLICY "Caregivers can update linked patient medications"
  ON public.medications FOR UPDATE
  USING (public.get_linked_patient(auth.uid()) = patient_id);

CREATE POLICY "Caregivers can delete linked patient medications"
  ON public.medications FOR DELETE
  USING (public.get_linked_patient(auth.uid()) = patient_id);

-- Medication logs policies
CREATE POLICY "Patients can view their logs"
  ON public.medication_logs FOR SELECT
  USING (auth.uid() = patient_id OR public.get_linked_patient(auth.uid()) = patient_id);

CREATE POLICY "Patients can update their logs"
  ON public.medication_logs FOR UPDATE
  USING (auth.uid() = patient_id);

CREATE POLICY "System can insert logs"
  ON public.medication_logs FOR INSERT
  WITH CHECK (auth.uid() = patient_id OR public.get_linked_patient(auth.uid()) = patient_id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable realtime for medication_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.medication_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_caregiver_links;