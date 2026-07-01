import { useState, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Parsed sensor data from Arduino via Bluetooth (BLE or Classic Serial)
 * 
 * Protocol: "L:<pitch>,<roll>|R:<pitch>,<roll>|F:<flexValue>\n"
 * Example:  "L:12.5,3.2|R:10.8,-1.5|F:450\n"
 * 
 * Hardware setup:
 * - MPU6050 #1 on LEFT shoulder
 * - MPU6050 #2 on RIGHT shoulder
 * - Flex sensor on BACK (spine)
 * - HM-10/HC-08 (BLE) or HC-05 (Classic) Bluetooth module connected to Arduino TX
 * 
 * Connection strategy:
 * 1. Try Web Bluetooth API (BLE) first — works on mobile Chrome, desktop Chrome/Edge
 * 2. Fall back to Web Serial API — works on desktop Chrome/Edge for classic Bluetooth
 */
export interface SensorReading {
  leftShoulder: { pitch: number; roll: number };
  rightShoulder: { pitch: number; roll: number };
  flexValue: number; // 0-1023 raw ADC value
  timestamp: number;
}

export interface ThresholdConfig {
  leftShoulderPitch: [number, number];
  leftShoulderRoll: [number, number];
  rightShoulderPitch: [number, number];
  rightShoulderRoll: [number, number];
  flexThreshold: [number, number];
  alertDelayMs: number;
}

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  leftShoulderPitch: [20, 180],
  leftShoulderRoll: [-15, 15],
  rightShoulderPitch: [-180, -10],
  rightShoulderRoll: [-25, 25],
  flexThreshold: [604, 1023],
  alertDelayMs: 5000,
};

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'scanning';
type ConnectionMode = 'ble' | 'serial' | null;

export interface DiscoveredDevice {
  name?: string;
  id: string; // MAC address
}

// Standard HM-10 / CC2541 UART Service UUIDs
const BLE_SERVICE_UUID = 0xFFE0;
const BLE_CHARACTERISTIC_UUID = 0xFFE1;

export function useBluetoothSerial() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [sensorData, setSensorData] = useState<SensorReading | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [rawDataLog, setRawDataLog] = useState<string[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);

  // Shared
  const [activeMode, setActiveMode] = useState<ConnectionMode>(null);

  // BLE refs
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

  // Web Serial refs
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const isReadingRef = useRef(false);

  // Shared
  const bufferRef = useRef<string>('');
  const modeRef = useRef<ConnectionMode>(null);
  const rawReadingsBuffer = useRef<SensorReading[]>([]);

  /**
   * Parse a single line of sensor data from Arduino
   * Format: "L:<pitch>,<roll>|R:<pitch>,<roll>|F:<flexValue>"
   */
  const parseSensorLine = useCallback((line: string): SensorReading | null => {
    try {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('L:')) return null;

      const parts = trimmed.split('|');
      if (parts.length < 2) return null;

      // Parse left shoulder: "L:pitch,roll"
      const leftMatch = parts[0].match(/^L:([-\d.]+),([-\d.]+)$/);
      if (!leftMatch) return null;

      // Parse right shoulder: "R:pitch,roll"
      const rightMatch = parts[1].match(/^R:([-\d.]+),([-\d.]+)$/);
      if (!rightMatch) return null;

      // Parse flex sensor: "F:value" (make it optional)
      let flexVal = 0;
      if (parts.length >= 3) {
        const flexMatch = parts[2].match(/^F:([\d.]+)$/);
        if (flexMatch) {
          flexVal = parseFloat(flexMatch[1]);
        }
      }

      return {
        leftShoulder: {
          pitch: parseFloat(leftMatch[1]),
          roll: parseFloat(leftMatch[2]),
        },
        rightShoulder: {
          pitch: parseFloat(rightMatch[1]),
          roll: parseFloat(rightMatch[2]),
        },
        flexValue: flexVal,
        timestamp: Date.now(),
      };
    } catch {
      return null;
    }
  }, []);

  /**
   * Process incoming text chunks (shared between BLE and Serial)
   */
  const processIncomingText = useCallback((text: string) => {
    bufferRef.current += text;

    // Process complete lines
    const lines = bufferRef.current.split('\n');
    bufferRef.current = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        setRawDataLog(prev => [...prev.slice(-19), line.trim()]);
        const parsed = parseSensorLine(line);
        if (parsed) {
          rawReadingsBuffer.current.push(parsed);
          if (rawReadingsBuffer.current.length > 3) {
            rawReadingsBuffer.current.shift();
          }

          if (rawReadingsBuffer.current.length > 0) {
            const avgReading: SensorReading = {
              leftShoulder: { pitch: 0, roll: 0 },
              rightShoulder: { pitch: 0, roll: 0 },
              flexValue: 0,
              timestamp: parsed.timestamp,
            };

            for (const r of rawReadingsBuffer.current) {
              avgReading.leftShoulder.pitch += r.leftShoulder.pitch;
              avgReading.leftShoulder.roll += r.leftShoulder.roll;
              avgReading.rightShoulder.pitch += r.rightShoulder.pitch;
              avgReading.rightShoulder.roll += r.rightShoulder.roll;
              avgReading.flexValue += r.flexValue;
            }

            const count = rawReadingsBuffer.current.length;
            avgReading.leftShoulder.pitch /= count;
            avgReading.leftShoulder.roll /= count;
            avgReading.rightShoulder.pitch /= count;
            avgReading.rightShoulder.roll /= count;
            avgReading.flexValue /= count;

            setSensorData(avgReading);
          }
        }
      }
    }
  }, [parseSensorLine]);

  // ==================== WEB SERIAL (Classic Bluetooth / HC-05) ====================

  /**
   * Continuously read data from the serial port
   */
  const readLoop = useCallback(async (reader: ReadableStreamDefaultReader<string>) => {
    isReadingRef.current = true;
    try {
      while (isReadingRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        processIncomingText(value);
      }
    } catch (err: any) {
      if (isReadingRef.current) {
        console.error('Serial read error:', err);
        setErrorMessage(err.message || 'Connection lost');
        setStatus('error');
      }
    }
  }, [processIncomingText]);

  /**
   * Connect via Web Serial API (HC-05 Classic Bluetooth) or Native App
   */
  const connectSerial = useCallback(async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const btSerial = (window as any).bluetoothSerial;
        if (!btSerial) {
          throw new Error('Native Bluetooth Serial plugin not available.');
        }
        
        setStatus('scanning');
        setErrorMessage('');
        setDiscoveredDevices([]);

        btSerial.discoverUnpaired(
          (devices: any[]) => {
            // Some devices might not have names, we'll filter them out or keep them depending on preference.
            // Let's keep ones with names to make the list cleaner, or just pass all.
            setDiscoveredDevices(devices.filter(d => d.id));
          },
          (err: any) => {
            setErrorMessage(err?.toString() || 'Failed to discover devices');
            setStatus('error');
          }
        );
        return;
      }
      if (!('serial' in navigator)) {
        throw new Error('Web Serial API not supported in this browser.');
      }
      setStatus('connecting');
      setErrorMessage('');

      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });

      portRef.current = port;
      modeRef.current = 'serial';
      setActiveMode('serial');

      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      readerRef.current = reader;

      setStatus('connected');
      readLoop(reader);
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        setErrorMessage('No device selected');
        setStatus('disconnected');
      } else {
        setErrorMessage(err.message || 'Serial connection failed');
        setStatus('error');
      }
    }
  }, [readLoop]);

  /**
   * Connect directly to a discovered native device
   */
  const connectToNativeDevice = useCallback((deviceId: string) => {
    const btSerial = (window as any).bluetoothSerial;
    if (!btSerial) return;

    setStatus('connecting');
    setErrorMessage('');

    btSerial.connect(deviceId, 
      () => {
        setStatus('connected');
        modeRef.current = 'serial';
        setActiveMode('serial');
        
        btSerial.subscribe('\n', (data: string) => {
          processIncomingText(data);
        }, (err: any) => {
          console.error('Bluetooth Serial Read Error:', err);
        });
      },
      (err: any) => {
        setErrorMessage(err?.toString() || 'Connection failed');
        setStatus('error');
      }
    );
  }, [processIncomingText]);

  // ==================== WEB BLUETOOTH (BLE / HM-10 / HC-08) ====================

  /**
   * Disconnect handler for BLE
   */
  const disconnectBLE = useCallback(() => {
    try {
      if (characteristicRef.current) {
        characteristicRef.current.stopNotifications().catch(console.error);
        characteristicRef.current = null;
      }
      if (deviceRef.current && deviceRef.current.gatt?.connected) {
        deviceRef.current.gatt.disconnect();
      }
      deviceRef.current = null;
    } catch (err) {
      console.error('BLE disconnect error:', err);
    }
  }, []);

  /**
   * Connect via Web Bluetooth API (HM-10/HC-08 BLE)
   */
  const connectBLE = useCallback(async () => {
    try {
      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth API not supported in this browser.');
      }
      setStatus('connecting');
      setErrorMessage('');

      const device = await navigator.bluetooth.requestDevice({
        // Standard filters for HM-10 / generic serial modules
        filters: [
          { services: [BLE_SERVICE_UUID] },
          { namePrefix: 'BT' },
          { namePrefix: 'HM' },
          { namePrefix: 'HC' },
          { namePrefix: 'Posture' }
        ],
        optionalServices: [BLE_SERVICE_UUID, '0000ffe0-0000-1000-8000-00805f9b34fb']
      }).catch(async (err) => {
        // Fallback to "acceptAllDevices" if filtered scan fails or is too restrictive
        if (err.name === 'NotFoundError') throw err;
        return await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [BLE_SERVICE_UUID, '0000ffe0-0000-1000-8000-00805f9b34fb']
        });
      });

      deviceRef.current = device;
      modeRef.current = 'ble';
      setActiveMode('ble');

      // Listen for unexpected disconnection
      device.addEventListener('gattserverdisconnected', () => {
        setSensorData(null);
        setStatus('disconnected');
        setErrorMessage('Device disconnected');
        bufferRef.current = '';
        modeRef.current = null;
        setActiveMode(null);
      });

      // Connect to GATT Server
      const server = await device.gatt?.connect();
      if (!server) throw new Error('Failed to connect to GATT server');

      // Get Service & Characteristic
      const service = await server.getPrimaryService(BLE_SERVICE_UUID).catch(() =>
        server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb')
      );

      const characteristic = await service.getCharacteristic(BLE_CHARACTERISTIC_UUID).catch(() =>
        service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb')
      );

      characteristicRef.current = characteristic;

      // Start receiving notifications
      await characteristic.startNotifications();

      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
        if (!value) return;
        const decoder = new TextDecoder('utf-8');
        processIncomingText(decoder.decode(value));
      });

      setStatus('connected');
    } catch (err: any) {
      console.error('BLE connection error:', err);
      if (err.name === 'NotFoundError') {
        setErrorMessage('No device selected');
        setStatus('disconnected');
      } else if (err.message?.includes('User cancelled')) {
        setErrorMessage('Connection cancelled');
        setStatus('disconnected');
      } else {
        setErrorMessage(err.message || 'BLE connection failed');
        setStatus('error');
      }
    }
  }, [processIncomingText]);

  // ==================== UNIFIED CONNECT / DISCONNECT ====================

  /**
   * Smart connect: allows selecting preferred mode
   * @param preferredMode 'ble' for HM-10/HC-08, 'serial' for HC-05
   */
  const connect = useCallback(async (preferredMode?: ConnectionMode) => {
    if (Capacitor.isNativePlatform()) {
      await connectSerial();
      return;
    }

    const hasBLE = typeof navigator !== 'undefined' && !!navigator.bluetooth;
    const hasSerial = typeof navigator !== 'undefined' && 'serial' in navigator;

    if (preferredMode === 'ble' && hasBLE) {
      await connectBLE();
    } else if (preferredMode === 'serial' && hasSerial) {
      await connectSerial();
    } else if (hasBLE) {
      // Default fallback
      await connectBLE();
    } else if (hasSerial) {
      await connectSerial();
    } else {
      setErrorMessage('No Bluetooth API available. Use Chrome or Edge browser.');
      setStatus('error');
    }
  }, [connectBLE, connectSerial]);

  /**
   * Disconnect from whichever mode is active
   */
  const disconnect = useCallback(async () => {
    const mode = modeRef.current;

    if (mode === 'ble') {
      disconnectBLE();
    } else if (mode === 'serial') {
      isReadingRef.current = false;
      if (Capacitor.isNativePlatform() && (window as any).bluetoothSerial) {
        (window as any).bluetoothSerial.unsubscribe();
        (window as any).bluetoothSerial.disconnect();
      } else {
        try {
          if (readerRef.current) {
            await readerRef.current.cancel();
            readerRef.current = null;
          }
          if (portRef.current) {
            await portRef.current.close();
            portRef.current = null;
          }
        } catch (err) {
          console.error('Serial disconnect error:', err);
        }
      }
    }

    modeRef.current = null;
    setActiveMode(null);
    setSensorData(null);
    setStatus('disconnected');
    setErrorMessage('');
    bufferRef.current = '';
    rawReadingsBuffer.current = [];
  }, [disconnectBLE]);

  /**
   * Check if a sensor reading exceeds any threshold
   */
  const checkThresholds = useCallback((reading: SensorReading, thresholds: ThresholdConfig, flexBaseline: number = 590) => {
    const violations: string[] = [];

    const checkRange = (val: number, range: [number, number]) => val >= range[0] && val <= range[1];

    if (checkRange(reading.leftShoulder.pitch, thresholds.leftShoulderPitch)) {
      violations.push(`Left shoulder pitch: ${reading.leftShoulder.pitch.toFixed(1)}° (in range: ${thresholds.leftShoulderPitch[0]}°-${thresholds.leftShoulderPitch[1]}°)`);
    }
    // Roll thresholds represent the SAFE range, so violation is when the value is OUTSIDE the range
    if (!checkRange(reading.leftShoulder.roll, thresholds.leftShoulderRoll)) {
      violations.push(`Left shoulder roll: ${reading.leftShoulder.roll.toFixed(1)}° (outside range: ${thresholds.leftShoulderRoll[0]}° to ${thresholds.leftShoulderRoll[1]}°)`);
    }
    if (checkRange(reading.rightShoulder.pitch, thresholds.rightShoulderPitch)) {
      violations.push(`Right shoulder pitch: ${reading.rightShoulder.pitch.toFixed(1)}° (in range: ${thresholds.rightShoulderPitch[0]}°-${thresholds.rightShoulderPitch[1]}°)`);
    }
    // Roll thresholds represent the SAFE range, so violation is when the value is OUTSIDE the range
    if (!checkRange(reading.rightShoulder.roll, thresholds.rightShoulderRoll)) {
      violations.push(`Right shoulder roll: ${reading.rightShoulder.roll.toFixed(1)}° (outside range: ${thresholds.rightShoulderRoll[0]}° to ${thresholds.rightShoulderRoll[1]}°)`);
    }
    // Flex baseline check
    const allowedFlexDeviation = Math.max(10, thresholds.flexThreshold[0] - 590);
    const flexDeviation = reading.flexValue - flexBaseline;
    if (flexDeviation > allowedFlexDeviation) {
      violations.push(`Flex sensor deviation: +${Math.round(flexDeviation)} (threshold: +${Math.round(allowedFlexDeviation)})`);
    }

    return violations;
  }, []);

  return {
    status,
    activeMode,
    sensorData,
    errorMessage,
    rawDataLog,
    discoveredDevices,
    connect,
    connectToNativeDevice,
    disconnect,
    checkThresholds,
    cancelScanning: () => setStatus('disconnected')
  };
}
