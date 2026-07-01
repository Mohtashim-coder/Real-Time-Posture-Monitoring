import React, { useState } from 'react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, Award, Calendar, Clock, Target, Flame } from 'lucide-react';
import type { PostureStats } from '../hooks/usePostureEngine';
import type { TrainingSession } from '../hooks/useTrainingSession';

interface StatsProps {
  stats: PostureStats;
  sessionHistory: TrainingSession[];
}

export function Sensors({ stats, sessionHistory }: StatsProps) {
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');

  const chartData = stats.weeklyData.map(d => ({
    name: d.day,
    upright: Math.round(d.uprightMinutes / 60 * 10) / 10,
    score: d.score,
  }));

  const todayIndex = new Date().getDay();
  const adjustedIndex = todayIndex === 0 ? 6 : todayIndex - 1;

  const totalUprightHours = Math.round(stats.weeklyData.reduce((sum, d) => sum + d.uprightMinutes, 0) / 60);
  const avgScore = Math.round(stats.weeklyData.reduce((sum, d) => sum + d.score, 0) / stats.weeklyData.length);

  return (
    <div className="px-2 py-4 space-y-5">
      {/* Header Stats */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-extrabold text-on-surface mb-1">Statistics</h2>
        <p className="text-sm text-on-surface-muted">Track your posture improvement over time</p>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Avg Score', value: `${avgScore}%`, icon: Target, color: 'text-primary', bg: 'bg-primary-container' },
          { label: 'Total Hours', value: `${totalUprightHours}h`, icon: Clock, color: 'text-success', bg: 'bg-success-light' },
          { label: 'Best Score', value: `${stats.bestScore}%`, icon: Award, color: 'text-secondary', bg: 'bg-secondary-container' },
        ].map((item, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="bg-surface-elevated rounded-2xl p-2.5 border border-outline-variant/10 text-center">
            <div className={`w-7 h-7 rounded-lg ${item.bg} flex items-center justify-center mx-auto mb-2`}>
              <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
            </div>
            <p className="text-base font-extrabold text-on-surface">{item.value}</p>
            <p className="text-[9px] font-medium text-on-surface-muted uppercase tracking-wider">{item.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Chart */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
        className="bg-surface-elevated rounded-3xl p-5 shadow-sm border border-outline-variant/10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-on-surface">Upright Time</h3>
          <div className="flex bg-surface-dim rounded-xl p-0.5">
            {(['week', 'month'] as const).map(range => (
              <button key={range} onClick={() => setTimeRange(range)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  timeRange === range ? 'bg-surface-elevated text-on-surface shadow-sm' : 'text-on-surface-muted'
                }`}>
                {range === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barSize={28}>
              <XAxis dataKey="name" axisLine={false} tickLine={false}
                tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 500 }} dy={8} />
              <Tooltip cursor={{ fill: 'transparent' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-on-surface text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg">
                        {payload[0].value}h upright
                      </div>
                    );
                  }
                  return null;
                }} />
              <Bar dataKey="upright" radius={[8, 8, 0, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={index}
                    fill={index === adjustedIndex ? '#0D9488' : 'rgba(13, 148, 136, 0.15)'}
                    style={{ filter: index === adjustedIndex ? 'drop-shadow(0 2px 8px rgba(13, 148, 136, 0.3))' : 'none' }} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Improvement Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-5 text-white flex items-center gap-4">
        <TrendingUp className="w-10 h-10 opacity-90 flex-shrink-0" />
        <div>
          <h4 className="text-sm font-medium opacity-80">Weekly Improvement</h4>
          <p className="text-2xl font-extrabold">+12%</p>
          <p className="text-xs opacity-70 mt-0.5">Better than last week's average</p>
        </div>
      </motion.div>

      {/* Streak + Sessions Stats */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-surface-elevated rounded-2xl p-4 border border-outline-variant/10">
          <Flame className="w-5 h-5 text-accent mb-2" />
          <p className="text-2xl font-extrabold text-on-surface">{stats.currentStreak}</p>
          <p className="text-xs text-on-surface-muted font-medium">Day Streak</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-surface-elevated rounded-2xl p-4 border border-outline-variant/10">
          <Calendar className="w-5 h-5 text-secondary mb-2" />
          <p className="text-2xl font-extrabold text-on-surface">{stats.totalSessions}</p>
          <p className="text-xs text-on-surface-muted font-medium">Total Sessions</p>
        </motion.div>
      </div>

      {/* All Sessions List */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <h3 className="text-base font-bold text-on-surface mb-3">All Sessions</h3>
        <div className="space-y-2">
          {sessionHistory.length === 0 ? (
            <div className="bg-surface-elevated rounded-2xl p-6 text-center border border-outline-variant/10">
              <p className="text-sm text-on-surface-muted">Complete training sessions to see your history</p>
            </div>
          ) : (
            sessionHistory.map(session => (
              <div key={session.id} className="bg-surface-elevated rounded-xl p-3.5 border border-outline-variant/10 flex items-center gap-3">
                <div className={`w-2 h-8 rounded-full ${session.avgScore >= 80 ? 'bg-success' : session.avgScore >= 60 ? 'bg-warning' : 'bg-danger'}`} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-on-surface">
                    {session.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-on-surface-muted">{Math.floor(session.duration / 60)}m {session.duration % 60}s</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-on-surface">{session.avgScore}%</p>
                  <p className="text-[10px] text-on-surface-muted">avg score</p>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
