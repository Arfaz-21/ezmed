import { useEffect, useState } from 'react';
import { Mic, MicOff, Check, Clock, X, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoiceCommandPopupProps {
  isOpen: boolean;
  isListening: boolean;
  transcript: string;
  medicationName: string;
  onTaken: () => void;
  onSnooze: () => void;
  onClose: () => void;
  onStartListening: () => void;
  voiceSupported: boolean;
  confidence?: number;
}

export default function VoiceCommandPopup({
  isOpen,
  isListening,
  transcript,
  medicationName,
  onTaken,
  onSnooze,
  onClose,
  onStartListening,
  voiceSupported,
  confidence = 0,
}: VoiceCommandPopupProps) {
  const [pulseCount, setPulseCount] = useState(0);

  // Animate pulse for attention
  useEffect(() => {
    if (isOpen && !isListening) {
      const interval = setInterval(() => {
        setPulseCount(prev => prev + 1);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, isListening]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-card border-4 border-primary rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Volume2 className="h-8 w-8 text-white" />
            <h2 className="text-2xl font-bold text-white">Time for Medication!</h2>
          </div>
          <p className="text-white/90 text-xl font-semibold">{medicationName}</p>
        </div>

        {/* Voice Command Section */}
        <div className="p-6">
          {voiceSupported ? (
            <>
              {/* Microphone visual */}
              <div className="flex flex-col items-center mb-6">
                <div 
                  className={cn(
                    "relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300",
                    isListening 
                      ? "bg-primary/20 border-4 border-primary animate-pulse" 
                      : "bg-muted/30 border-4 border-muted-foreground/30"
                  )}
                  key={pulseCount}
                >
                  {isListening ? (
                    <Mic className="h-16 w-16 text-primary animate-bounce" />
                  ) : (
                    <MicOff className="h-16 w-16 text-muted-foreground" />
                  )}
                  
                  {/* Listening rings */}
                  {isListening && (
                    <>
                      <div className="absolute inset-0 rounded-full border-4 border-primary/50 animate-ping" />
                      <div className="absolute inset-[-8px] rounded-full border-2 border-primary/30 animate-pulse" />
                    </>
                  )}
                </div>

                {/* Status text */}
                <div className="mt-4 text-center">
                  {isListening ? (
                    <div className="space-y-2">
                      <p className="text-xl font-bold text-primary animate-pulse">
                        🎤 I'm Listening...
                      </p>
                      <p className="text-lg text-muted-foreground">
                        Say <span className="font-bold text-success">"TAKEN"</span> or <span className="font-bold text-warning">"SNOOZE"</span>
                      </p>
                      {transcript && (
                        <div className="mt-3 p-3 bg-muted/50 rounded-xl">
                          <p className="text-lg italic">"{transcript}"</p>
                          {confidence > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Confidence: {Math.round(confidence * 100)}%
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-lg text-muted-foreground">
                        Tap the microphone or button below
                      </p>
                      <Button
                        onClick={onStartListening}
                        size="lg"
                        className="mt-2 h-14 px-8 text-lg font-bold bg-primary hover:bg-primary/90"
                      >
                        <Mic className="h-6 w-6 mr-2" />
                        Start Listening
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-muted-foreground/30" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-card px-4 text-muted-foreground">or use buttons</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center mb-4 p-4 bg-warning/10 rounded-xl border border-warning/30">
              <p className="text-warning font-medium">
                Voice commands not supported in this browser
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Please use the buttons below
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 mt-6">
            <Button
              onClick={onTaken}
              className="w-full h-20 text-2xl font-bold bg-gradient-to-r from-success to-success/80 hover:from-success/90 hover:to-success/70 shadow-lg"
            >
              <Check className="h-10 w-10 mr-3" />
              TAKEN ✓
            </Button>
            
            <Button
              onClick={onSnooze}
              variant="outline"
              className="w-full h-16 text-xl font-semibold border-2 border-warning text-warning hover:bg-warning/10"
            >
              <Clock className="h-8 w-8 mr-3" />
              SNOOZE 10 min
            </Button>
            
            <Button
              onClick={onClose}
              variant="ghost"
              className="w-full h-12 text-lg text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5 mr-2" />
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
