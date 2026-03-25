import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface UserSettings {
  voiceRemindersEnabled: boolean;
  voiceVolume: number;
  repeatInterval: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  vibrationEnabled: boolean;
  voiceLanguage: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  voiceRemindersEnabled: true,
  voiceVolume: 80,
  repeatInterval: 1,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  vibrationEnabled: true,
  voiceLanguage: 'en-US',
};

const STORAGE_KEY = 'ezmed-settings';

export function useSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load settings from DB on mount
  useEffect(() => {
    if (!user) {
      setIsLoaded(true);
      return;
    }

    const loadFromDb = async () => {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('settings')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data?.settings) {
          const dbSettings = { ...DEFAULT_SETTINGS, ...(data.settings as Partial<UserSettings>) };
          setSettings(dbSettings);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(dbSettings));
        }
      } catch (e) {
        console.error('Failed to load settings from DB:', e);
      } finally {
        setIsLoaded(true);
      }
    };

    loadFromDb();
  }, [user]);

  // Debounced save to DB
  const saveToDb = useCallback((newSettings: UserSettings) => {
    if (!user) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('user_settings')
          .upsert({
            user_id: user.id,
            settings: newSettings as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (error) console.error('Failed to save settings to DB:', error);
      } catch (e) {
        console.error('Failed to save settings to DB:', e);
      }
    }, 500);
  }, [user]);

  const updateSetting = useCallback(<K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      saveToDb(next);
      return next;
    });
  }, [saveToDb]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { settings, updateSetting, isLoaded };
}
