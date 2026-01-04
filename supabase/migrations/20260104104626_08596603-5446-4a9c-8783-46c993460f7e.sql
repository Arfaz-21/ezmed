-- Add emergency_alerts table for help button functionality
CREATE TABLE public.emergency_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  caregiver_id UUID NOT NULL,
  message TEXT NOT NULL DEFAULT 'Patient needs help!',
  is_acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.emergency_alerts ENABLE ROW LEVEL SECURITY;

-- Patients can insert emergency alerts
CREATE POLICY "Patients can create emergency alerts"
ON public.emergency_alerts
FOR INSERT
WITH CHECK (auth.uid() = patient_id);

-- Patients can view their own alerts
CREATE POLICY "Patients can view their emergency alerts"
ON public.emergency_alerts
FOR SELECT
USING (auth.uid() = patient_id OR auth.uid() = caregiver_id);

-- Caregivers can update (acknowledge) alerts
CREATE POLICY "Caregivers can acknowledge alerts"
ON public.emergency_alerts
FOR UPDATE
USING (auth.uid() = caregiver_id);

-- Enable realtime for emergency alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_alerts;