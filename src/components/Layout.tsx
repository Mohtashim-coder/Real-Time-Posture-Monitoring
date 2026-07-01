import React, { useState, useEffect } from 'react';
import { Home, BarChart3, User, Bluetooth, Activity, Moon, Sun, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { useUserProfile } from '../hooks/useUserProfile';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isConnected?: boolean;
  onConnect?: () => void;
  disableSwipe?: boolean;
}

export function Layout({ children, activeTab, setActiveTab, isConnected = true, onConnect, disableSwipe = false }: LayoutProps) {
  const { profile } = useUserProfile();
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance (in px) to trigger tab change
  const minSwipeDistance = 50;
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#1E293B');
    } else {
      document.documentElement.classList.remove('dark');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#FFFFFF');
    }
  }, [isDarkMode]);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const onTouchStart = (e: React.TouchEvent) => {
    if (disableSwipe) return;
    setTouchEnd(null); // otherwise the swipe is fired even with usual touch events
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (disableSwipe) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (disableSwipe) return;
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    const currentIndex = navItems.findIndex(item => item.id === activeTab);

    if (isLeftSwipe && currentIndex < navItems.length - 1) {
      // Swiped left, go to next tab
      setActiveTab(navItems[currentIndex + 1].id);
    }

    if (isRightSwipe && currentIndex > 0) {
      // Swiped right, go to previous tab
      setActiveTab(navItems[currentIndex - 1].id);
    }
  };

  return (
    <div className="h-[100dvh] bg-surface flex flex-col w-full overflow-hidden selection:bg-primary/20">
      {/* Premium Glass Header */}
      <header className="sticky top-0 z-50 bg-surface-elevated/80 backdrop-blur-xl border-b border-outline-variant/10 px-4 py-3 safe-top shadow-sm">
        <div className="max-w-md mx-auto flex justify-between items-center px-0.5">
          <div className="flex items-center gap-1.5">
            {activeTab !== 'home' && (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setActiveTab('home')}
                className="p-2 -ml-2 text-on-surface-muted hover:text-primary transition-all active:scale-90"
              >
                <ArrowLeft className="w-5.5 h-5.5" />
              </motion.button>
            )}
            <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg group-hover:bg-primary/30 transition-all" />
              <div className="w-10 h-10 rounded-full shadow-md relative z-10 border border-white/10 overflow-hidden bg-surface-dim flex items-center justify-center">
                {profile.photo ? (
                  <img src={profile.photo} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-on-surface-muted" />
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm sm:text-base font-black text-on-surface tracking-tight truncate font-manrope">
                Posture <span className="text-primary">Monitor</span>
              </h1>
              <span className="text-[9px] font-black text-on-surface-muted/60 uppercase tracking-[0.2em] -mt-1">FOR UPPER BODY</span>
            </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-xl bg-surface-dim/50 text-on-surface-variant hover:text-primary transition-all active:scale-90 border border-outline-variant/10 shadow-sm"
              aria-label="Toggle Theme"
            >
              {isDarkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>
            <button
              onClick={onConnect}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm border active:scale-95 hover:brightness-110",
                isConnected
                  ? "bg-success/10 text-success border-success/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                  : "bg-surface-dim/80 text-on-surface-muted border-outline-variant/10"
              )}
            >
              <div className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-success animate-pulse" : "bg-on-surface-muted")} />
              <Bluetooth className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isConnected ? 'Online' : 'Offline'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main 
        className="flex-1 relative overflow-hidden flex flex-col"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="max-w-md mx-auto w-full h-full flex flex-col relative px-1.5">
          <div className="flex-1 overflow-y-auto scroll-smooth hide-scrollbar pt-4">
            {children}
          </div>
        </div>
      </main>

      {/* Premium Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface-elevated/80 backdrop-blur-2xl border-t border-outline-variant/10 z-50 safe-bottom">
        <div className="max-w-md mx-auto flex justify-around items-center px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex flex-col items-center justify-center py-2 px-4 transition-all duration-400 relative",
                  isActive ? "text-primary" : "text-on-surface-muted/60"
                )}
              >
                {isActive && (
                  <motion.div 
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-primary/5 rounded-2xl -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <div className={cn(
                  "relative p-1.5 transition-all duration-300",
                  isActive && "scale-110"
                )}>
                  <Icon className={cn("w-6 h-6 transition-all")} strokeWidth={isActive ? 2.5 : 2} />
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_rgba(13,148,136,0.6)]" />
                  )}
                </div>
                <span className={cn(
                  "text-[9px] mt-1 font-black uppercase tracking-[0.2em] transition-all",
                  isActive ? "opacity-100" : "opacity-0 scale-95"
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
