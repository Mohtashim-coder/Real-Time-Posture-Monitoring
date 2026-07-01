import React from 'react';

interface PostureAvatarProps {
  score: number;
  status: 'good' | 'warning' | 'bad';
  leftShoulder?: { pitch: number; roll: number };
  rightShoulder?: { pitch: number; roll: number };
  flexValue?: number;
  size?: number;
  showPulse?: boolean;
  view?: 'front' | 'side';
}

export function PostureAvatar({
  score, status, leftShoulder, rightShoulder, flexValue,
  size = 200, showPulse = true, view = 'front'
}: PostureAvatarProps) {
  const colors = {
    good: { primary: '#10B981', secondary: '#34D399', glow: 'rgba(16, 185, 129, 0.2)' },
    warning: { primary: '#F59E0B', secondary: '#FBBF24', glow: 'rgba(245, 158, 11, 0.2)' },
    bad: { primary: '#EF4444', secondary: '#F87171', glow: 'rgba(239, 68, 68, 0.2)' },
  };
  const c = colors[status];

  // Values are now CALIBRATED (0 = straight sitting). Clamp for safety.
  const lPitch = leftShoulder ? Math.max(-45, Math.min(45, leftShoulder.pitch)) : 0;
  const rPitch = rightShoulder ? Math.max(-45, Math.min(45, rightShoulder.pitch)) : 0;
  const lRoll = leftShoulder ? Math.max(-60, Math.min(60, leftShoulder.roll)) : 0;
  const rRoll = rightShoulder ? Math.max(-60, Math.min(60, rightShoulder.roll)) : 0;

  // Forward lean from calibrated pitch:
  //   Left pitch increases (positive) when slouching forward
  //   Right pitch decreases (negative) when slouching forward
  //   Symmetric forward component: (lPitch - rPitch) / 2
  const leftForward = lPitch;
  const rightForward = -rPitch;
  const forwardAmount = (leftForward + rightForward) / 2; // positive = forward lean

  // Shoulder asymmetry (true tilt, not forward lean)
  const shoulderAsymmetry = (leftForward - rightForward) * 0.8;

  // Roll crosstalk suppression:
  //   When leaning forward, roll sensors shift by ~2.2x the forward lean amount.
  //   Subtract this crosstalk to get the real sideways lean.
  const correctedLRoll = lRoll - leftForward * 2.2;
  const correctedRRoll = rRoll - rightForward * 2.2;

  // Flex sensor (already calibrated: 0 = straight)
  const flex = flexValue !== undefined ? Math.max(0, flexValue) : 0;

  // Visual scaling
  const pitchScale = 1.2;
  const forwardLean = forwardAmount * pitchScale;

  // Side bend from corrected roll (only real sideways lean, not crosstalk)
  const sideBend = ((correctedLRoll + correctedRRoll) / 2) * 0.8;
  const headTilt = (correctedLRoll - correctedRRoll) * 0.6;

  // Shoulder drop from asymmetry
  const shoulderDrop = shoulderAsymmetry * 0.6;

  // Flex sensor contributes to side-view slouch
  const flexSlouch = (flex / 50) * 15;

  // Total vertical slouch offset
  const slouchOffset = leftShoulder ? (forwardLean * 0.5 + flexSlouch) : Math.max(0, (100 - score) / 100) * 20;
  const tilt = leftShoulder ? headTilt : 0;

  // Sideways spine curve
  const spineCurve = leftShoulder ? sideBend * 1.0 : 0;

  // Side view: forward curve based on both pitch lean and flex
  const flexCurve = leftShoulder ? (forwardLean * 0.8 + flexSlouch * 0.5) : 0;

  // Individual sensor colors based on calibrated deviation
  const lColor = Math.abs(lPitch) > 20 ? '#EF4444' : Math.abs(lPitch) > 10 ? '#F59E0B' : c.primary;
  const rColor = Math.abs(rPitch) > 20 ? '#EF4444' : Math.abs(rPitch) > 10 ? '#F59E0B' : c.primary;
  const backColor = flex > 30 ? '#EF4444' : flex > 15 ? '#F59E0B' : c.primary;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size * 1.4 }}>
      {showPulse && (
        <div className="absolute rounded-full animate-pulse-ring"
          style={{ width: size * 0.7, height: size * 0.7, background: c.glow, top: '15%', opacity: 0.4 }} />
      )}
      <svg viewBox="0 0 200 280" width={size} height={size * 1.4} className="relative z-10">
        <defs>
          <linearGradient id={`grad-${status}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={c.secondary} stopOpacity="1" />
            <stop offset="100%" stopColor={c.primary} stopOpacity="1" />
          </linearGradient>
          <linearGradient id={`spineGrad-${status}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={c.primary} stopOpacity="0.8" />
            <stop offset="100%" stopColor={backColor} stopOpacity="0.8" />
          </linearGradient>
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {view === 'front' ? (
          <>
            {/* Head */}
            <circle cx={100 + tilt + spineCurve * 0.8} cy={42 + slouchOffset * 0.5} r="26" fill={`url(#grad-${status})`} 
              filter={status === 'good' ? 'url(#softGlow)' : 'none'}
              style={{ transition: 'all 0.5s ease' }} />
            
            {/* Face */}
            <circle cx={92 + tilt + spineCurve * 0.8} cy={38 + slouchOffset * 0.5} r="2" fill="white" opacity="0.9" />
            <circle cx={108 + tilt + spineCurve * 0.8} cy={38 + slouchOffset * 0.5} r="2" fill="white" opacity="0.9" />
            {status === 'good' && (
              <path d={`M ${92 + tilt + spineCurve * 0.8} ${48 + slouchOffset * 0.5} Q ${100 + tilt + spineCurve * 0.8} ${55 + slouchOffset * 0.5} ${108 + tilt + spineCurve * 0.8} ${48 + slouchOffset * 0.5}`}
                stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.9" />
            )}
            {status === 'warning' && (
              <line x1={93 + tilt + spineCurve * 0.8} y1={50 + slouchOffset * 0.5} x2={107 + tilt + spineCurve * 0.8} y2={50 + slouchOffset * 0.5}
                stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
            )}
            {status === 'bad' && (
              <path d={`M ${92 + tilt + spineCurve * 0.8} ${53 + slouchOffset * 0.5} Q ${100 + tilt + spineCurve * 0.8} ${46 + slouchOffset * 0.5} ${108 + tilt + spineCurve * 0.8} ${53 + slouchOffset * 0.5}`}
                stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.9" />
            )}

            {/* Neck */}
            <rect x={97 + tilt * 0.5 + spineCurve * 0.6} y={66 + slouchOffset * 0.4} width="7" height="16" rx="3.5"
              fill={c.primary} opacity="0.8" style={{ transition: 'all 0.5s ease' }} />

            {/* Spine line — curves based on roll and flex */}
            <path d={`M ${100 + tilt * 0.3 + spineCurve * 0.5} ${82 + slouchOffset * 0.4} Q ${100 + spineCurve * 1.5} ${130 + slouchOffset * 0.2} ${100 + spineCurve * 0.2} ${172}`}
              stroke={`url(#spineGrad-${status})`} strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.4"
              strokeDasharray="1 6" style={{ transition: 'all 0.5s ease' }} />

            {/* Torso */}
            <path d={`M ${68 + slouchOffset * 0.2 + spineCurve * 0.5} ${84 + slouchOffset * 0.3 - shoulderDrop * 0.5}
              Q ${100 + spineCurve * 1.2} ${80 + slouchOffset * 0.2} ${132 - slouchOffset * 0.2 + spineCurve * 0.5} ${84 + slouchOffset * 0.3 + shoulderDrop * 0.5}
              L ${126 + spineCurve * 0.2} 168 Q ${100 + spineCurve * 0.5} 173 ${74 + spineCurve * 0.2} 168 Z`}
              fill={`url(#grad-${status})`} opacity="0.7" style={{ transition: 'all 0.5s ease' }} />

            {/* Left Arm */}
            <path d={`M ${68 + slouchOffset * 0.2 + spineCurve * 0.5} ${88 + slouchOffset * 0.3 - shoulderDrop * 0.5}
              Q ${44 + lPitch * 0.3 + spineCurve * 0.3} ${128} ${48 + spineCurve * 0.1} ${168}`}
              stroke={lColor} strokeWidth="11" strokeLinecap="round" fill="none" opacity="0.65"
              style={{ transition: 'all 0.5s ease' }} />
            <circle cx={68 + slouchOffset * 0.2 + spineCurve * 0.5} cy={88 + slouchOffset * 0.3 - shoulderDrop * 0.5}
              r="6" fill={lColor} opacity="0.9" style={{ transition: 'all 0.5s ease' }} />

            {/* Right Arm */}
            <path d={`M ${132 - slouchOffset * 0.2 + spineCurve * 0.5} ${88 + slouchOffset * 0.3 + shoulderDrop * 0.5}
              Q ${156 - rPitch * 0.3 + spineCurve * 0.3} ${128} ${152 + spineCurve * 0.1} ${168}`}
              stroke={rColor} strokeWidth="11" strokeLinecap="round" fill="none" opacity="0.65"
              style={{ transition: 'all 0.5s ease' }} />
            <circle cx={132 - slouchOffset * 0.2 + spineCurve * 0.5} cy={88 + slouchOffset * 0.3 + shoulderDrop * 0.5}
              r="6" fill={rColor} opacity="0.9" style={{ transition: 'all 0.5s ease' }} />

            {/* Left Leg */}
            <path d={`M ${82 + spineCurve * 0.2} 166 L 76 238 L 72 262`} stroke={c.primary} strokeWidth="12"
              strokeLinecap="round" fill="none" opacity="0.5" style={{ transition: 'all 0.5s ease' }} />
            {/* Right Leg */}
            <path d={`M ${118 + spineCurve * 0.2} 166 L 124 238 L 128 262`} stroke={c.primary} strokeWidth="12"
              strokeLinecap="round" fill="none" opacity="0.5" style={{ transition: 'all 0.5s ease' }} />

            {/* Sensor labels (when real data is present) */}
            {leftShoulder && (
              <g className="sensor-label">
                <text x="25" y={88 - shoulderDrop * 0.5} fill={lColor} fontSize="11" fontWeight="900"
                  textAnchor="middle">L</text>
                <text x="25" y={102 - shoulderDrop * 0.5} fill={lColor} fontSize="10" fontWeight="700"
                  textAnchor="middle">P {lPitch.toFixed(0)}°</text>
                <text x="25" y={114 - shoulderDrop * 0.5} fill={lColor} fontSize="9" fontWeight="700"
                  textAnchor="middle">R {lRoll.toFixed(0)}°</text>
              </g>
            )}
            {rightShoulder && (
              <g className="sensor-label">
                <text x="175" y={88 + shoulderDrop * 0.5} fill={rColor} fontSize="11" fontWeight="900"
                  textAnchor="middle">R</text>
                <text x="175" y={102 + shoulderDrop * 0.5} fill={rColor} fontSize="10" fontWeight="700"
                  textAnchor="middle">P {rPitch.toFixed(0)}°</text>
                <text x="175" y={114 + shoulderDrop * 0.5} fill={rColor} fontSize="9" fontWeight="700"
                  textAnchor="middle">R {rRoll.toFixed(0)}°</text>
              </g>
            )}
          </>
        ) : (
          <g transform="translate(-25, 0)">
            {/* Side View */}
            {/* Head */}
            <circle cx={100 + forwardLean} cy={42 + flexSlouch * 0.5} r="26" fill={`url(#grad-${status})`}
              filter={status === 'good' ? 'url(#softGlow)' : 'none'}
              style={{ transition: 'all 0.5s ease' }} />
            {/* Eye (facing right) */}
            <circle cx={110 + forwardLean} cy={38 + flexSlouch * 0.5} r="2.5" fill="white" opacity="0.9" />
            {/* Smile/Mouth */}
            {status === 'good' && (
              <path d={`M ${112 + forwardLean} ${48 + flexSlouch * 0.5} Q ${116 + forwardLean} ${52 + flexSlouch * 0.5} ${120 + forwardLean} ${46 + flexSlouch * 0.5}`}
                stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.9" />
            )}
            {status === 'warning' && (
              <line x1={112 + forwardLean} y1={50 + flexSlouch * 0.5} x2={120 + forwardLean} y2={50 + flexSlouch * 0.5}
                stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
            )}
            {status === 'bad' && (
              <path d={`M ${112 + forwardLean} ${50 + flexSlouch * 0.5} Q ${116 + forwardLean} ${46 + flexSlouch * 0.5} ${120 + forwardLean} ${52 + flexSlouch * 0.5}`}
                stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.9" />
            )}

            {/* Neck */}
            <path d={`M ${100 + forwardLean * 0.8} ${66 + flexSlouch * 0.5} L 100 ${82 + flexSlouch * 0.4}`}
              stroke={c.primary} strokeWidth="12" strokeLinecap="round" opacity="0.8" style={{ transition: 'all 0.5s ease' }} />

            {/* Spine line (curves backwards when slouching) */}
            <path d={`M ${100 + forwardLean * 0.3} ${82 + flexSlouch * 0.4} Q ${100 - flexCurve} ${130} 100 172`}
              stroke={`url(#spineGrad-${status})`} strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.4"
              strokeDasharray="1 6" style={{ transition: 'all 0.5s ease' }} />

            {/* Torso Profile */}
            <path d={`M ${94 + forwardLean * 0.5} ${84 + flexSlouch * 0.3}
              Q ${90 - flexCurve} ${130} 92 168
              L 112 168
              Q ${116 - flexCurve + forwardLean * 0.2} ${130} ${116 + forwardLean * 0.5} ${84 + flexSlouch * 0.3} Z`}
              fill={`url(#grad-${status})`} opacity="0.7" style={{ transition: 'all 0.5s ease' }} />

            {/* Right Arm (visible side) */}
            <path d={`M ${106 + forwardLean * 0.5} ${88 + flexSlouch * 0.3}
              Q ${110 + rPitch * 0.5} ${128} ${106} ${168}`}
              stroke={rColor} strokeWidth="12" strokeLinecap="round" fill="none" opacity="0.85"
              style={{ transition: 'all 0.5s ease' }} />
            {/* Shoulder Joint */}
            <circle cx={106 + forwardLean * 0.5} cy={88 + flexSlouch * 0.3} r="6" fill={rColor} opacity="0.95" style={{ transition: 'all 0.5s ease' }} />

            {/* Right Leg */}
            <path d="M 102 166 L 98 238 L 104 262" stroke={c.primary} strokeWidth="14"
              strokeLinecap="round" fill="none" opacity="0.6" style={{ transition: 'all 0.5s ease' }} />

            {/* Flex reading label */}
            {flexValue !== undefined && (
              <g className="sensor-label">
                <text x="180" y="125" fill={backColor} fontSize="11" fontWeight="900" textAnchor="middle">FLEX</text>
                <text x="180" y="139" fill={backColor} fontSize="10" fontWeight="700" textAnchor="middle">{flexValue.toFixed(0)}</text>
              </g>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
