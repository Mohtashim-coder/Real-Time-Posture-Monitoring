import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { motion, AnimatePresence } from 'motion/react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Sensors } from './components/Sensors';
import { Profile } from './components/Profile';
import { SensorThresholds } from './components/SensorThresholds';
import { usePostureEngine } from './hooks/usePostureEngine';
import { useTrainingSession } from './hooks/useTrainingSession';
import { useUserProfile } from './hooks/useUserProfile';
import { useBluetoothSerial, DEFAULT_THRESHOLDS } from './hooks/useBluetoothSerial';
import type { ThresholdConfig } from './hooks/useBluetoothSerial';

function App() {
  const [activeTab, setActiveTabState] = useState('home');
  const [direction, setDirection] = useState(0);
  const [showThresholds, setShowThresholds] = useState(false);
  const [thresholds, setThresholds] = useState<ThresholdConfig>(DEFAULT_THRESHOLDS);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const badPostureStartRef = useRef<number | null>(null);
  const alertFiredRef = useRef<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const { profile } = useUserProfile();

  const tabOrder = ['home', 'stats', 'profile'];

  const setActiveTab = (newTab: string) => {
    const currentIndex = tabOrder.indexOf(activeTab);
    const newIndex = tabOrder.indexOf(newTab);
    setDirection(newIndex > currentIndex ? 1 : -1);
    setActiveTabState(newTab);
  };

  // Bluetooth connection (HM-10/HC-08 or HC-05)
  const {
    status: btStatus,
    sensorData,
    errorMessage: btError,
    rawDataLog,
    discoveredDevices,
    connect: btConnect,
    connectToNativeDevice,
    cancelScanning,
    disconnect: btDisconnect,
    checkThresholds,
  } = useBluetoothSerial();

  const [btMode, setBtMode] = useState<'ble' | 'serial'>('ble');

  // Posture engine (uses real sensor data when available, simulation otherwise)
  const { 
    posture, stats, isMonitoring, setStats,
    recordingPose, recordingCountdown, recordedPoses, startRecording
  } = usePostureEngine(sensorData, thresholds, setThresholds);

  // Hardware Back Button Support (Android)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const backListener = NativeApp.addListener('backButton', () => {
      if (showThresholds) {
        setShowThresholds(false);
      } else if (activeTab !== 'home') {
        setActiveTab('home');
      } else {
        NativeApp.exitApp();
      }
    });

    return () => {
      backListener.then(l => l.remove());
    };
  }, [activeTab, showThresholds]);

  // Training sessions (historical data used for Stats)
  const {
    sessionHistory,
  } = useTrainingSession();



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
    } catch { }
  }, []);

  const fireNotification = useCallback((msg: string) => {
    if (profile.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Posture Alert', { body: msg });
    }
  }, [profile.notificationsEnabled]);

  useEffect(() => {
    if (!sensorData || !isMonitoring) return;
    const now = Date.now();

    // Trigger alert based on the calibrated posture status rather than raw sensor values
    if (posture.status === 'warning' || posture.status === 'bad') {
      // Bad posture detected — start or continue tracking
      if (badPostureStartRef.current === null) {
        badPostureStartRef.current = now;
        alertFiredRef.current = false;
      }

      // Check if bad posture has been sustained long enough
      const elapsed = now - badPostureStartRef.current;
      if (elapsed >= thresholds.alertDelayMs && !alertFiredRef.current) {
        alertFiredRef.current = true;
        const msg = posture.status === 'warning' ? 'Adjust Posture!' : 'Sit Up Straight!';
        setAlertMessage(msg);
        playAlertSound();
        fireNotification(msg);

        // Vibrate on mobile
        if (Capacitor.isNativePlatform()) {
          const triggerHaptics = async () => {
            await Haptics.vibrate({ duration: 500 });
            setTimeout(() => Haptics.vibrate({ duration: 300 }), 700);
          };
          triggerHaptics();
        } else if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200, 100, 300]);
        }

        // Auto-dismiss alert after 4 seconds
        setTimeout(() => setAlertMessage(null), 4000);
      }
    } else {
      // Good posture — reset the timer
      badPostureStartRef.current = null;
      alertFiredRef.current = false;
    }
  }, [posture.status, sensorData, isMonitoring, thresholds.alertDelayMs, playAlertSound, fireNotification]);



  const isConnected = btStatus === 'connected';

  // Show native device scanning overlay
  if (btStatus === 'scanning') {
    return (
      <Layout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isConnected={isConnected || isMonitoring}
        onConnect={() => btConnect(btMode)}
        disableSwipe={true}
      >
        <div className="flex-1 flex flex-col p-6 items-center justify-center bg-background">
          <div className="bg-surface-elevated rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-5 border border-outline-variant/20">
            <h2 className="text-xl font-bold text-on-surface text-center tracking-tight">Nearby Devices</h2>
            <div className="flex justify-center py-2">
              <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            </div>
            
            <div className="flex flex-col gap-3 max-h-[45vh] overflow-y-auto px-1 pb-1">
              {discoveredDevices.length === 0 ? (
                <p className="text-sm text-center text-on-surface-muted py-4">Scanning for nearby HC-05 modules...</p>
              ) : (
                discoveredDevices.map(device => (
                  <button 
                    key={device.id} 
                    onClick={() => connectToNativeDevice(device.id)}
                    className="p-4 bg-surface rounded-2xl border border-outline-variant shadow-sm text-left hover:border-primary/50 hover:shadow-md transition-all active:scale-[0.98]"
                  >
                    <p className="font-bold text-on-surface text-[15px]">{device.name || 'Unknown Device'}</p>
                    <p className="text-xs text-on-surface-muted mt-1 font-mono">{device.id}</p>
                  </button>
                ))
              )}
            </div>
            
            <button 
              onClick={cancelScanning}
              className="mt-2 w-full py-3.5 rounded-2xl border border-outline-variant text-on-surface-variant font-bold hover:bg-surface-dim transition-colors active:scale-[0.98]"
            >
              Cancel Search
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // Show threshold settings overlay
  if (showThresholds) {
    return (
      <Layout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isConnected={isConnected || isMonitoring}
        onConnect={() => btConnect(btMode)}
        disableSwipe={true}
      >
        <div className="flex-1 overflow-y-auto overflow-x-hidden pb-[80px]">
          <SensorThresholds thresholds={thresholds}
            onChange={setThresholds}
            onReset={() => setThresholds(DEFAULT_THRESHOLDS)} />
          <div className="px-5 pb-6">
            <button onClick={() => setShowThresholds(false)}
              className="w-full py-4 rounded-2xl bg-surface-elevated border border-outline-variant/30 text-on-surface font-bold text-sm shadow-sm active:scale-[0.97] transition-all flex items-center justify-center gap-2">
              <span className="text-lg">←</span> Back to Dashboard
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="px-2 pt-4 pb-12 space-y-4">
            {/* Bluetooth Connection Bar */}
            <div className="bg-surface-elevated rounded-[28px] px-4 py-3 border border-outline-variant/10 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-on-surface-muted'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-on-surface leading-tight">
                  {btStatus === 'connected' ? 'Sensor Connected' :
                    btStatus === 'connecting' ? 'Connecting...' :
                      btStatus === 'error' ? 'Connection Error' :
                        'No Sensor Connected'}
                </p>
                {btError && <p className="text-[10px] text-danger truncate leading-tight">{btError}</p>}
                {!isConnected && !btError && !Capacitor.isNativePlatform() && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <select 
                      value={btMode} 
                      onChange={(e) => setBtMode(e.target.value as 'ble' | 'serial')}
                      className="bg-surface-dim text-[10px] font-bold text-on-surface-muted border-none p-0 focus:ring-0 cursor-pointer hover:text-primary transition-colors"
                    >
                      <option value="ble">BLE (HM-10)</option>
                      <option value="serial">SERIAL (HC-05)</option>
                    </select>
                  </div>
                )}
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
                  <button onClick={() => btConnect(btMode)}
                    className="px-2 py-1.5 rounded-lg bg-primary text-white text-[10px] font-bold hover:opacity-90 transition-all uppercase tracking-wide">
                    Connect
                  </button>
                )}
              </div>
            </div>

            <Dashboard posture={posture} stats={stats} isMonitoring={isMonitoring}
              thresholds={thresholds} 
              onRecordPosture={startRecording}
              recordingPose={recordingPose}
              recordingCountdown={recordingCountdown}
              recordedPoses={recordedPoses}
              rawDataLog={rawDataLog} isConnected={isConnected} />
          </div>
        );

      case 'stats':
        return <Sensors stats={stats} sessionHistory={sessionHistory} />;
      case 'profile':
        return (
          <Profile
            stats={stats}
            btStatus={btStatus}
            onConnectDevice={() => btConnect(btMode)}
            onDisconnectDevice={btDisconnect}
          />
        );
      default:
        return null;
    }
  };

  const slideVariants = {
    enter: (direction: number) => {
      return {
        x: direction > 0 ? '100%' : '-100%',
        opacity: 0
      };
    },
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => {
      return {
        zIndex: 0,
        x: direction < 0 ? '100%' : '-100%',
        opacity: 0
      };
    }
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      isConnected={isConnected || isMonitoring}
      onConnect={() => btConnect(btMode)}
    >
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
      <div className="flex-1 relative w-full h-full overflow-hidden">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            className="absolute inset-0 w-full h-full flex flex-col overflow-y-auto overflow-x-hidden pb-[68px]"
          >
            {renderActiveTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    </Layout>
  );
}

export default App;