import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Square, Timer, Vibrate, Trophy, Calendar, ChevronRight, CheckCircle2, Award, Target, Zap } from 'lucide-react';
import { PostureAvatar } from './PostureAvatar';
import type { PostureData } from '../hooks/usePostureEngine';
import type { TrainingProgram, TrainingSession } from '../hooks/useTrainingSession';

interface ActivityProps {
  posture: PostureData;
  isTraining: boolean;
  elapsedSeconds: number;
  program: TrainingProgram;
  sessionHistory: TrainingSession[];
  vibrationEnabled: boolean;
  onStartTraining: () => void;
  onStopTraining: () => void;
  onToggleVibration: (v: boolean) => void;
  formatTime: (s: number) => string;
}

export function Activity({
  posture, isTraining, elapsedSeconds, program, sessionHistory,
  vibrationEnabled, onStartTraining, onStopTraining, onToggleVibration, formatTime,
}: ActivityProps) {
  const [showResults, setShowResults] = useState(false);
  const [lastCompletedSession, setLastCompletedSession] = useState<TrainingSession | null>(null);

  // Monitor session completion
  useEffect(() => {
    if (!isTraining && elapsedSeconds > 0) {
      const latest = sessionHistory[0];
      if (latest && (!lastCompletedSession || latest.id !== lastCompletedSession.id)) {
        setLastCompletedSession(latest);
        setShowResults(true);
      }
    }
  }, [isTraining, sessionHistory, elapsedSeconds, lastCompletedSession]);

  const goalPercent = Math.min(100, Math.round((program.todayMinutes / program.dailyGoalMinutes) * 100));
  const circumference = 2 * Math.PI * 90;

  // Total goal for session is 15 minutes (900 seconds)
  const sessionGoalSeconds = 900;
  const timerOffset = isTraining
    ? circumference - Math.min(1, elapsedSeconds / sessionGoalSeconds) * circumference
    : circumference;

  return (
    <div className="px-5 py-6 space-y-5 relative">
      <AnimatePresence>
        {showResults && lastCompletedSession && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[110] bg-surface/95 backdrop-blur-md flex items-center justify-center p-6"
          >
            <div className="w-full max-w-sm bg-surface-elevated rounded-[2.5rem] p-8 shadow-2xl border border-outline-variant/20 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-success-light rounded-full flex items-center justify-center mb-6 shadow-lg shadow-success/20">
                <Trophy className="w-10 h-10 text-success" />
              </div>

              <h2 className="text-2xl font-black text-on-surface mb-2">Session Complete!</h2>
              <p className="text-on-surface-muted text-sm mb-8 px-4">
                Great job! You've just completed your posture training session.
              </p>

              <div className="grid grid-cols-2 gap-4 w-full mb-8">
                <div className="bg-surface p-4 rounded-2xl border border-outline-variant/10">
                  <p className="text-[10px] font-bold text-on-surface-muted uppercase tracking-widest mb-1">Score</p>
                  <p className="text-2xl font-black text-primary">{lastCompletedSession.avgScore}</p>
                </div>
                <div className="bg-surface p-4 rounded-2xl border border-outline-variant/10">
                  <p className="text-[10px] font-bold text-on-surface-muted uppercase tracking-widest mb-1">Upright</p>
                  <p className="text-2xl font-black text-success">{lastCompletedSession.uprightPercent}%</p>
                </div>
                <div className="bg-surface p-4 rounded-2xl border border-outline-variant/10">
                  <p className="text-[10px] font-bold text-on-surface-muted uppercase tracking-widest mb-1">Duration</p>
                  <p className="text-2xl font-black text-on-surface">{Math.floor(lastCompletedSession.duration / 60)}m</p>
                </div>
                <div className="bg-surface p-4 rounded-2xl border border-outline-variant/10">
                  <p className="text-[10px] font-bold text-on-surface-muted uppercase tracking-widest mb-1">Best</p>
                  <p className="text-2xl font-black text-warning">{lastCompletedSession.bestScore}</p>
                </div>
              </div>

              <button
                onClick={() => setShowResults(false)}
                className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg shadow-lg shadow-primary/20 active:scale-[0.97] transition-all"
              >
                Continue Training
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Training Program Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-secondary to-secondary/80 rounded-2xl p-5 text-white overflow-hidden relative">
        <div className="absolute -right-6 -bottom-6 opacity-10">
          <Award size={120} />
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider opacity-80">Training Program</span>
          <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-bold">
            Day {program.currentDay}/{program.totalDays}
          </span>
        </div>
        <h2 className="text-xl font-extrabold mb-1">21-Day Posture Challenge</h2>
        <p className="text-sm opacity-80">Build lasting habits with daily training sessions</p>
        <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all duration-700"
            style={{ width: `${(program.currentDay / program.totalDays) * 100}%` }} />
        </div>
      </motion.div>

      {/* Training Control */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
        className="bg-surface-elevated rounded-3xl p-6 shadow-sm border border-outline-variant/10 flex flex-col items-center">

        {/* Timer Ring */}
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-surface-dim/30 animate-pulse" />
          <svg width="220" height="220" className="-rotate-90 relative">
            <circle cx="110" cy="110" r="90" fill="none" stroke="currentColor" strokeWidth="6" className="text-outline-variant/20" />
            <circle cx="110" cy="110" r="90" fill="none"
              stroke={posture.status === 'good' ? '#10B981' : posture.status === 'warning' ? '#F59E0B' : '#EF4444'}
              strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={timerOffset}
              className="transition-all duration-500 ease-out" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isTraining ? (
              <>
                <span className="text-4xl font-black text-on-surface font-mono tracking-tighter">
                  {formatTime(elapsedSeconds)}
                </span>
                <div className="flex items-center gap-1.5 mt-2 bg-surface/50 px-3 py-1 rounded-full border border-outline-variant/10">
                  <div className={`w-2 h-2 rounded-full ${posture.status === 'good' ? 'bg-success animate-pulse' : posture.status === 'warning' ? 'bg-warning' : 'bg-danger animate-bounce'
                    }`} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    {posture.status === 'good' ? 'Perfect' : posture.status === 'warning' ? 'Adjust' : 'Slouching'}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center">
                <PostureAvatar score={85} status="good" size={80} showPulse={false} />
                <span className="text-xs font-bold text-on-surface-muted mt-3 uppercase tracking-widest">Ready to train</span>
              </div>
            )}
          </div>
        </div>

        {/* Start/Stop Button */}
        <button onClick={isTraining ? onStopTraining : onStartTraining}
          className={`w-full py-4.5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all active:scale-[0.97] hover:brightness-105 ${isTraining
              ? 'bg-danger text-white shadow-xl shadow-danger/20'
              : 'bg-primary text-white shadow-xl shadow-primary/20'
            }`}>
          {isTraining ? <><Square className="w-5 h-5 fill-current" /> Stop Training</> : <><Play className="w-5 h-5 fill-current" /> Start Training</>}
        </button>

        {/* Daily Goal Info */}
        <div className="mt-6 w-full space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <Target size={16} />
              <span className="font-bold uppercase tracking-wider text-[10px]">Today's Progress</span>
            </div>
            <span className="font-black text-on-surface">{program.todayMinutes} / {program.dailyGoalMinutes} min</span>
          </div>
          <div className="w-full h-3 bg-surface-dim rounded-full overflow-hidden p-0.5 border border-outline-variant/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${goalPercent}%` }}
              className="h-full bg-primary rounded-full"
            />
          </div>
          {program.completedToday && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-success bg-success-light/20 p-2.5 rounded-xl border border-success/10"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span className="text-xs font-black">Daily goal completed! You're crushing it! 🎉</span>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Settings Row */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-surface-elevated rounded-2xl p-4 border border-outline-variant/10 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center border border-outline-variant/10">
              <Vibrate className={`w-5 h-5 ${vibrationEnabled ? 'text-primary animate-bounce' : 'text-on-surface-muted'}`} />
            </div>
            <div>
              <p className="text-sm font-bold text-on-surface">Vibration Feedback</p>
              <p className="text-[10px] text-on-surface-muted uppercase tracking-widest font-bold">Buzz when posture drops</p>
            </div>
          </div>
          <button onClick={() => onToggleVibration(!vibrationEnabled)}
            className={`w-14 h-8 rounded-full transition-all duration-300 relative ${vibrationEnabled ? 'bg-primary' : 'bg-surface-container'}`}>
            <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-lg transition-all duration-300 ${vibrationEnabled ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </motion.div>

      {/* Recent Sessions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-sm font-black text-on-surface uppercase tracking-widest flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Session History
          </h3>
        </div>
        <div className="space-y-3">
          {sessionHistory.length === 0 ? (
            <div className="bg-surface-elevated rounded-[2rem] p-10 text-center border border-outline-variant/10 border-dashed">
              <div className="w-14 h-14 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 border border-outline-variant/20">
                <Timer className="w-6 h-6 text-on-surface-muted" />
              </div>
              <p className="text-sm font-bold text-on-surface-muted uppercase tracking-widest">No sessions yet</p>
              <p className="text-xs text-on-surface-muted mt-1">Start your first training today!</p>
            </div>
          ) : (
            sessionHistory.slice(0, 5).map(session => (
              <motion.div key={session.id} whileHover={{ x: 4 }}
                className="bg-surface-elevated rounded-2xl p-4 border border-outline-variant/10 flex items-center gap-4 shadow-sm">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-base font-black shadow-inner ${session.avgScore >= 80 ? 'bg-success-light text-success' : session.avgScore >= 60 ? 'bg-warning-light text-warning' : 'bg-danger-light text-danger'
                  }`}>
                  {session.avgScore}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-surface">{formatTime(session.duration)} Session</p>
                  <p className="text-[10px] font-bold text-on-surface-muted uppercase tracking-widest">
                    {session.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-on-surface">{session.uprightPercent}%</p>
                  <p className="text-[10px] font-bold text-on-surface-muted uppercase tracking-widest">upright</p>
                </div>
                <ChevronRight className="w-4 h-4 text-on-surface-muted" />
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
