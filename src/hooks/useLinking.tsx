import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface LinkRequest {
  id: string;
  caregiver_id: string;
  status: string;
  created_at: string;
}

interface LinkedPatient {
  id: string;
  patient_id: string;
  status: string;
}

export function useLinking() {
  const { user, role } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<LinkRequest[]>([]);
  const [linkedPatient, setLinkedPatient] = useState<LinkedPatient | null>(null);
  const [linkedCaregiver, setLinkedCaregiver] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLinks = async () => {
    if (!user) return;

    try {
      if (role === 'patient') {
        // Fetch pending link requests for patient
        const { data: pending, error: pendingError } = await supabase
          .from('patient_caregiver_links')
          .select('*')
          .eq('patient_id', user.id)
          .eq('status', 'pending');

        if (pendingError) throw pendingError;
        setPendingRequests(pending || []);

        // Fetch approved caregiver
        const { data: approved, error: approvedError } = await supabase
          .from('patient_caregiver_links')
          .select('caregiver_id')
          .eq('patient_id', user.id)
          .eq('status', 'approved')
          .maybeSingle();

        if (approvedError) throw approvedError;
        setLinkedCaregiver(approved?.caregiver_id || null);
      } else if (role === 'caregiver') {
        // Fetch linked patient for caregiver
        const { data, error } = await supabase
          .from('patient_caregiver_links')
          .select('*')
          .eq('caregiver_id', user.id)
          .maybeSingle();

        if (error) throw error;
        setLinkedPatient(data);
      }
    } catch (error) {
      console.error('Error fetching links:', error);
    }
  };

  useEffect(() => {
    fetchLinks();

    // Set up realtime subscription
    const channel = supabase
      .channel('link-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patient_caregiver_links'
        },
        () => {
          fetchLinks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role]);

  const linkWithCode = async (code: string) => {
    if (!user || role !== 'caregiver') return { error: new Error('Must be caregiver') };
    setLoading(true);

    try {
      // Verify patient code using secure RPC function (doesn't expose all codes)
      const { data: patientId, error: verifyError } = await supabase
        .rpc('verify_patient_code', { _code: code });

      if (verifyError) throw verifyError;
      if (!patientId) return { error: new Error('Invalid or expired code') };

      // Check if already linked
      const { data: existingLink } = await supabase
        .from('patient_caregiver_links')
        .select('id')
        .eq('caregiver_id', user.id)
        .maybeSingle();

      if (existingLink) {
        return { error: new Error('You are already linked to a patient') };
      }

      // Create link request
      const { error } = await supabase
        .from('patient_caregiver_links')
        .insert({
          patient_id: patientId,
          caregiver_id: user.id,
          status: 'pending'
        });

      if (error) throw error;
      
      await fetchLinks();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    } finally {
      setLoading(false);
    }
  };

  const approveRequest = async (requestId: string) => {
    if (!user || role !== 'patient') return { error: new Error('Must be patient') };
    setLoading(true);

    try {
      const { error } = await supabase
        .from('patient_caregiver_links')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', requestId)
        .eq('patient_id', user.id);

      if (error) throw error;
      
      await fetchLinks();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    } finally {
      setLoading(false);
    }
  };

  const rejectRequest = async (requestId: string) => {
    if (!user || role !== 'patient') return { error: new Error('Must be patient') };
    setLoading(true);

    try {
      const { error } = await supabase
        .from('patient_caregiver_links')
        .delete()
        .eq('id', requestId)
        .eq('patient_id', user.id);

      if (error) throw error;
      
      await fetchLinks();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    } finally {
      setLoading(false);
    }
  };

  const unlinkCaregiver = async () => {
    if (!user) return { error: new Error('Not authenticated') };
    setLoading(true);

    try {
      const { error } = await supabase
        .from('patient_caregiver_links')
        .delete()
        .or(`patient_id.eq.${user.id},caregiver_id.eq.${user.id}`);

      if (error) throw error;
      
      setLinkedPatient(null);
      setLinkedCaregiver(null);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    } finally {
      setLoading(false);
    }
  };

  return {
    pendingRequests,
    linkedPatient,
    linkedCaregiver,
    loading,
    linkWithCode,
    approveRequest,
    rejectRequest,
    unlinkCaregiver,
    refreshLinks: fetchLinks
  };
}
