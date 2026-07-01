import React from 'react';
import { motion } from 'motion/react';
import { Sliders, RotateCcw, Save, AlertTriangle } from 'lucide-react';
import type { ThresholdConfig } from '../hooks/useBluetoothSerial';

interface SensorThresholdsProps {
  thresholds: ThresholdConfig;
  onChange: (t: ThresholdConfig) => void;
  onReset: () => void;
}

function ThresholdSlider({ label, unit, value, min, max, step, sublabel, onChange }: {
  label: string; unit: string; value: number; min: number; max: number;
  step: number; sublabel: string; onChange: (v: number) => void;
}) {
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold text-on-surface">{label}</span>
          <span className="text-xs text-on-surface-muted ml-1.5">({sublabel})</span>
        </div>
        <span className="text-sm font-bold text-primary">{value}{unit}</span>
      </div>
      <div className="relative h-8 flex items-center">
        <div className="absolute inset-x-0 h-2 bg-surface-dim rounded-full">
          <div className="h-full bg-gradient-to-r from-success via-warning to-danger rounded-full"
            style={{ width: `${percent}%` }} />
        </div>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="absolute inset-x-0 w-full h-8 opacity-0 cursor-pointer z-10" />
        <div className="absolute h-5 w-5 bg-surface-elevated border-2 border-primary rounded-full shadow-md pointer-events-none"
          style={{ left: `calc(${percent}% - 10px)` }} />
      </div>
      <div className="flex justify-between text-[10px] text-on-surface-muted">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

function DualRangeSlider({ label, unit, value, min, max, step, sublabel, onChange }: {
  label: string; unit: string; value: [number, number]; min: number; max: number;
  step: number; sublabel: string; onChange: (v: [number, number]) => void;
}) {
  const minPercent = ((value[0] - min) / (max - min)) * 100;
  const maxPercent = ((value[1] - min) / (max - min)) * 100;

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.min(parseFloat(e.target.value), value[1] - step);
    onChange([val, value[1]]);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(parseFloat(e.target.value), value[0] + step);
    onChange([value[0], val]);
  };

  return (
    <div className="space-y-2">
      <style>{`
        .dual-range-thumb {
          pointer-events: none;
        }
        .dual-range-thumb::-webkit-slider-thumb {
          pointer-events: auto;
        }
        .dual-range-thumb::-moz-range-thumb {
          pointer-events: auto;
        }
      `}</style>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold text-on-surface">{label}</span>
          <span className="text-xs text-on-surface-muted ml-1.5">({sublabel})</span>
        </div>
        <span className="text-sm font-bold text-primary">Threshold: {value[0]}{unit} - {value[1]}{unit}</span>
      </div>
      <div className="relative h-8 flex items-center">
        <div className="absolute inset-x-0 h-2 bg-surface-dim rounded-full overflow-hidden">
          <div className="absolute h-full bg-gradient-to-r from-warning to-danger rounded-full"
            style={{ left: `${minPercent}%`, width: `${maxPercent - minPercent}%` }} />
        </div>
        <input type="range" min={min} max={max} step={step} value={value[0]}
          onChange={handleMinChange}
          className="dual-range-thumb absolute inset-x-0 w-full h-8 opacity-0 z-10" />
        <input type="range" min={min} max={max} step={step} value={value[1]}
          onChange={handleMaxChange}
          className="dual-range-thumb absolute inset-x-0 w-full h-8 opacity-0 z-20" />
        <div className="absolute h-5 w-5 bg-surface-elevated border-2 border-primary rounded-full shadow-md pointer-events-none z-30"
          style={{ left: `calc(${minPercent}% - 10px)` }} />
        <div className="absolute h-5 w-5 bg-surface-elevated border-2 border-primary rounded-full shadow-md pointer-events-none z-30"
          style={{ left: `calc(${maxPercent}% - 10px)` }} />
      </div>
      <div className="flex justify-between text-[10px] text-on-surface-muted">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

export function SensorThresholds({ thresholds, onChange, onReset }: SensorThresholdsProps) {
  const update = <K extends keyof ThresholdConfig>(key: K, val: ThresholdConfig[K]) => {
    onChange({ ...thresholds, [key]: val });
  };

  return (
    <div className="px-5 py-6 space-y-5">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 mb-1">
          <Sliders className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-extrabold text-on-surface">Threshold Settings</h2>
        </div>
        <p className="text-sm text-on-surface-muted">Set limits for each sensor. Alerts trigger when values exceed these thresholds.</p>
      </motion.div>

      {/* Alert Info */}
      <div className="bg-warning-light rounded-2xl p-4 flex gap-3 items-start">
        <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-on-surface">How Alerts Work</p>
          <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
            When any sensor reading goes <strong>above</strong> its threshold, the app triggers a vibration alert and shows a notification. Lower thresholds = stricter monitoring.
          </p>
        </div>
      </div>

      {/* Left Shoulder */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-surface-elevated rounded-2xl p-5 border border-outline-variant/10 space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-secondary" />
          <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Left Shoulder (MPU6050)</h3>
        </div>
        <DualRangeSlider label="Pitch" sublabel="forward lean" unit="°"
          value={thresholds.leftShoulderPitch} min={-180} max={180} step={1}
          onChange={v => update('leftShoulderPitch', v)} />
        <DualRangeSlider label="Roll" sublabel="side tilt" unit="°"
          value={thresholds.leftShoulderRoll} min={-180} max={180} step={1}
          onChange={v => update('leftShoulderRoll', v)} />
      </motion.div>

      {/* Right Shoulder */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="bg-surface-elevated rounded-2xl p-5 border border-outline-variant/10 space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Right Shoulder (MPU6050)</h3>
        </div>
        <DualRangeSlider label="Pitch" sublabel="forward lean" unit="°"
          value={thresholds.rightShoulderPitch} min={-180} max={180} step={1}
          onChange={v => update('rightShoulderPitch', v)} />
        <DualRangeSlider label="Roll" sublabel="side tilt" unit="°"
          value={thresholds.rightShoulderRoll} min={-180} max={180} step={1}
          onChange={v => update('rightShoulderRoll', v)} />
      </motion.div>

      {/* Flex Sensor */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-surface-elevated rounded-2xl p-5 border border-outline-variant/10 space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent" />
          <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Back Flex Sensor</h3>
        </div>
        <DualRangeSlider label="Bend Value" sublabel="higher = more bend" unit=""
          value={thresholds.flexThreshold} min={0} max={1000} step={10}
          onChange={v => update('flexThreshold', v)} />
      </motion.div>

      {/* Alert Delay */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="bg-surface-elevated rounded-2xl p-5 border border-outline-variant/10 space-y-5">
        <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Alert Delay</h3>
        <ThresholdSlider label="Delay" sublabel="after bad posture" unit="s"
          value={thresholds.alertDelayMs / 1000} min={2} max={30} step={1}
          onChange={v => update('alertDelayMs', v * 1000)} />
      </motion.div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button onClick={onReset}
          className="flex-1 py-3.5 rounded-xl border border-outline text-on-surface-variant font-semibold text-sm flex items-center justify-center gap-2 hover:bg-surface-dim transition-all active:scale-[0.97]">
          <RotateCcw className="w-4 h-4" /> Reset Defaults
        </button>
        <button className="flex-1 py-3.5 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/15 flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.97] transition-all">
          <Save className="w-4 h-4" /> Save Settings
        </button>
      </div>
    </div>
  );
}
