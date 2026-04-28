import { useState, useEffect, useRef, useCallback } from 'react';
import type { SensorReading, ThresholdConfig } from './useBluetoothSerial';

export interface PostureData {
  score: number;
  status: 'good' | 'warning' | 'bad';
  leftShoulder: { pitch: number; roll: number };
  rightShoulder: { pitch: number; roll: number };
  flexValue: number;
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

const INITIAL_STATS: PostureStats = {
  todayUprightMinutes: 142,
  todaySlouchMinutes: 18,
  todayPercentage: 89,
  weeklyData: [
    { day: 'Mon', uprightMinutes: 180, slouchMinutes: 30, score: 86 },
    { day: 'Tue', uprightMinutes: 210, slouchMinutes: 15, score: 93 },
    { day: 'Wed', uprightMinutes: 165, slouchMinutes: 45, score: 79 },
    { day: 'Thu', uprightMinutes: 195, slouchMinutes: 20, score: 91 },
    { day: 'Fri', uprightMinutes: 220, slouchMinutes: 10, score: 96 },
    { day: 'Sat', uprightMinutes: 90, slouchMinutes: 25, score: 78 },
    { day: 'Sun', uprightMinutes: 60, slouchMinutes: 15, score: 80 },
  ],
  totalSessions: 24,
  bestStreak: 7,
  currentStreak: 3,
  bestScore: 98,
};

/**
 * Calculate posture score from sensor readings
 * Thresholds define what "bad" posture is — score decreases as readings approach/exceed thresholds
 */
function calculateScoreFromSensors(
  reading: SensorReading,
  thresholds: ThresholdConfig
): { score: number; status: 'good' | 'warning' | 'bad' } {
  let score = 100;

  // Left shoulder penalties
  const lpRatio = Math.abs(reading.leftShoulder.pitch) / thresholds.leftShoulderPitch;
  score -= Math.max(0, lpRatio - 0.5) * 30;
  const lrRatio = Math.abs(reading.leftShoulder.roll) / thresholds.leftShoulderRoll;
  score -= Math.max(0, lrRatio - 0.5) * 20;

  // Right shoulder penalties
  const rpRatio = Math.abs(reading.rightShoulder.pitch) / thresholds.rightShoulderPitch;
  score -= Math.max(0, rpRatio - 0.5) * 30;
  const rrRatio = Math.abs(reading.rightShoulder.roll) / thresholds.rightShoulderRoll;
  score -= Math.max(0, rrRatio - 0.5) * 20;

  // Flex sensor penalty
  const fRatio = reading.flexValue / thresholds.flexThreshold;
  score -= Math.max(0, fRatio - 0.3) * 25;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const status: 'good' | 'warning' | 'bad' = score >= 75 ? 'good' : score >= 50 ? 'warning' : 'bad';
  return { score, status };
}

export function usePostureEngine(
  sensorReading: SensorReading | null,
  thresholds: ThresholdConfig
) {
  const [posture, setPosture] = useState<PostureData>({
    score: 85,
    status: 'good',
    leftShoulder: { pitch: 2.4, roll: -1.1 },
    rightShoulder: { pitch: 3.1, roll: 0.8 },
    flexValue: 180,
    uprightSeconds: 0,
    slouchSeconds: 0,
    timestamp: Date.now(),
    source: 'simulation',
  });
  const [stats, setStats] = useState<PostureStats>(INITIAL_STATS);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeRef = useRef(0);
  const statsCounterRef = useRef(0);

  // ===== REAL SENSOR DATA =====
  useEffect(() => {
    if (sensorReading) {
      const { score, status } = calculateScoreFromSensors(sensorReading, thresholds);
      setPosture({
        score,
        status,
        leftShoulder: sensorReading.leftShoulder,
        rightShoulder: sensorReading.rightShoulder,
        flexValue: sensorReading.flexValue,
        uprightSeconds: status === 'good' ? 1 : 0,
        slouchSeconds: status !== 'good' ? 1 : 0,
        timestamp: Date.now(),
        source: 'sensor',
      });

      // Update daily stats every 60 readings (~6 seconds at 10Hz)
      statsCounterRef.current++;
      if (statsCounterRef.current % 60 === 0) {
        setStats(prev => {
          const addUpright = status === 'good' ? 1 : 0;
          const addSlouch = status !== 'good' ? 1 : 0;
          const newUp = prev.todayUprightMinutes + addUpright;
          const newSl = prev.todaySlouchMinutes + addSlouch;
          const total = newUp + newSl;
          return {
            ...prev,
            todayUprightMinutes: newUp,
            todaySlouchMinutes: newSl,
            todayPercentage: total > 0 ? Math.round((newUp / total) * 100) : 0,
            bestScore: Math.max(prev.bestScore, score),
          };
        });
      }
    }
  }, [sensorReading, thresholds]);

  // ===== SIMULATION (fallback when no sensor connected) =====
  const startSimulation = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      timeRef.current += 0.05;
      const t = timeRef.current;
      const slouchWave = Math.max(0, Math.sin(t / 12) * 0.6 + Math.sin(t / 7) * 0.3);
      const micro = Math.sin(t * 2) * 0.5;

      const lp = 3 + slouchWave * 18 + micro;
      const lr = Math.sin(t / 9) * 5 * slouchWave;
      const rp = 3 + slouchWave * 16 + Math.cos(t * 1.3) * 0.4;
      const rr = Math.cos(t / 8) * 4 * slouchWave;
      const flex = 150 + slouchWave * 350;

      const simReading: SensorReading = {
        leftShoulder: { pitch: lp, roll: lr },
        rightShoulder: { pitch: rp, roll: rr },
        flexValue: flex,
        timestamp: Date.now(),
      };

      const { score, status } = calculateScoreFromSensors(simReading, thresholds);
      setPosture({
        score, status,
        leftShoulder: simReading.leftShoulder,
        rightShoulder: simReading.rightShoulder,
        flexValue: simReading.flexValue,
        uprightSeconds: status === 'good' ? 1 : 0,
        slouchSeconds: status !== 'good' ? 1 : 0,
        timestamp: Date.now(),
        source: 'simulation',
      });

      if (Math.floor(t * 10) % 100 === 0) {
        setStats(prev => {
          const addUp = status === 'good' ? 1 : 0;
          const addSl = status !== 'good' ? 1 : 0;
          const newUp = prev.todayUprightMinutes + addUp;
          const newSl = prev.todaySlouchMinutes + addSl;
          const total = newUp + newSl;
          return { ...prev, todayUprightMinutes: newUp, todaySlouchMinutes: newSl,
            todayPercentage: total > 0 ? Math.round((newUp / total) * 100) : 0,
            bestScore: Math.max(prev.bestScore, score) };
        });
      }
    }, 100);
    setIsMonitoring(true);
  }, [thresholds]);

  const stopSimulation = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsMonitoring(false);
  }, []);

  const recalibrate = useCallback(() => {
    timeRef.current = 0;
    setPosture(prev => ({ ...prev, score: 95, status: 'good', timestamp: Date.now() }));
  }, []);

  // Start simulation only if no real sensor data
  useEffect(() => {
    if (!sensorReading) {
      startSimulation();
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    } else {
      // Stop simulation when real data arrives
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      setIsMonitoring(true);
    }
  }, [sensorReading, startSimulation]);

  return { posture, stats, isMonitoring, recalibrate, setStats };
}
