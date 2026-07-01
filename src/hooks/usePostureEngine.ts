import { useState, useEffect, useRef, useCallback } from 'react';
import type { SensorReading, ThresholdConfig } from './useBluetoothSerial';

export interface PostureBaselines {
  leftPitch: number;
  leftRoll: number;
  rightPitch: number;
  rightRoll: number;
  flex: number;
}

const DEFAULT_BASELINES: PostureBaselines = {
  leftPitch: 0, leftRoll: 0, rightPitch: 0, rightRoll: 0, flex: 590,
};

export interface PostureData {
  score: number;
  status: 'good' | 'warning' | 'bad';
  leftShoulder: { pitch: number; roll: number };
  rightShoulder: { pitch: number; roll: number };
  flexValue: number;
  baselines: PostureBaselines;
  uprightSeconds: number;
  slouchSeconds: number;
  timestamp: number;
  source: 'sensor' | 'simulation';
}

export interface PostureStats {
  todayUprightMinutes: number;
  todaySlouchMinutes: number;
  todayPercentage: number;
  weeklyData: { day: string; uprightMinutes: number; slouchMinutes: number; score: number }[];
  totalSessions: number;
  bestStreak: number;
  currentStreak: number;
  bestScore: number;
}

const STORAGE_KEY = 'posture_monitor_stats';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const INITIAL_STATS: PostureStats = {
  todayUprightMinutes: 0,
  todaySlouchMinutes: 0,
  todayPercentage: 0,
  weeklyData: DAYS.map(day => ({ day, uprightMinutes: 0, slouchMinutes: 0, score: 0 })),
  totalSessions: 0,
  bestStreak: 0,
  currentStreak: 0,
  bestScore: 0,
};

/**
 * Scoring System:
 * - Score = 100 when all sensor values are at their ideal (calibrated) positions
 *   (0° for pitch/roll since Arduino calibrates to zero, flex at midpoint of good range)
 * - Each of the 5 sensor axes contributes up to 20 penalty points (5 × 20 = 100)
 * - Values near 0 → minimal penalty, values entering threshold range → heavy penalty
 * - Threshold ranges define "bad posture" zones — once inside, score drops sharply
 */
function calculateScoreFromSensors(
  reading: SensorReading,
  thresholds: ThresholdConfig,
  baselines: PostureBaselines
): { score: number; status: 'good' | 'warning' | 'bad' } {
  let totalPenalty = 0;

  // Calibrate readings by subtracting baselines
  const calLP = reading.leftShoulder.pitch - baselines.leftPitch;
  const calLR = reading.leftShoulder.roll - baselines.leftRoll;
  const calRP = reading.rightShoulder.pitch - baselines.rightPitch;
  const calRR = reading.rightShoulder.roll - baselines.rightRoll;
  const calFlex = reading.flexValue - baselines.flex;

  const getAxisPenalty = (value: number, range: [number, number], isInverted: boolean = false): number => {
    const deviation = Math.abs(value);
    const rangeSpan = Math.abs(range[1] - range[0]);

    if (!isInverted) {
      const isInRange = value >= range[0] && value <= range[1];
      if (isInRange) {
        const depthIntoRange = Math.min(Math.abs(value - range[0]), Math.abs(value - range[1]));
        const depthRatio = rangeSpan > 0 ? Math.min(1, depthIntoRange / (rangeSpan * 0.5)) : 1;
        return 8 + depthRatio * 12;
      }
      const distToRangeStart = Math.min(Math.abs(range[0]), Math.abs(range[1]));
      if (distToRangeStart > 0) {
        return Math.min(1, deviation / distToRangeStart) * 7;
      }
      return 0;
    } else {
      const isSafe = value >= range[0] && value <= range[1];
      if (isSafe) {
        const maxSafeDeviation = Math.max(Math.abs(range[0]), Math.abs(range[1]));
        if (maxSafeDeviation > 0) {
          return Math.min(1, deviation / maxSafeDeviation) * 7;
        }
        return 0;
      }
      const excess = value > range[1] ? value - range[1] : range[0] - value;
      return 8 + Math.min(1, excess / 30) * 12;
    }
  };

  const getFlexPenalty = (deviation: number, range: [number, number]): number => {
    const allowedDeviation = Math.max(10, range[0] - 590);
    if (deviation >= allowedDeviation) {
      const rangeSpan = Math.max(50, range[1] - range[0]);
      const depth = Math.min(deviation - allowedDeviation, rangeSpan);
      return 8 + Math.min(1, depth / rangeSpan) * 12;
    }
    if (allowedDeviation > 0) {
      return Math.max(0, Math.min(1, deviation / allowedDeviation)) * 7;
    }
    return 0;
  };

  totalPenalty += getAxisPenalty(calLP, thresholds.leftShoulderPitch, false);
  totalPenalty += getAxisPenalty(calLR, thresholds.leftShoulderRoll, true);
  totalPenalty += getAxisPenalty(calRP, thresholds.rightShoulderPitch, false);
  totalPenalty += getAxisPenalty(calRR, thresholds.rightShoulderRoll, true);
  totalPenalty += getFlexPenalty(calFlex, thresholds.flexThreshold);

  const score = Math.max(0, Math.min(100, Math.round(100 - totalPenalty)));
  const status: 'good' | 'warning' | 'bad' = score >= 75 ? 'good' : score >= 50 ? 'warning' : 'bad';
  return { score, status };
}

// Helper to get formatted day name
const getDayName = (date: Date) => DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1];

export type PoseType = 'straight' | 'forward' | 'left' | 'right';

export interface PoseRecording {
  leftPitch: number;
  leftRoll: number;
  rightPitch: number;
  rightRoll: number;
  flex: number;
}

const RECORDING_DURATION_MS = 3000;
const POSE_STORAGE_KEY = 'posture_pose_recordings';

export function usePostureEngine(
  sensorReading: SensorReading | null,
  thresholds: ThresholdConfig,
  onAutoThresholds?: (t: ThresholdConfig) => void
) {
  const [baselines, setBaselines] = useState<PostureBaselines>(() => {
    const saved = localStorage.getItem('posture_baselines');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* fall through */ }
    }
    return DEFAULT_BASELINES;
  });

  const [posture, setPosture] = useState<PostureData>(() => ({
    score: 100,
    status: 'good',
    leftShoulder: { pitch: 0, roll: 0 },
    rightShoulder: { pitch: 0, roll: 0 },
    flexValue: 0,
    baselines,
    uprightSeconds: 0,
    slouchSeconds: 0,
    timestamp: Date.now(),
    source: 'sensor',
  }));

  const [stats, setStats] = useState<PostureStats>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.weeklyData || parsed.weeklyData.length === 0) {
          parsed.weeklyData = INITIAL_STATS.weeklyData;
        }
        return parsed;
      } catch {
        return INITIAL_STATS;
      }
    }

    const demoData = [...INITIAL_STATS.weeklyData];
    const today = getDayName(new Date());
    const todayIdx = DAYS.indexOf(today);

    for (let i = 0; i < todayIdx; i++) {
      demoData[i] = {
        day: DAYS[i],
        uprightMinutes: 15 + Math.floor(Math.random() * 25),
        slouchMinutes: 5 + Math.floor(Math.random() * 10),
        score: 75 + Math.floor(Math.random() * 20),
      };
    }

    return { ...INITIAL_STATS, weeklyData: demoData, totalSessions: todayIdx, currentStreak: todayIdx > 0 ? todayIdx : 1 };
  });

  const [isMonitoring, setIsMonitoring] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeRef = useRef(0);
  const statsCounterRef = useRef(0);
  const scoreBufferRef = useRef<number[]>([]);

  // ===== POSE RECORDING STATE =====
  const [recordingPose, setRecordingPose] = useState<PoseType | null>(null);
  const [recordingCountdown, setRecordingCountdown] = useState(0);
  const [recordedPoses, setRecordedPoses] = useState<Set<PoseType>>(() => {
    const saved = localStorage.getItem(POSE_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return new Set(Object.keys(parsed) as PoseType[]);
      } catch { /* fall through */ }
    }
    return new Set<PoseType>();
  });
  const [poseRecordings, setPoseRecordings] = useState<Partial<Record<PoseType, PoseRecording>>>(() => {
    const saved = localStorage.getItem(POSE_STORAGE_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch { /* fall through */ }
    }
    return {};
  });
  const sampleBufferRef = useRef<SensorReading[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Save stats whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }, [stats]);

  // Handle day changes (reset daily stats)
  useEffect(() => {
    const checkDayChange = () => {
      const lastReset = localStorage.getItem('posture_last_reset');
      const today = new Date().toDateString();

      if (lastReset !== today) {
        setStats(prev => {
          const todayName = getDayName(new Date(lastReset || Date.now()));
          const newWeekly = prev.weeklyData.map(d =>
            d.day === todayName
              ? { ...d, uprightMinutes: prev.todayUprightMinutes, slouchMinutes: prev.todaySlouchMinutes, score: prev.todayPercentage }
              : d
          );

          return {
            ...prev,
            todayUprightMinutes: 0,
            todaySlouchMinutes: 0,
            todayPercentage: 0,
            weeklyData: newWeekly,
            currentStreak: prev.todayUprightMinutes > 10 ? prev.currentStreak + 1 : prev.currentStreak,
          };
        });
        localStorage.setItem('posture_last_reset', today);
      }
    };

    checkDayChange();
    const interval = setInterval(checkDayChange, 60000);
    return () => clearInterval(interval);
  }, []);

  // Collect samples while recording
  useEffect(() => {
    if (recordingPose && sensorReading) {
      sampleBufferRef.current.push(sensorReading);
    }
  }, [sensorReading, recordingPose]);

  // Update real sensor posture — subtract baselines so the avatar/dashboard sees calibrated values
  useEffect(() => {
    if (sensorReading) {
      const { score, status } = calculateScoreFromSensors(sensorReading, thresholds, baselines);

      const calLeft = {
        pitch: sensorReading.leftShoulder.pitch - baselines.leftPitch,
        roll: sensorReading.leftShoulder.roll - baselines.leftRoll,
      };
      const calRight = {
        pitch: sensorReading.rightShoulder.pitch - baselines.rightPitch,
        roll: sensorReading.rightShoulder.roll - baselines.rightRoll,
      };
      const calFlex = sensorReading.flexValue - baselines.flex;

      setPosture({
        score,
        status,
        leftShoulder: calLeft,
        rightShoulder: calRight,
        flexValue: calFlex,
        baselines,
        uprightSeconds: status === 'good' ? 1 : 0,
        slouchSeconds: status !== 'good' ? 1 : 0,
        timestamp: Date.now(),
        source: 'sensor',
      });

      scoreBufferRef.current.push(score);
      if (scoreBufferRef.current.length > 50) scoreBufferRef.current.shift();

      statsCounterRef.current++;
      if (statsCounterRef.current % 600 === 0) {
        setStats(prev => {
          const isUpright = status === 'good';
          const newUp = prev.todayUprightMinutes + (isUpright ? 1 : 0);
          const newSl = prev.todaySlouchMinutes + (isUpright ? 0 : 1);
          const total = newUp + newSl;
          const avgScore = Math.round(scoreBufferRef.current.reduce((a, b) => a + b, 0) / scoreBufferRef.current.length);

          const todayName = getDayName(new Date());
          const newWeekly = prev.weeklyData.map(d =>
            d.day === todayName
              ? { ...d, uprightMinutes: newUp, score: avgScore }
              : d
          );

          return {
            ...prev,
            todayUprightMinutes: newUp,
            todaySlouchMinutes: newSl,
            todayPercentage: total > 0 ? Math.round((newUp / total) * 100) : 0,
            weeklyData: newWeekly,
            bestScore: Math.max(prev.bestScore, score),
          };
        });
      }
    }
  }, [sensorReading, thresholds, baselines]);

  // Average collected samples into a single PoseRecording
  const averageSamples = useCallback((samples: SensorReading[]): PoseRecording => {
    const n = samples.length || 1;
    const sum = samples.reduce(
      (acc, s) => ({
        leftPitch: acc.leftPitch + s.leftShoulder.pitch,
        leftRoll: acc.leftRoll + s.leftShoulder.roll,
        rightPitch: acc.rightPitch + s.rightShoulder.pitch,
        rightRoll: acc.rightRoll + s.rightShoulder.roll,
        flex: acc.flex + s.flexValue,
      }),
      { leftPitch: 0, leftRoll: 0, rightPitch: 0, rightRoll: 0, flex: 0 }
    );
    return {
      leftPitch: sum.leftPitch / n,
      leftRoll: sum.leftRoll / n,
      rightPitch: sum.rightPitch / n,
      rightRoll: sum.rightRoll / n,
      flex: sum.flex / n,
    };
  }, []);

  // Compute thresholds from recorded poses
  const computeAutoThresholds = useCallback((
    recordings: Partial<Record<PoseType, PoseRecording>>,
    currentBaselines: PostureBaselines,
    currentThresholds: ThresholdConfig
  ): ThresholdConfig => {
    const newT = { ...currentThresholds };
    const straight = recordings.straight;
    if (!straight) return newT;

    // Forward lean → pitch thresholds
    if (recordings.forward) {
      const fwd = recordings.forward;
      // Calibrated forward values (relative to straight baseline)
      const calFwdLP = fwd.leftPitch - currentBaselines.leftPitch;
      const calFwdRP = fwd.rightPitch - currentBaselines.rightPitch;
      const calFwdFlex = fwd.flex - currentBaselines.flex;

      // Set pitch thresholds at 60% of the forward deviation (with 5° margin)
      const lpTrigger = Math.round(calFwdLP * 0.6);
      const rpTrigger = Math.round(calFwdRP * 0.6);

      newT.leftShoulderPitch = [
        Math.min(lpTrigger, -5) , Math.max(lpTrigger, 5) > 0 ? 180 : Math.min(lpTrigger, -180)
      ];
      // Simplify: if forward lean makes LP go positive, threshold = [trigger, 180]
      if (calFwdLP > 0) {
        newT.leftShoulderPitch = [Math.max(5, lpTrigger), 180];
      } else {
        newT.leftShoulderPitch = [-180, Math.min(-5, lpTrigger)];
      }

      if (calFwdRP > 0) {
        newT.rightShoulderPitch = [Math.max(5, rpTrigger), 180];
      } else {
        newT.rightShoulderPitch = [-180, Math.min(-5, rpTrigger)];
      }

      // Flex threshold
      const flexTrigger = Math.max(10, Math.round(calFwdFlex * 0.6));
      newT.flexThreshold = [currentBaselines.flex + flexTrigger, 1023];
    }

    // Left tilt → roll safe boundaries (left side)
    if (recordings.left) {
      const lt = recordings.left;
      const calLtLR = lt.leftRoll - currentBaselines.leftRoll;
      const calLtRR = lt.rightRoll - currentBaselines.rightRoll;

      // Roll thresholds are SAFE zones. Expand the safe zone boundary toward the tilt direction
      // at 70% of the recorded tilt value
      const leftBoundLR = Math.round(calLtLR * 0.7);
      const leftBoundRR = Math.round(calLtRR * 0.7);

      // Merge with existing: take the wider safe range
      newT.leftShoulderRoll = [
        Math.min(newT.leftShoulderRoll[0], leftBoundLR, leftBoundLR < 0 ? leftBoundLR : newT.leftShoulderRoll[0]),
        Math.max(newT.leftShoulderRoll[1], leftBoundLR > 0 ? leftBoundLR : newT.leftShoulderRoll[1]),
      ];
      newT.rightShoulderRoll = [
        Math.min(newT.rightShoulderRoll[0], leftBoundRR < 0 ? leftBoundRR : newT.rightShoulderRoll[0]),
        Math.max(newT.rightShoulderRoll[1], leftBoundRR > 0 ? leftBoundRR : newT.rightShoulderRoll[1]),
      ];
    }

    // Right tilt → roll safe boundaries (right side)
    if (recordings.right) {
      const rt = recordings.right;
      const calRtLR = rt.leftRoll - currentBaselines.leftRoll;
      const calRtRR = rt.rightRoll - currentBaselines.rightRoll;

      const rightBoundLR = Math.round(calRtLR * 0.7);
      const rightBoundRR = Math.round(calRtRR * 0.7);

      newT.leftShoulderRoll = [
        Math.min(newT.leftShoulderRoll[0], rightBoundLR < 0 ? rightBoundLR : newT.leftShoulderRoll[0]),
        Math.max(newT.leftShoulderRoll[1], rightBoundLR > 0 ? rightBoundLR : newT.leftShoulderRoll[1]),
      ];
      newT.rightShoulderRoll = [
        Math.min(newT.rightShoulderRoll[0], rightBoundRR < 0 ? rightBoundRR : newT.rightShoulderRoll[0]),
        Math.max(newT.rightShoulderRoll[1], rightBoundRR > 0 ? rightBoundRR : newT.rightShoulderRoll[1]),
      ];
    }

    return newT;
  }, []);

  // Start recording a specific pose
  const startRecording = useCallback((pose: PoseType) => {
    if (recordingPose) return; // Already recording

    sampleBufferRef.current = [];
    setRecordingPose(pose);
    setRecordingCountdown(3);

    // Countdown timer
    let count = 3;
    countdownTimerRef.current = setInterval(() => {
      count--;
      setRecordingCountdown(count);
      if (count <= 0 && countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    }, 1000);

    // Stop recording after duration
    recordingTimerRef.current = setTimeout(() => {
      const samples = [...sampleBufferRef.current];
      sampleBufferRef.current = [];
      setRecordingPose(null);
      setRecordingCountdown(0);

      if (samples.length === 0) return;

      const averaged = averageSamples(samples);

      // Update recordings
      setPoseRecordings(prev => {
        const updated = { ...prev, [pose]: averaged };
        localStorage.setItem(POSE_STORAGE_KEY, JSON.stringify(updated));

        // If this was 'straight', also set baselines
        if (pose === 'straight') {
          const newBaselines: PostureBaselines = {
            leftPitch: averaged.leftPitch,
            leftRoll: averaged.leftRoll,
            rightPitch: averaged.rightPitch,
            rightRoll: averaged.rightRoll,
            flex: averaged.flex,
          };
          setBaselines(newBaselines);
          localStorage.setItem('posture_baselines', JSON.stringify(newBaselines));

          // Reset stats and posture
          timeRef.current = 0;
          statsCounterRef.current = 0;
          scoreBufferRef.current = [];
          setPosture({
            score: 100,
            status: 'good',
            leftShoulder: { pitch: 0, roll: 0 },
            rightShoulder: { pitch: 0, roll: 0 },
            flexValue: 0,
            baselines: newBaselines,
            uprightSeconds: 0,
            slouchSeconds: 0,
            timestamp: Date.now(),
            source: 'sensor',
          });
          setStats(INITIAL_STATS);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_STATS));

          // Compute auto thresholds with new baselines
          if (onAutoThresholds) {
            const autoT = computeAutoThresholds(updated, newBaselines, thresholds);
            onAutoThresholds(autoT);
          }
        } else {
          // For non-straight poses, compute thresholds using current baselines
          if (onAutoThresholds) {
            const autoT = computeAutoThresholds(updated, baselines, thresholds);
            onAutoThresholds(autoT);
          }
        }

        return updated;
      });

      setRecordedPoses(prev => {
        const next = new Set(prev);
        next.add(pose);
        return next;
      });
    }, RECORDING_DURATION_MS);
  }, [recordingPose, averageSamples, computeAutoThresholds, baselines, thresholds, onAutoThresholds]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  useEffect(() => { setIsMonitoring(true); }, []);

  return {
    posture,
    stats,
    isMonitoring,
    setStats,
    // Pose recording
    recordingPose,
    recordingCountdown,
    recordedPoses,
    startRecording,
  };
}
