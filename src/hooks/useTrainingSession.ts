import { useState, useEffect, useRef, useCallback } from 'react';

export interface TrainingSession {
  id: string;
  date: Date;
  duration: number; // seconds
  avgScore: number;
  bestScore: number;
  uprightPercent: number;
}

export interface TrainingProgram {
  currentDay: number;
  totalDays: number;
  dailyGoalMinutes: number;
  completedToday: boolean;
  todayMinutes: number;
}

export function useTrainingSession() {
  const [isTraining, setIsTraining] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionScores, setSessionScores] = useState<number[]>([]);
  const [sessionHistory, setSessionHistory] = useState<TrainingSession[]>([
    {
      id: '1',
      date: new Date(Date.now() - 86400000),
      duration: 900,
      avgScore: 87,
      bestScore: 95,
      uprightPercent: 88,
    },
    {
      id: '2',
      date: new Date(Date.now() - 172800000),
      duration: 720,
      avgScore: 82,
      bestScore: 91,
      uprightPercent: 83,
    },
    {
      id: '3',
      date: new Date(Date.now() - 259200000),
      duration: 1080,
      avgScore: 90,
      bestScore: 97,
      uprightPercent: 92,
    },
  ]);
  const [program, setProgram] = useState<TrainingProgram>({
    currentDay: 4,
    totalDays: 21,
    dailyGoalMinutes: 15,
    completedToday: false,
    todayMinutes: 0,
  });
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopVibration = useCallback(() => {
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  }, []);

  const startVibration = useCallback(() => {
    if (vibrationIntervalRef.current) return;
    
    const vibrate = () => {
      if ('vibrate' in navigator) {
        navigator.vibrate([300, 100, 300]);
      }
    };
    
    vibrate();
    vibrationIntervalRef.current = setInterval(vibrate, 1000);
  }, []);

  const stopTraining = useCallback((currentScore: number) => {
    setIsTraining(false);
    stopVibration();
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const scores = sessionScores.length > 0 ? sessionScores : [currentScore];
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const bestScore = Math.max(...scores);
    const uprightCount = scores.filter(s => s >= 75).length;
    const uprightPercent = Math.round((uprightCount / scores.length) * 100);

    const newSession: TrainingSession = {
      id: Date.now().toString(),
      date: new Date(),
      duration: elapsedSeconds,
      avgScore,
      bestScore,
      uprightPercent,
    };

    setSessionHistory(prev => [newSession, ...prev].slice(0, 30));

    // Update program
    const sessionMinutes = Math.floor(elapsedSeconds / 60);
    setProgram(prev => {
      const newTodayMinutes = prev.todayMinutes + sessionMinutes;
      const isNewlyCompleted = newTodayMinutes >= prev.dailyGoalMinutes && prev.todayMinutes < prev.dailyGoalMinutes;
      return {
        ...prev,
        todayMinutes: newTodayMinutes,
        completedToday: newTodayMinutes >= prev.dailyGoalMinutes,
        currentDay: isNewlyCompleted ? Math.min(prev.currentDay + 1, prev.totalDays) : prev.currentDay,
      };
    });

    return newSession;
  }, [elapsedSeconds, sessionScores, stopVibration]);

  const startTraining = useCallback(() => {
    setIsTraining(true);
    setElapsedSeconds(0);
    setSessionScores([]);

    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => {
        const next = prev + 1;
        // Auto-stop at 15 minutes (900 seconds)
        if (next >= 900) {
          // We can't call stopTraining directly here easily due to closure on sessionScores
          // So we'll let the component handle the auto-stop or use a ref for scores
          return next;
        }
        return next;
      });
    }, 1000);
  }, []);

  // Use an effect to monitor auto-stop
  useEffect(() => {
    if (isTraining && elapsedSeconds >= 900) {
      stopTraining(70); // Fallback score if none added yet
    }
  }, [elapsedSeconds, isTraining, stopTraining]);

  const addScore = useCallback((score: number) => {
    if (isTraining) {
      setSessionScores(prev => [...prev, score]);

      // Vibrate on bad posture during training
      if (vibrationEnabled) {
        if (score < 60) {
          startVibration();
        } else {
          stopVibration();
        }
      } else {
        stopVibration();
      }
    }
  }, [isTraining, vibrationEnabled, startVibration, stopVibration]);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (vibrationIntervalRef.current) clearInterval(vibrationIntervalRef.current);
    };
  }, []);

  return {
    isTraining,
    elapsedSeconds,
    sessionHistory,
    program,
    vibrationEnabled,
    setVibrationEnabled,
    startTraining,
    stopTraining,
    addScore,
    formatTime,
  };
}
