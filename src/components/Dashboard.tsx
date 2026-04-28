import React from 'react';
import { motion } from 'motion/react';
import { Clock, TrendingDown, Target, Zap, Wifi, WifiOff, Activity } from 'lucide-react';
import { PostureAvatar } from './PostureAvatar';
import type { PostureData, PostureStats } from '../hooks/usePostureEngine';
import type { ThresholdConfig } from '../hooks/useBluetoothSerial';

interface DashboardProps {
  posture: PostureData;
  stats: PostureStats;
  isMonitoring: boolean;
  thresholds: ThresholdConfig;
  onCalibrate: () => void;
}

function SensorBar({ label, value, unit, max, threshold, color }: {
  label: string; value: number; unit: string; max: number; threshold: number; color: string;
}) {
  const percent = Math.min(100, (Math.abs(value) / max) * 100);
  const threshPercent = (threshold / max) * 100;
  const isOver = Math.abs(value) > threshold;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-on-surface-muted uppercase tracking-wider">{label}</span>
        <span className={`text-sm font-bold ${isOver ? 'text-danger' : 'text-on-surface'}`}>
          {value.toFixed(1)}{unit}
        </span>
      </div>
      <div className="relative h-1.5 bg-surface-dim rounded-full overflow-hidden">
        {/* Threshold marker */}
        <div className="absolute top-0 h-full w-px bg-danger/40 z-10"
          style={{ left: `${threshPercent}%` }} />
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${percent}%`, background: isOver ? '#EF4444' : color }} />
      </div>
    </div>
  );
}

export function Dashboard({ posture, stats, isMonitoring, thresholds, onCalibrate }: DashboardProps) {
  const circumference = 2 * Math.PI * 80;
  const scoreOffset = circumference - (posture.score / 100) * circumference;
  const sc = {
    good: { label: 'Great Posture!', color: '#10B981', bg: 'bg-success-light', text: 'text-success' },
    warning: { label: 'Adjust Posture', color: '#F59E0B', bg: 'bg-warning-light', text: 'text-warning' },
    bad: { label: 'Sit Up Straight!', color: '#EF4444', bg: 'bg-danger-light', text: 'text-danger' },
  }[posture.status];
  const goalProgress = Math.min(100, Math.round((stats.todayUprightMinutes / 180) * 100));
  const isLive = posture.source === 'sensor';

  return (
    <div className="px-4 py-2 flex flex-col h-full space-y-2 max-w-full">
      {/* Status Banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className={`${sc.bg} rounded-xl px-3 py-2 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${posture.status === 'good' ? 'bg-success' : posture.status === 'warning' ? 'bg-warning' : 'bg-danger'} ${isMonitoring ? 'animate-pulse' : ''}`} />
          <span className={`text-xs font-semibold ${sc.text}`}>{sc.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isLive ? <Wifi className="w-3 h-3 text-success" /> : <WifiOff className="w-3 h-3 text-on-surface-muted" />}
          <span className={`text-xs font-medium ${isLive ? 'text-success' : 'text-on-surface-muted'}`}>
            {isLive ? 'Live Sensor' : 'Simulation'}
          </span>
        </div>
      </motion.div>

      {/* Score & Posture Visualization */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
        className="bg-surface-elevated rounded-2xl p-3 shadow-xl border border-outline-variant/10 flex-1 min-h-0 flex flex-col justify-center">
        <div className="flex flex-col items-center gap-2 h-full justify-center">
          <div className="flex items-center justify-between w-full gap-2">
            {/* Front View */}
            <div className="flex-1 flex flex-col items-center">
              <span className="text-[9px] font-black text-on-surface-muted uppercase tracking-widest mb-1">Front</span>
              <PostureAvatar score={posture.score} status={posture.status}
                leftShoulder={posture.leftShoulder} rightShoulder={posture.rightShoulder}
                flexValue={posture.flexValue} size={110} showPulse={false} view="front" />
            </div>

            {/* Central Score */}
            <div className="relative flex-shrink-0">
              <svg width="86" height="86" className="-rotate-90">
                <circle cx="43" cy="43" r="38" fill="none" stroke="#E2E8F0" strokeWidth="5" opacity="0.1" />
                <circle cx="43" cy="43" r="38" fill="none" stroke={sc.color} strokeWidth="5"
                  strokeLinecap="round" strokeDasharray={2 * Math.PI * 38} strokeDashoffset={(2 * Math.PI * 38) - (posture.score / 100) * (2 * Math.PI * 38)}
                  className="score-ring-fill transition-all duration-1000 ease-out" 
                  style={{ filter: `drop-shadow(0 0 8px ${sc.color}60)` }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-on-surface tracking-tighter leading-none">{posture.score}</span>
                <span className="text-[8px] font-bold text-on-surface-muted uppercase tracking-widest mt-0.5">Score</span>
              </div>
            </div>

            {/* Side View */}
            <div className="flex-1 flex flex-col items-center">
              <span className="text-[9px] font-black text-on-surface-muted uppercase tracking-widest mb-1">Side</span>
              <PostureAvatar score={posture.score} status={posture.status}
                leftShoulder={posture.leftShoulder} rightShoulder={posture.rightShoulder}
                flexValue={posture.flexValue} size={110} showPulse={false} view="side" />
            </div>
          </div>
          
          <button onClick={onCalibrate}
            className="w-full py-2 rounded-xl bg-surface-dim border border-outline-variant/30 text-on-surface font-bold text-[11px] hover:bg-surface transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 mt-2">
            <span className="text-sm">⟳</span> Recalibrate
          </button>
        </div>
      </motion.div>

      {/* Live Sensor Readings */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="bg-surface-elevated rounded-xl p-3 border border-outline-variant/10">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold text-on-surface">Sensor Readings</span>
          {isLive && <span className="text-[9px] bg-success-light text-success px-1.5 py-0.5 rounded-full font-bold">LIVE</span>}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <SensorBar label="L Pitch" value={posture.leftShoulder.pitch} unit="°"
            max={45} threshold={thresholds.leftShoulderPitch} color="#6366F1" />
          <SensorBar label="R Pitch" value={posture.rightShoulder.pitch} unit="°"
            max={45} threshold={thresholds.rightShoulderPitch} color="#0D9488" />
          <SensorBar label="L Roll" value={posture.leftShoulder.roll} unit="°"
            max={35} threshold={thresholds.leftShoulderRoll} color="#6366F1" />
          <SensorBar label="R Roll" value={posture.rightShoulder.roll} unit="°"
            max={35} threshold={thresholds.rightShoulderRoll} color="#0D9488" />
          <div className="col-span-2">
            <SensorBar label="Back Flex" value={posture.flexValue} unit=""
              max={800} threshold={thresholds.flexThreshold} color="#F59E0B" />
          </div>
        </div>
      </motion.div>

      {/* Stats Grid: 2x2 */}
      <div className="grid grid-cols-2 gap-2 pb-1">
        {/* Upright */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-surface-elevated rounded-xl p-2.5 border border-outline-variant/10 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded flex items-center justify-center bg-success-light">
              <Clock className="w-3 h-3 text-success" />
            </div>
            <span className="text-[9px] font-semibold text-on-surface-muted uppercase">Upright</span>
          </div>
          <p className="text-lg font-extrabold text-on-surface leading-none mb-0.5">{Math.floor(stats.todayUprightMinutes / 60)}h {stats.todayUprightMinutes % 60}m</p>
        </motion.div>

        {/* Slouch */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-surface-elevated rounded-xl p-2.5 border border-outline-variant/10 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded flex items-center justify-center bg-warning-light">
              <TrendingDown className="w-3 h-3 text-warning" />
            </div>
            <span className="text-[9px] font-semibold text-on-surface-muted uppercase">Slouch</span>
          </div>
          <p className="text-lg font-extrabold text-on-surface leading-none mb-0.5">{stats.todaySlouchMinutes}m</p>
        </motion.div>

        {/* Daily Goal */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-surface-elevated rounded-xl p-2.5 border border-outline-variant/10 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <Target className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-bold text-on-surface">Goal</span>
            </div>
            <span className="text-[10px] font-bold text-primary">{goalProgress}%</span>
          </div>
          <div className="h-1.5 bg-surface-dim rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${goalProgress}%` }}
              transition={{ duration: 1 }} className="h-full bg-gradient-to-r from-primary to-primary-light rounded-full" />
          </div>
        </motion.div>

        {/* Streak */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-gradient-to-br from-primary to-primary-dark rounded-xl p-2.5 text-white flex flex-col justify-center">
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              <span className="text-[10px] font-bold opacity-90">Streak</span>
            </div>
            <p className="text-base font-extrabold leading-none">{stats.currentStreak}d</p>
          </div>
          <div className="flex gap-0.5 justify-start">
            {[...Array(7)].map((_, i) => (
              <div key={i} className={`w-3 h-3 rounded-[3px] text-[6px] flex items-center justify-center ${i < stats.currentStreak ? 'bg-white/30' : 'bg-white/10'}`}>
                {i < stats.currentStreak ? '🔥' : ''}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
