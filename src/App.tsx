import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Activity } from './components/Activity';
import { Sensors } from './components/Sensors';
import { Profile } from './components/Profile';
import { Calibration } from './components/Calibration';
import { SensorThresholds } from './components/SensorThresholds';
import { usePostureEngine } from './hooks/usePostureEngine';
import { useTrainingSession } from './hooks/useTrainingSession';
import { useUserProfile } from './hooks/useUserProfile';
import { useBluetoothSerial, DEFAULT_THRESHOLDS } from './hooks/useBluetoothSerial';
import type { ThresholdConfig } from './hooks/useBluetoothSerial';

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [showCalibration, setShowCalibration] = useState(false);
  const [showThresholds, setShowThresholds] = useState(false);
  const [thresholds, setThresholds] = useState<ThresholdConfig>(DEFAULT_THRESHOLDS);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const lastAlertRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const { profile } = useUserProfile();

  // Bluetooth HC-05 connection
  const {
    status: btStatus,
    sensorData,
    errorMessage: btError,
    rawDataLog,
    connect: btConnect,
    disconnect: btDisconnect,
    checkThresholds,
  } = useBluetoothSerial();

  // Posture engine (uses real sensor data when available, simulation otherwise)
  const { posture, stats, isMonitoring, recalibrate, setStats } = usePostureEngine(sensorData, thresholds);

  // Training sessions
  const {
    isTraining, elapsedSeconds, sessionHistory, program,
    vibrationEnabled, setVibrationEnabled, startTraining, stopTraining, addScore, formatTime,
  } = useTrainingSession();

  // Feed posture scores into training session
  useEffect(() => {
    if (isTraining) addScore(posture.score);
  }, [posture.score, isTraining, addScore]);

  // ===== THRESHOLD ALERT SYSTEM =====
  const playAlertSound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 660;
      osc.type = 'sine';
      gain.gain.value = 0.3;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.stop(ctx.currentTime + 0.4);
      // Second beep
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 880;
        osc2.type = 'sine';
        gain2.gain.value = 0.3;
        osc2.start();
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc2.stop(ctx.currentTime + 0.3);
      }, 200);
    } catch {}
  }, []);

  const fireNotification = useCallback((msg: string) => {
    if (profile.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Posture Alert', { body: msg });
    }
  }, [profile.notificationsEnabled]);

  useEffect(() => {
    if (!sensorData) return;
    const now = Date.now();
    if (now - lastAlertRef.current < thresholds.alertCooldownMs) return;

    const violations = checkThresholds(sensorData, thresholds);
    if (violations.length > 0) {
      lastAlertRef.current = now;
      setAlertMessage(violations[0]);
      playAlertSound();
      fireNotification(violations[0]);

      // Vibrate on mobile (only if not in training to avoid conflict)
      if (!isTraining && 'vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 300]);
      }

      // Auto-dismiss alert after 4 seconds
      setTimeout(() => setAlertMessage(null), 4000);
    }
  }, [sensorData, thresholds, checkThresholds, playAlertSound, fireNotification]);

  // Also check thresholds during simulation for demo purposes
  useEffect(() => {
    if (sensorData) return; // Only for simulation
    const now = Date.now();
    if (now - lastAlertRef.current < thresholds.alertCooldownMs) return;

    if (posture.status === 'bad') {
      lastAlertRef.current = now;
      const msg = posture.leftShoulder.pitch > thresholds.leftShoulderPitch
        ? `Left shoulder: ${posture.leftShoulder.pitch.toFixed(1)}° exceeds ${thresholds.leftShoulderPitch}° limit`
        : posture.flexValue > thresholds.flexThreshold
        ? `Back bend: ${posture.flexValue.toFixed(0)} exceeds ${thresholds.flexThreshold} limit`
        : 'Poor posture detected — sit up straight!';
      setAlertMessage(msg);
      playAlertSound();
      fireNotification(msg);
      if (!isTraining && 'vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      setTimeout(() => setAlertMessage(null), 4000);
    }
  }, [posture.status, posture.leftShoulder, posture.flexValue, sensorData, thresholds, playAlertSound, fireNotification]);

  const handleCalibrate = () => setShowCalibration(true);
  const handleCalibrationComplete = () => { recalibrate(); setShowCalibration(false); };
  const handleStopTraining = () => stopTraining(posture.score);
  const isConnected = btStatus === 'connected';

  // Show calibration overlay
  if (showCalibration) {
    return (
      <Layout activeTab={activeTab} setActiveTab={setActiveTab} isConnected={isConnected || isMonitoring}>
        <Calibration onComplete={handleCalibrationComplete} onCancel={() => setShowCalibration(false)} />
      </Layout>
    );
  }

  // Show threshold settings overlay
  if (showThresholds) {
    return (
      <Layout activeTab={activeTab} setActiveTab={setActiveTab} isConnected={isConnected || isMonitoring}>
        <SensorThresholds thresholds={thresholds}
          onChange={setThresholds}
          onReset={() => setThresholds(DEFAULT_THRESHOLDS)} />
        <div className="px-5 pb-6">
          <button onClick={() => setShowThresholds(false)}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/15 active:scale-[0.97] transition-all">
            ← Back to App
          </button>
        </div>
      </Layout>
    );
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'home':
        return (
          <>
            {/* Bluetooth Connection Bar */}
            <div className="px-4 pt-2">
              <div className="bg-surface-elevated rounded-xl p-2.5 border border-outline-variant/10 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-on-surface-muted'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-on-surface leading-tight">
                    {btStatus === 'connected' ? 'HC-05 Connected' :
                     btStatus === 'connecting' ? 'Connecting...' :
                     btStatus === 'error' ? 'Connection Error' :
                     'No Sensor Connected'}
                  </p>
                  {btError && <p className="text-[10px] text-danger truncate leading-tight">{btError}</p>}
                  {!isConnected && !btError && <p className="text-[10px] text-on-surface-muted leading-tight">Using simulated data</p>}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setShowThresholds(true)}
                    className="p-1.5 rounded-lg border border-outline text-on-surface-variant hover:bg-surface-dim transition-all">
                    <span className="text-[9px] font-bold uppercase tracking-wider">Settings</span>
                  </button>
                  {isConnected ? (
                    <button onClick={btDisconnect}
                      className="px-2 py-1.5 rounded-lg bg-danger/10 text-danger text-[10px] font-bold hover:bg-danger/20 transition-all uppercase tracking-wide">
                      Off
                    </button>
                  ) : (
                    <button onClick={btConnect}
                      className="px-2 py-1.5 rounded-lg bg-primary text-white text-[10px] font-bold hover:opacity-90 transition-all uppercase tracking-wide">
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </div>

            <Dashboard posture={posture} stats={stats} isMonitoring={isMonitoring}
              thresholds={thresholds} onCalibrate={handleCalibrate} />
          </>
        );
      case 'train':
        return (
          <Activity posture={posture} isTraining={isTraining} elapsedSeconds={elapsedSeconds}
            program={program} sessionHistory={sessionHistory} vibrationEnabled={vibrationEnabled}
            onStartTraining={startTraining} onStopTraining={handleStopTraining}
            onToggleVibration={setVibrationEnabled} formatTime={formatTime} />
        );
      case 'stats':
        return <Sensors stats={stats} sessionHistory={sessionHistory} />;
      case 'profile':
        return (
          <Profile 
            stats={stats} 
            btStatus={btStatus} 
            onConnectDevice={btConnect} 
            onDisconnectDevice={btDisconnect} 
          />
        );
      default:
        return null;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} isConnected={isConnected || isMonitoring}>
      {/* Alert Notification Toast */}
      {alertMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-[90%] animate-slide-up">
          <div className="bg-danger text-white rounded-2xl px-4 py-3 shadow-xl shadow-danger/20 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">⚠️</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider opacity-80">Posture Alert</p>
              <p className="text-sm font-medium truncate">{alertMessage}</p>
            </div>
            <button onClick={() => setAlertMessage(null)} className="text-white/60 hover:text-white text-lg font-bold">×</button>
          </div>
        </div>
      )}
      {renderActiveTab()}
    </Layout>
  );
}

export default App;