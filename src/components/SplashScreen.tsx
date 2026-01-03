import { useState, useEffect } from 'react';
import faviconLogo from '/favicon.png';

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
}

export default function SplashScreen({ onComplete, minDuration = 2000 }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      // Wait for fade animation to complete before calling onComplete
      setTimeout(onComplete, 500);
    }, minDuration);

    return () => clearTimeout(timer);
  }, [onComplete, minDuration]);

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Animated background circles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      {/* Logo container with animation */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Pulsing ring behind logo */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-32 rounded-full border-4 border-primary/30 animate-ping" style={{ animationDuration: '2s' }} />
        </div>
        
        {/* Logo with bounce animation */}
        <div className="relative animate-scale-in">
          <div className="w-28 h-28 rounded-2xl overflow-hidden shadow-2xl shadow-primary/25 animate-[bounce_2s_ease-in-out_infinite]" style={{ animationDuration: '2s' }}>
            <img 
              src={faviconLogo} 
              alt="MedEase Logo" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* App name with fade in */}
        <h1 
          className="mt-8 text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent animate-fade-in"
          style={{ animationDelay: '0.3s', animationFillMode: 'backwards' }}
        >
          MedEase
        </h1>
        
        {/* Tagline */}
        <p 
          className="mt-2 text-lg text-muted-foreground animate-fade-in"
          style={{ animationDelay: '0.5s', animationFillMode: 'backwards' }}
        >
          Your health companion
        </p>

        {/* Loading indicator */}
        <div 
          className="mt-8 flex items-center gap-2 animate-fade-in"
          style={{ animationDelay: '0.7s', animationFillMode: 'backwards' }}
        >
          <div className="flex gap-1.5">
            <div 
              className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <div 
              className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <div 
              className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
