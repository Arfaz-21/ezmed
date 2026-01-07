import { useEffect, useState } from 'react';
import { Check, Clock, X, Mic, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceCommandFeedbackProps {
  isListening: boolean;
  transcript: string;
  lastCommand: { text: string; recognized: boolean; command?: string } | null;
  confidence?: number;
  error?: string | null;
}

export default function VoiceCommandFeedback({
  isListening,
  transcript,
  lastCommand,
  confidence = 0,
  error,
}: VoiceCommandFeedbackProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [successType, setSuccessType] = useState<'taken' | 'snooze' | 'skip' | null>(null);

  // Show success animation when command is recognized
  useEffect(() => {
    if (lastCommand?.recognized && lastCommand.command) {
      setSuccessType(lastCommand.command as 'taken' | 'snooze' | 'skip');
      setShowSuccess(true);
      
      // Haptic feedback on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
      
      const timer = setTimeout(() => {
        setShowSuccess(false);
        setSuccessType(null);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [lastCommand]);

  // Get confidence color
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return 'text-success';
    if (conf >= 0.5) return 'text-warning';
    return 'text-destructive';
  };

  // Success animation overlay
  if (showSuccess) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className={cn(
          "flex flex-col items-center justify-center p-8 rounded-3xl animate-scale-in",
          successType === 'taken' && "bg-success/20 border-4 border-success",
          successType === 'snooze' && "bg-warning/20 border-4 border-warning",
          successType === 'skip' && "bg-muted/20 border-4 border-muted-foreground"
        )}>
          {successType === 'taken' && (
            <>
              <Check className="h-24 w-24 text-success animate-bounce" />
              <p className="text-2xl font-bold text-success mt-4">Great Job!</p>
            </>
          )}
          {successType === 'snooze' && (
            <>
              <Clock className="h-24 w-24 text-warning animate-pulse" />
              <p className="text-2xl font-bold text-warning mt-4">Snoozed</p>
            </>
          )}
          {successType === 'skip' && (
            <>
              <X className="h-24 w-24 text-muted-foreground" />
              <p className="text-2xl font-bold text-muted-foreground mt-4">Skipped</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Listening indicator with waveform */}
      {isListening && (
        <div className="p-4 rounded-xl bg-primary/10 border-2 border-primary/30">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="relative">
              <Mic className="h-8 w-8 text-primary" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full animate-ping" />
            </div>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-primary rounded-full animate-pulse"
                  style={{
                    height: `${12 + Math.random() * 16}px`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
            <span className="text-lg font-bold text-primary">Listening...</span>
          </div>
          
          {/* Live transcript with confidence */}
          {transcript && (
            <div className="text-center">
              <p className="text-lg italic text-foreground">
                "{transcript}"
              </p>
              {confidence > 0 && (
                <p className={cn("text-xs mt-1", getConfidenceColor(confidence))}>
                  Confidence: {Math.round(confidence * 100)}%
                </p>
              )}
            </div>
          )}
          
          {!transcript && (
            <p className="text-center text-sm text-muted-foreground">
              Say "Taken", "Snooze", or "Help"...
            </p>
          )}
        </div>
      )}

      {/* Last command feedback */}
      {lastCommand && !isListening && !showSuccess && (
        <div className={cn(
          "p-4 rounded-xl border-2 transition-all",
          lastCommand.recognized 
            ? "bg-success/10 border-success/30" 
            : "bg-warning/10 border-warning/30"
        )}>
          <div className="flex items-center gap-3">
            {lastCommand.recognized ? (
              <Check className="h-6 w-6 text-success flex-shrink-0" />
            ) : (
              <AlertCircle className="h-6 w-6 text-warning flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className={cn(
                "font-medium",
                lastCommand.recognized ? "text-success" : "text-warning"
              )}>
                {lastCommand.recognized 
                  ? `✓ Recognized: "${lastCommand.text}"` 
                  : `Didn't understand: "${lastCommand.text}"`
                }
              </p>
              {!lastCommand.recognized && (
                <p className="text-sm text-muted-foreground mt-1">
                  Try saying "Taken", "Snooze", or "Help"
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="text-sm text-destructive text-center flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        </div>
      )}
    </div>
  );
}
