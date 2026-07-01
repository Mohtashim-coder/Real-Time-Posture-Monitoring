import React from 'react';
import { motion } from 'motion/react';
import { Clock, TrendingDown, Target, Zap, Wifi, WifiOff, Activity, User, ArrowDown, ArrowLeft, ArrowRight, Check, Loader } from 'lucide-react';
import { PostureAvatar } from './PostureAvatar';
import type { PostureData, PostureStats, PoseType } from '../hooks/usePostureEngine';
import type { ThresholdConfig } from '../hooks/useBluetoothSerial';

interface DashboardProps {
  posture: PostureData;
  stats: PostureStats;
  isMonitoring: boolean;
  thresholds: ThresholdConfig;
  onRecordPosture: (pose: PoseType) => void;
  recordingPose: PoseType | null;
  recordingCountdown: number;
  recordedPoses: Set<PoseType>;
  rawDataLog?: string[];
  isConnected?: boolean;
}

function SensorBar({ label, value, unit, max, threshold, color, isInverted = false }: {
  label: string; value: number; unit: string; max: number; threshold: [number, number]; color: string; isInverted?: boolean;
}) {
  const absValue = Math.abs(value);
  const percent = Math.min(100, (absValue / max) * 100);

  let isOver = false;
  let redZoneLeft = 0;
  let redZoneWidth = 0;

  if (isInverted) {
    // Threshold represents the SAFE range, e.g. [-15, 15]
    const safeLimit = Math.max(Math.abs(threshold[0]), Math.abs(threshold[1]));
    isOver = absValue > safeLimit;
    redZoneLeft = (safeLimit / max) * 100;
    redZoneWidth = Math.max(0, 100 - redZoneLeft);
  } else {
    // Threshold represents the BAD range, e.g. [20, 180]
    isOver = absValue >= threshold[0] && absValue <= threshold[1];
    redZoneLeft = (threshold[0] / max) * 100;
    redZoneWidth = ((threshold[1] - threshold[0]) / max) * 100;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[11px] font-bold text-on-surface-muted uppercase tracking-[0.1em]">{label}</span>
        <span className={`text-sm font-bold ${isOver ? 'text-danger' : 'text-on-surface'}`}>
          {value.toFixed(1)}{unit}
        </span>
      </div>
      <div className="relative h-2 bg-surface-dim/50 rounded-full overflow-hidden">
        {redZoneWidth > 0 && (
          <div className="absolute top-0 h-full bg-danger/20 z-10 border-x border-danger/40"
            style={{ left: `${redZoneLeft}%`, width: `${redZoneWidth}%` }} />
        )}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className="h-full rounded-full transition-all duration-500 ease-out shadow-sm relative z-20"
          style={{
            background: isOver ? '#EF4444' : color
          }}
        />
      </div>
    </div>
  );
}

function PoseRecordButton({ label, icon: Icon, pose, isRecording, countdown, isDone, onRecord }: {
  label: string; icon: React.ElementType; pose: PoseType;
  isRecording: boolean; countdown: number; isDone: boolean;
  onRecord: (pose: PoseType) => void;
}) {
  return (
    <button
      onClick={() => !isRecording && onRecord(pose)}
      disabled={isRecording && countdown > 0}
      className={`relative flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-2xl border text-[11px] font-bold tracking-wide transition-all active:scale-[0.95] ${
        isRecording
          ? 'bg-primary/10 border-primary/40 text-primary animate-pulse'
          : isDone
            ? 'bg-success/10 border-success/30 text-success'
            : 'bg-surface-dim/50 border-outline-variant/20 text-on-surface-muted hover:bg-surface-dim'
      }`}
    >
      {isRecording ? (
        <>
          <Loader className="w-5 h-5 animate-spin" />
          <span>{countdown > 0 ? `${countdown}s` : 'Done!'}</span>
        </>
      ) : isDone ? (
        <>
          <Check className="w-5 h-5" />
          <span>{label}</span>
        </>
      ) : (
        <>
          <Icon className="w-5 h-5" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

export function Dashboard({
  posture, stats, isMonitoring, thresholds, onRecordPosture,
  recordingPose, recordingCountdown, recordedPoses,
  rawDataLog = [], isConnected = false
}: DashboardProps) {
  const sc = {
    good: { label: 'Great Posture!', color: '#10B981', bg: 'bg-success-light', text: 'text-success', glow: '' },
    warning: { label: 'Adjust Posture!', color: '#F59E0B', bg: 'bg-warning-light', text: 'text-warning', glow: '' },
    bad: { label: 'Sit Up Straight!', color: '#EF4444', bg: 'bg-danger-light', text: 'text-danger', glow: '' },
  }[posture.status];

  const goalProgress = Math.min(100, Math.round((stats.todayUprightMinutes / 180) * 100));
  const isLive = posture.source === 'sensor';

  // Calculate adjusted flex threshold for UI visualization
  const allowedFlexDeviation = Math.max(10, thresholds.flexThreshold[0] - 590);
  const adjustedFlexThreshold: [number, number] = [
    allowedFlexDeviation,
    200
  ];

  return (
    <div className="flex flex-col space-y-4 max-w-full">
      {/* Enhanced Status Banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className={`${sc.bg} ${sc.glow} rounded-full px-5 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className={`w-3 h-3 rounded-full ${posture.status === 'good' ? 'bg-success' : posture.status === 'warning' ? 'bg-warning' : 'bg-danger'} ${isMonitoring ? 'animate-pulse' : ''}`} />
            {isMonitoring && <div className={`absolute rounded-full animate-ping opacity-40 w-full h-full ${posture.status === 'good' ? 'bg-success' : posture.status === 'warning' ? 'bg-warning' : 'bg-danger'}`} />}
          </div>
          <span className={`text-[15px] font-bold ${sc.text}`}>{sc.label}</span>
        </div>

        {!isLive && (
          <div className="flex items-center gap-1.5 text-on-surface-muted/60">
            <WifiOff className="w-4 h-4" />
            <span className="text-[13px] font-medium">Simulation</span>
          </div>
        )}
      </motion.div>

      {/* Visualization Card with Radial Gradient Background */}
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
        className="bg-surface-elevated rounded-[32px] p-2 border border-outline-variant/10 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.03)_0%,transparent_70%)] pointer-events-none" />

        <div className="flex flex-col items-center gap-3 justify-center relative z-10">
          <div className="flex items-center justify-between w-full gap-0.5">
            {/* Front View */}
            <div className="flex flex-col items-center flex-1">
              <span className="text-[9px] font-black text-on-surface-muted/60 uppercase tracking-widest mb-1.5">Front</span>
              <PostureAvatar score={posture.score} status={posture.status}
                leftShoulder={posture.leftShoulder} rightShoulder={posture.rightShoulder}
                flexValue={posture.flexValue} size={100} showPulse={false} view="front" />
            </div>

            {/* Central Score Gauge (Semi-circle Arch) */}
            <div className="relative flex flex-col items-center justify-center mt-3 flex-[1.2]">
              <svg width="115" height="70" viewBox="0 0 100 60">
                {/* Background Arc */}
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="currentColor" strokeWidth="10"
                  className="text-surface-dim opacity-20" strokeLinecap="round" />
                {/* Animated Score Arc */}
                <motion.path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke={sc.color}
                  strokeWidth="10"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: posture.score / 100 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="drop-shadow-[0_0_12px_rgba(0,0,0,0.2)]"
                />
              </svg>
              <div className="absolute top-[34px] flex flex-col items-center">
                <span className="text-3xl font-black text-on-surface font-manrope tracking-tighter tabular-nums leading-none">
                  {posture.score}
                </span>
                <span className="text-[9px] font-black text-on-surface-muted/60 uppercase tracking-widest mt-1">Score</span>
              </div>
              <div className="mt-1.5">
                <span className="text-[8px] font-black text-on-surface/90 uppercase tracking-[0.3em] bg-surface-dim/40 px-3 py-1 rounded-full border border-white/5">
                  Live
                </span>
              </div>
            </div>

            {/* Side View */}
            <div className="flex flex-col items-center flex-1">
              <span className="text-[9px] font-black text-on-surface-muted/60 uppercase tracking-widest mb-1.5">Side</span>
              <PostureAvatar score={posture.score} status={posture.status}
                leftShoulder={posture.leftShoulder} rightShoulder={posture.rightShoulder}
                flexValue={posture.flexValue} size={100} showPulse={false} view="side" />
            </div>
          </div>

          {/* Pose Recording Buttons */}
          <div className="w-full mt-4 space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Activity className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-black text-on-surface-muted/70 uppercase tracking-[0.15em]">Record Postures</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <PoseRecordButton label="Straight" icon={User} pose="straight"
                isRecording={recordingPose === 'straight'} countdown={recordingCountdown}
                isDone={recordedPoses.has('straight')} onRecord={onRecordPosture} />
              <PoseRecordButton label="Forward" icon={ArrowDown} pose="forward"
                isRecording={recordingPose === 'forward'} countdown={recordingCountdown}
                isDone={recordedPoses.has('forward')} onRecord={onRecordPosture} />
              <PoseRecordButton label="Left Tilt" icon={ArrowLeft} pose="left"
                isRecording={recordingPose === 'left'} countdown={recordingCountdown}
                isDone={recordedPoses.has('left')} onRecord={onRecordPosture} />
              <PoseRecordButton label="Right Tilt" icon={ArrowRight} pose="right"
                isRecording={recordingPose === 'right'} countdown={recordingCountdown}
                isDone={recordedPoses.has('right')} onRecord={onRecordPosture} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Modernized Sensor Readings */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="bg-surface-elevated rounded-[32px] p-5 border border-outline-variant/10 shadow-lg relative overflow-hidden">
        <div className="flex items-center mb-5 gap-2.5">
          <Activity className="w-5 h-5 text-primary" />
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-on-surface">Sensor Readings</span>
            <span className="text-[10px] font-black text-primary/60 bg-primary/5 px-2 py-0.5 rounded-md uppercase tracking-tighter">3-Point Smoothed</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          <SensorBar label="LEFT PITCH" value={posture.leftShoulder.pitch} unit="°"
            max={90} threshold={thresholds.leftShoulderPitch} color="#6366F1" />
          <SensorBar label="RIGHT PITCH" value={posture.rightShoulder.pitch} unit="°"
            max={90} threshold={thresholds.rightShoulderPitch} color="#14B8A6" />
          <SensorBar label="LEFT ROLL" value={posture.leftShoulder.roll} unit="°"
            max={90} threshold={thresholds.leftShoulderRoll} color="#818CF8" isInverted={true} />
          <SensorBar label="RIGHT ROLL" value={posture.rightShoulder.roll} unit="°"
            max={90} threshold={thresholds.rightShoulderRoll} color="#2DD4BF" isInverted={true} />

          <div className="col-span-2 pt-1">
            <SensorBar label="BACK FLEX" value={posture.flexValue} unit=""
              max={1000} threshold={adjustedFlexThreshold} color="#F59E0B" />
          </div>
        </div>
      </motion.div>

      {/* Premium Stats Grid */}
      <div className="grid grid-cols-2 gap-3 pb-4">
        {/* Upright Card */}
        <motion.div whileTap={{ scale: 0.98 }}
          className="bg-surface-elevated rounded-[24px] p-4 border border-outline-variant/10 shadow-sm flex flex-col justify-between gap-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-success-light">
              <Clock className="w-4 h-4 text-success" />
            </div>
            <span className="text-[11px] font-bold text-on-surface-muted uppercase tracking-wider">Upright</span>
          </div>
          <div className="flex items-baseline">
            <span className="text-2xl font-black text-on-surface font-manrope tracking-tight">
              {Math.floor(stats.todayUprightMinutes / 60)}h {stats.todayUprightMinutes % 60}m
            </span>
          </div>
        </motion.div>

        {/* Slouch Card */}
        <motion.div whileTap={{ scale: 0.98 }}
          className="bg-surface-elevated rounded-[24px] p-4 border border-outline-variant/10 shadow-sm flex flex-col justify-between gap-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-warning-light">
              <TrendingDown className="w-4 h-4 text-warning" />
            </div>
            <span className="text-[11px] font-bold text-on-surface-muted uppercase tracking-wider">Slouch</span>
          </div>
          <div className="flex items-baseline">
            <span className="text-2xl font-black text-on-surface font-manrope tracking-tight">
              {stats.todaySlouchMinutes}m
            </span>
          </div>
        </motion.div>

        {/* Daily Goal Card */}
        <motion.div className="col-span-1 bg-surface-elevated rounded-[24px] p-4 border border-outline-variant/10 shadow-sm flex flex-col justify-center gap-3">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary opacity-80" />
              <span className="text-[13px] font-bold text-on-surface">Goal</span>
            </div>
            <span className="text-[12px] font-black text-primary">{goalProgress}%</span>
          </div>
          <div className="h-2.5 bg-surface-dim rounded-full overflow-hidden w-full">
            <motion.div initial={{ width: 0 }} animate={{ width: `${goalProgress}%` }}
              transition={{ duration: 1, ease: "circOut" }} className="h-full bg-gradient-to-r from-primary-light to-primary rounded-full shadow-sm" />
          </div>
        </motion.div>

        {/* Streak Card */}
        <motion.div className="col-span-1 bg-primary rounded-[24px] p-4 text-white shadow-sm flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-white fill-white" />
              <span className="text-[13px] font-bold text-white">Streak</span>
            </div>
            <span className="text-[20px] font-black text-white font-manrope">{stats.currentStreak}d</span>
          </div>
          <div className="flex gap-1 justify-start">
            {[...Array(7)].map((_, i) => (
              <div key={i} className={`w-[18px] h-[18px] rounded-[6px] flex items-center justify-center ${i < stats.currentStreak ? 'bg-white/20' : 'bg-black/10'}`}>
                <span className="text-[10px]">{i < stats.currentStreak ? '🔥' : ''}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Raw Data Stream (Debug Mode) */}
      {isConnected && rawDataLog.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="mt-2 p-3 bg-black/20 rounded-2xl border border-white/5 font-mono text-[9px] text-primary/60 overflow-hidden">
          <div className="flex items-center gap-2 mb-1.5 opacity-40">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <span className="uppercase tracking-[0.2em] font-black">BT Data Stream</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {rawDataLog.slice(-3).map((line, i) => (
              <div key={i} className="truncate whitespace-nowrap opacity-80">{`>> ${line}`}</div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
