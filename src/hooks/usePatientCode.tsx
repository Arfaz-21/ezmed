import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function usePatientCode() {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCode = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('patient_codes')
        .select('code, expires_at')
        .eq('patient_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data && new Date(data.expires_at) > new Date()) {
        setCode(data.code);
      } else {
        setCode(null);
      }
    } catch (error) {
      console.error('Error fetching code:', error);
    }
  };

  useEffect(() => {
    fetchCode();
  }, [user]);

  const generateCode = async () => {
    if (!user) return null;
    setLoading(true);

    try {
      // Delete existing code
      await supabase
        .from('patient_codes')
        .delete()
        .eq('patient_id', user.id);

      // Generate new code using database function
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_patient_code');

      if (codeError) throw codeError;

      const newCode = codeData as string;

      // Insert new code
      const { error } = await supabase
        .from('patient_codes')
        .insert({
          patient_id: user.id,
          code: newCode
        });

      if (error) throw error;
      
      setCode(newCode);
      return newCode;
    } catch (error) {
      console.error('Error generating code:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { code, generateCode, loading, refreshCode: fetchCode };
}
