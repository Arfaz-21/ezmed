-- Create caregiver_alerts table for missed/snoozed notifications
CREATE TABLE public.caregiver_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  caregiver_id UUID NOT NULL,
  medication_log_id UUID NOT NULL REFERENCES public.medication_logs(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('missed', 'multiple_snooze')),
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.caregiver_alerts ENABLE ROW LEVEL SECURITY;

-- Caregivers can view their alerts
CREATE POLICY "Caregivers can view their alerts"
ON public.caregiver_alerts
FOR SELECT
USING (auth.uid() = caregiver_id);

-- Caregivers can update (mark as read) their alerts
CREATE POLICY "Caregivers can update their alerts"
ON public.caregiver_alerts
FOR UPDATE
USING (auth.uid() = caregiver_id);

-- System can insert alerts (via patient actions)
CREATE POLICY "System can insert alerts"
ON public.caregiver_alerts
FOR INSERT
WITH CHECK ((auth.uid() = patient_id) OR (get_linked_patient(auth.uid()) = patient_id));

-- Enable realtime for caregiver_alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.caregiver_alerts;