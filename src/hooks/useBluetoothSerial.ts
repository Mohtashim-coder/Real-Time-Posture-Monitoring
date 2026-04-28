import { useState, useRef, useCallback } from 'react';

/**
 * Parsed sensor data from Arduino via HC-05 Bluetooth Serial
 * 
 * Protocol: "L:<pitch>,<roll>|R:<pitch>,<roll>|F:<flexValue>\n"
 * Example:  "L:12.5,3.2|R:10.8,-1.5|F:450\n"
 * 
 * Hardware setup:
 * - MPU6050 #1 on LEFT shoulder
 * - MPU6050 #2 on RIGHT shoulder
 * - Flex sensor on BACK (spine)
 * - HC-05 Bluetooth module connected to Arduino TX
 */
export interface SensorReading {
  leftShoulder: { pitch: number; roll: number };
  rightShoulder: { pitch: number; roll: number };
  flexValue: number; // 0-1023 raw ADC value
  timestamp: number;
}

export interface ThresholdConfig {
  leftShoulderPitch: number;
  leftShoulderRoll: number;
  rightShoulderPitch: number;
  rightShoulderRoll: number;
  flexThreshold: number;
  alertCooldownMs: number;
}

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  leftShoulderPitch: 20,
  leftShoulderRoll: 15,
  rightShoulderPitch: 20,
  rightShoulderRoll: 15,
  flexThreshold: 400,
  alertCooldownMs: 5000,
};

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export function useBluetoothSerial() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [sensorData, setSensorData] = useState<SensorReading | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [rawDataLog, setRawDataLog] = useState<string[]>([]);

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const bufferRef = useRef<string>('');
  const isReadingRef = useRef(false);

  /**
   * Parse a single line of sensor data from Arduino
   * Format: "L:<pitch>,<roll>|R:<pitch>,<roll>|F:<flexValue>"
   */
  const parseSensorLine = useCallback((line: string): SensorReading | null => {
    try {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('L:')) return null;

      const parts = trimmed.split('|');
      if (parts.length !== 3) return null;

      // Parse left shoulder: "L:pitch,roll"
      const leftMatch = parts[0].match(/^L:([-\d.]+),([-\d.]+)$/);
      if (!leftMatch) return null;

      // Parse right shoulder: "R:pitch,roll"
      const rightMatch = parts[1].match(/^R:([-\d.]+),([-\d.]+)$/);
      if (!rightMatch) return null;

      // Parse flex sensor: "F:value"
      const flexMatch = parts[2].match(/^F:([\d.]+)$/);
      if (!flexMatch) return null;

      return {
        leftShoulder: {
          pitch: parseFloat(leftMatch[1]),
          roll: parseFloat(leftMatch[2]),
        },
        rightShoulder: {
          pitch: parseFloat(rightMatch[1]),
          roll: parseFloat(rightMatch[2]),
        },
        flexValue: parseFloat(flexMatch[1]),
        timestamp: Date.now(),
      };
    } catch {
      return null;
    }
  }, []);

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

        bufferRef.current += value;

        // Process complete lines
        const lines = bufferRef.current.split('\n');
        bufferRef.current = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            setRawDataLog(prev => [...prev.slice(-19), line.trim()]);
            const parsed = parseSensorLine(line);
            if (parsed) {
              setSensorData(parsed);
            }
          }
        }
      }
    } catch (err: any) {
      if (isReadingRef.current) {
        console.error('Read error:', err);
        setErrorMessage(err.message || 'Connection lost');
        setStatus('error');
      }
    }
  }, [parseSensorLine]);

  /**
   * Connect to HC-05 via Web Serial API
   * HC-05 default baud rate: 9600
   */
  const connect = useCallback(async () => {
    // Check Web Serial API support
    if (!('serial' in navigator)) {
      setErrorMessage('Web Serial API not supported. Use Chrome/Edge browser.');
      setStatus('error');
      return;
    }

    try {
      setStatus('connecting');
      setErrorMessage('');

      // Request user to select the HC-05 serial port
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });

      portRef.current = port;

      // Set up text decoder stream
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
        setErrorMessage(err.message || 'Connection failed');
        setStatus('error');
      }
    }
  }, [readLoop]);

  /**
   * Disconnect from the serial port
   */
  const disconnect = useCallback(async () => {
    isReadingRef.current = false;
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
      console.error('Disconnect error:', err);
    }
    setSensorData(null);
    setStatus('disconnected');
    setErrorMessage('');
    bufferRef.current = '';
  }, []);

  /**
   * Check if a sensor reading exceeds any threshold
   */
  const checkThresholds = useCallback((reading: SensorReading, thresholds: ThresholdConfig) => {
    const violations: string[] = [];

    if (Math.abs(reading.leftShoulder.pitch) > thresholds.leftShoulderPitch) {
      violations.push(`Left shoulder pitch: ${reading.leftShoulder.pitch.toFixed(1)}° (limit: ±${thresholds.leftShoulderPitch}°)`);
    }
    if (Math.abs(reading.leftShoulder.roll) > thresholds.leftShoulderRoll) {
      violations.push(`Left shoulder roll: ${reading.leftShoulder.roll.toFixed(1)}° (limit: ±${thresholds.leftShoulderRoll}°)`);
    }
    if (Math.abs(reading.rightShoulder.pitch) > thresholds.rightShoulderPitch) {
      violations.push(`Right shoulder pitch: ${reading.rightShoulder.pitch.toFixed(1)}° (limit: ±${thresholds.rightShoulderPitch}°)`);
    }
    if (Math.abs(reading.rightShoulder.roll) > thresholds.rightShoulderRoll) {
      violations.push(`Right shoulder roll: ${reading.rightShoulder.roll.toFixed(1)}° (limit: ±${thresholds.rightShoulderRoll}°)`);
    }
    if (reading.flexValue > thresholds.flexThreshold) {
      violations.push(`Flex sensor: ${reading.flexValue} (limit: ${thresholds.flexThreshold})`);
    }

    return violations;
  }, []);

  return {
    status,
    sensorData,
    errorMessage,
    rawDataLog,
    connect,
    disconnect,
    checkThresholds,
  };
}
