import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, Bell, BellOff, BellRing, Volume2, VolumeX, 
  Settings, Clock, Vibrate, Moon, Sun, Shield, Monitor
} from 'lucide-react';

interface UserSettings {
  voiceRemindersEnabled: boolean;
  voiceVolume: number;
  repeatInterval: number; // minutes between voice reminder repeats
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  vibrationEnabled: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  voiceRemindersEnabled: true,
  voiceVolume: 80,
  repeatInterval: 1,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  vibrationEnabled: true,
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { isSupported: pushSupported, permission: pushPermission, requestPermission } = usePushNotifications();
  const [mounted, setMounted] = useState(false);
  
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('medease-settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  // Avoid hydration mismatch for theme
  useEffect(() => {
    setMounted(true);
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('medease-settings', JSON.stringify(settings));
  }, [settings]);

  const handleEnableNotifications = async () => {
    try {
      const granted = await requestPermission();
      if (granted) {
        toast({ title: 'Notifications enabled!', description: 'You\'ll receive reminders even when the app is closed' });
      } else {
        toast({ title: 'Permission denied', description: 'Please allow notifications in your browser settings', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast({ title: 'Error', description: 'Could not enable notifications', variant: 'destructive' });
    }
  };

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    toast({ title: 'Setting updated', description: 'Your preferences have been saved' });
  };

  const getNotificationStatusText = () => {
    if (pushPermission === 'granted') return 'Enabled';
    if (pushPermission === 'denied') return 'Blocked';
    return 'Not enabled';
  };

  const getNotificationStatusColor = () => {
    if (pushPermission === 'granted') return 'text-success';
    if (pushPermission === 'denied') return 'text-destructive';
    return 'text-muted-foreground';
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 pb-24">
      {/* Header */}
      <header className="flex items-center gap-4 mb-6">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate(-1)}
          className="h-12 w-12 rounded-full"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
      </header>

      <div className="space-y-4 max-w-lg mx-auto">
        {/* Theme / Dark Mode */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              {mounted && theme === 'dark' ? (
                <Moon className="h-5 w-5 text-primary" />
              ) : (
                <Sun className="h-5 w-5 text-primary" />
              )}
              Appearance
            </CardTitle>
            <CardDescription>
              Choose your preferred color theme
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={mounted && theme === 'light' ? 'default' : 'outline'}
                className="flex flex-col items-center gap-2 h-auto py-4"
                onClick={() => setTheme('light')}
              >
                <Sun className="h-5 w-5" />
                <span className="text-xs">Light</span>
              </Button>
              <Button
                variant={mounted && theme === 'dark' ? 'default' : 'outline'}
                className="flex flex-col items-center gap-2 h-auto py-4"
                onClick={() => setTheme('dark')}
              >
                <Moon className="h-5 w-5" />
                <span className="text-xs">Dark</span>
              </Button>
              <Button
                variant={mounted && theme === 'system' ? 'default' : 'outline'}
                className="flex flex-col items-center gap-2 h-auto py-4"
                onClick={() => setTheme('system')}
              >
                <Monitor className="h-5 w-5" />
                <span className="text-xs">System</span>
              </Button>
            </div>
          </CardContent>
        </Card>
        {/* Push Notifications */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              {pushPermission === 'granted' ? (
                <Bell className="h-5 w-5 text-success" />
              ) : pushPermission === 'denied' ? (
                <BellOff className="h-5 w-5 text-destructive" />
              ) : (
                <BellRing className="h-5 w-5 text-muted-foreground" />
              )}
              Push Notifications
            </CardTitle>
            <CardDescription>
              Get medication reminders even when the app is closed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Status</p>
                <p className={`text-sm ${getNotificationStatusColor()}`}>
                  {getNotificationStatusText()}
                </p>
              </div>
              {pushSupported && pushPermission !== 'granted' && (
                <Button onClick={handleEnableNotifications} size="sm">
                  Enable
                </Button>
              )}
              {pushPermission === 'granted' && (
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-success/20">
                  <Bell className="h-4 w-4 text-success" />
                </div>
              )}
            </div>
            {pushPermission === 'denied' && (
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                Notifications are blocked. Please enable them in your browser settings and refresh the page.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Voice Reminders - Only show for patients */}
        {role === 'patient' && (
          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                {settings.voiceRemindersEnabled ? (
                  <Volume2 className="h-5 w-5 text-primary" />
                ) : (
                  <VolumeX className="h-5 w-5 text-muted-foreground" />
                )}
                Voice Reminders
              </CardTitle>
              <CardDescription>
                Hear spoken reminders when it's time to take your medication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="voice-enabled" className="text-base font-medium">
                  Enable voice reminders
                </Label>
                <Switch
                  id="voice-enabled"
                  checked={settings.voiceRemindersEnabled}
                  onCheckedChange={(checked) => updateSetting('voiceRemindersEnabled', checked)}
                />
              </div>

              {settings.voiceRemindersEnabled && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base">Volume</Label>
                      <span className="text-sm text-muted-foreground">{settings.voiceVolume}%</span>
                    </div>
                    <Slider
                      value={[settings.voiceVolume]}
                      onValueChange={([value]) => updateSetting('voiceVolume', value)}
                      max={100}
                      min={20}
                      step={10}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Repeat every
                      </Label>
                      <span className="text-sm text-muted-foreground">{settings.repeatInterval} min</span>
                    </div>
                    <Slider
                      value={[settings.repeatInterval]}
                      onValueChange={([value]) => updateSetting('repeatInterval', value)}
                      max={5}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Voice reminders will repeat every {settings.repeatInterval} minute(s) until you respond
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quiet Hours */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Moon className="h-5 w-5 text-primary" />
              Quiet Hours
            </CardTitle>
            <CardDescription>
              Silence notifications during specific hours
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="quiet-hours" className="text-base font-medium">
                Enable quiet hours
              </Label>
              <Switch
                id="quiet-hours"
                checked={settings.quietHoursEnabled}
                onCheckedChange={(checked) => updateSetting('quietHoursEnabled', checked)}
              />
            </div>

            {settings.quietHoursEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">From</Label>
                  <input
                    type="time"
                    value={settings.quietHoursStart}
                    onChange={(e) => updateSetting('quietHoursStart', e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">To</Label>
                  <input
                    type="time"
                    value={settings.quietHoursEnd}
                    onChange={(e) => updateSetting('quietHoursEnd', e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vibration */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Vibrate className="h-5 w-5 text-primary" />
              Vibration
            </CardTitle>
            <CardDescription>
              Vibrate device when reminders trigger (on supported devices)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="vibration" className="text-base font-medium">
                Enable vibration
              </Label>
              <Switch
                id="vibration"
                checked={settings.vibrationEnabled}
                onCheckedChange={(checked) => updateSetting('vibrationEnabled', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Privacy Note */}
        <Card className="border border-muted bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Your privacy matters</p>
                <p className="text-xs text-muted-foreground mt-1">
                  All settings are stored locally on your device. Your medication data is securely stored and only shared with your linked caregiver.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
