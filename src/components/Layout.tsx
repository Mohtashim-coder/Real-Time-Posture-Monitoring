import React, { useState, useEffect } from 'react';
import { Home, Dumbbell, BarChart3, User, Bluetooth, Activity, Moon, Sun } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isConnected?: boolean;
}

export function Layout({ children, activeTab, setActiveTab, isConnected = true }: LayoutProps) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || 
             window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'train', label: 'Train', icon: Dumbbell },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="h-[100dvh] bg-surface flex flex-col w-full overflow-hidden">
      {/* Top App Bar */}
      <header className="sticky top-0 z-50 bg-surface-elevated/90 backdrop-blur-xl border-b border-outline-variant/20 px-4 py-2 safe-top">
        <div className="max-w-lg mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg overflow-hidden bg-primary/10 flex items-center justify-center border border-primary/20">
              <img src="/logo.png" alt="Posture Monitor Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-sm sm:text-base font-bold text-on-surface tracking-tight truncate">Posture Monitor</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-1.5 rounded-full bg-surface-dim text-on-surface-variant hover:text-primary transition-colors"
            >
              {isDarkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
              isConnected
                ? "bg-success-light text-success"
                : "bg-danger-light text-danger"
            )}>
              <Bluetooth className="w-3 h-3" />
              <span className="hidden sm:inline">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-[68px] overflow-y-auto flex flex-col">
        <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
          {children}
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface-elevated/95 backdrop-blur-xl border-t border-outline-variant/20 z-50 safe-bottom">
        <div className="max-w-lg mx-auto flex justify-around items-center px-2 py-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex flex-col items-center justify-center py-2 px-4 rounded-2xl transition-all duration-300 active:scale-90 min-w-[64px]",
                  isActive
                    ? "text-primary"
                    : "text-on-surface-muted hover:text-on-surface-variant"
                )}
              >
                <div className={cn(
                  "relative p-1.5 rounded-xl transition-all duration-300",
                  isActive && "bg-primary-container"
                )}>
                  <Icon className={cn("w-5 h-5 transition-all", isActive && "scale-105")} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={cn(
                  "text-[10px] mt-0.5 font-medium transition-all",
                  isActive && "font-bold"
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
