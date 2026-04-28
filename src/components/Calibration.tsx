import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Accessibility, Lightbulb, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';

interface CalibrationProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function Calibration({ onComplete, onCancel }: CalibrationProps) {
  const [step, setStep] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [progress, setProgress] = useState(0);
  const [isCalibrating, setIsCalibrating] = useState(false);

  const steps = [
    { title: 'Place Device', desc: 'Attach the sensor to your upper back between the shoulder blades' },
    { title: 'Sit Upright', desc: 'Sit in your best posture with ears aligned over shoulders' },
    { title: 'Hold Still', desc: 'Maintain position while we capture your baseline' },
    { title: 'Complete!', desc: 'Your neutral posture has been calibrated successfully' },
  ];

  useEffect(() => {
    if (step === 2 && isCalibrating) {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setStep(3);
      }
    }
  }, [step, countdown, isCalibrating]);

  useEffect(() => {
    if (step === 2 && isCalibrating) {
      const interval = setInterval(() => {
        setProgress(p => Math.min(p + 2, 100));
      }, 100);
      return () => clearInterval(interval);
    }
  }, [step, isCalibrating]);

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
      setIsCalibrating(true);
    } else if (step === 3) {
      onComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  return (
    <div className="px-5 py-6 space-y-5">
      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-2">
        {steps.map((_, i) => (
          <div key={i} className="flex-1 flex items-center gap-1">
            <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
              i <= step ? 'bg-primary' : 'bg-surface-container'
            }`} />
          </div>
        ))}
      </div>
      <p className="text-xs font-semibold text-primary uppercase tracking-wider">
        Step {step + 1} of {steps.length}
      </p>

      {/* Step Content */}
      <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
        className="bg-surface-elevated rounded-3xl p-6 shadow-sm border border-outline-variant/10">

        {step < 3 ? (
          <div className="flex flex-col items-center text-center">
            {/* Icon */}
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 ${
              step === 2 ? 'bg-primary-container' : 'bg-surface-dim'
            }`}>
              {step === 2 ? (
                <div className="relative">
                  <Accessibility className="w-10 h-10 text-primary" />
                  {isCalibrating && <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />}
                </div>
              ) : (
                <Accessibility className="w-10 h-10 text-on-surface-variant" />
              )}
            </div>

            <h2 className="text-2xl font-extrabold text-on-surface mb-2">{steps[step].title}</h2>
            <p className="text-sm text-on-surface-variant max-w-xs leading-relaxed">{steps[step].desc}</p>

            {/* Countdown Timer (Step 2) */}
            {step === 2 && isCalibrating && (
              <div className="mt-6">
                <div className="relative w-32 h-32 mx-auto">
                  <svg width="128" height="128" className="-rotate-90">
                    <circle cx="64" cy="64" r="56" fill="none" stroke="#E2E8F0" strokeWidth="5" />
                    <circle cx="64" cy="64" r="56" fill="none" stroke="#0D9488" strokeWidth="5"
                      strokeLinecap="round" strokeDasharray={351.86}
                      strokeDashoffset={351.86 * (countdown / 5)}
                      className="score-ring-fill" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-extrabold text-primary">{countdown}</span>
                    <span className="text-[10px] text-on-surface-muted uppercase font-bold tracking-wider">sec</span>
                  </div>
                </div>
                <div className="mt-4 w-full">
                  <div className="h-2 bg-surface-dim rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-xs text-on-surface-muted mt-2">{progress}% captured</p>
                </div>
              </div>
            )}

            {/* Body Silhouette (Step 0) */}
            {step === 0 && (
              <div className="mt-6 relative w-40 h-56">
                <svg viewBox="0 0 160 224" className="w-full h-full text-surface-container fill-current">
                  <path d="M80,16 C96,16 108,30 108,50 C108,70 96,82 80,82 C64,82 52,70 52,50 C52,30 64,16 80,16 M108,82 L125,100 L135,170 L125,220 L112,220 L115,170 L100,110 L60,110 L45,170 L48,220 L35,220 L28,170 L35,100 L52,82 Z" />
                </svg>
                {/* Sensor placement dots */}
                {[{ top: 95, label: 'C7' }, { top: 115, label: 'T6' }, { top: 140, label: 'L3' }].map((dot, i) => (
                  <div key={i} className="absolute left-1/2 -translate-x-1/2" style={{ top: dot.top }}>
                    <div className="relative">
                      {i === 1 && <div className="absolute -inset-2 animate-ping rounded-full bg-primary/25" />}
                      <div className="w-4 h-4 bg-primary rounded-full border-2 border-white shadow-sm flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Step 3: Complete */
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-20 h-20 rounded-full bg-success-light flex items-center justify-center mb-5">
              <CheckCircle className="w-10 h-10 text-success" />
            </div>
            <h2 className="text-2xl font-extrabold text-on-surface mb-2">All Set!</h2>
            <p className="text-sm text-on-surface-variant max-w-xs">Your neutral posture baseline has been captured. Start monitoring now.</p>
          </div>
        )}
      </motion.div>

      {/* Tips */}
      {step < 3 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-elevated rounded-xl p-3.5 border border-outline-variant/10 flex gap-2.5 items-start">
            <Lightbulb className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-on-surface-variant leading-relaxed">Imagine a string pulling your head toward the ceiling</p>
          </div>
          <div className="bg-warning-light rounded-xl p-3.5 flex gap-2.5 items-start">
            <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
            <p className="text-xs text-on-surface-variant leading-relaxed">Stay still during calibration for best results</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button onClick={onCancel}
          className="flex-1 py-3.5 rounded-xl text-on-surface-variant font-semibold text-sm border border-outline hover:bg-surface-dim transition-all">
          Cancel
        </button>
        {step !== 2 && (
          <button onClick={handleNext}
            className="flex-1 py-3.5 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/15 hover:opacity-90 active:scale-[0.97] transition-all flex items-center justify-center gap-2">
            {step === 3 ? 'Start Monitoring' : 'Next'}
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
