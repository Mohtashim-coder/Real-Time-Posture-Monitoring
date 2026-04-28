import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { User, Award, Flame, Clock, Target, Trophy, Settings, ChevronRight, Bell, Bluetooth, Info, Shield, Check, X, Camera } from 'lucide-react';
import type { PostureStats } from '../hooks/usePostureEngine';
import { useUserProfile } from '../hooks/useUserProfile';

interface ProfileProps {
  stats: PostureStats;
  btStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  onConnectDevice: () => void;
  onDisconnectDevice: () => void;
}

export function Profile({ stats, btStatus, onConnectDevice, onDisconnectDevice }: ProfileProps) {
  const { profile, updateProfile } = useUserProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [editEmail, setEditEmail] = useState(profile.email);
  const [editPhoto, setEditPhoto] = useState(profile.photo);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    updateProfile({ name: editName, email: editEmail, photo: editPhoto });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(profile.name);
    setEditEmail(profile.email);
    setEditPhoto(profile.photo);
    setIsEditing(false);
  };

  const achievements = [
    { icon: '🔥', title: '3-Day Streak', desc: 'Train 3 days in a row', unlocked: stats.currentStreak >= 3 },
    { icon: '🎯', title: 'Perfect Score', desc: 'Achieve 95%+ posture score', unlocked: stats.bestScore >= 95 },
    { icon: '⏱️', title: 'Marathon', desc: 'Complete 1 hour session', unlocked: false },
    { icon: '🏆', title: 'Week Warrior', desc: 'Train every day for a week', unlocked: stats.bestStreak >= 7 },
    { icon: '💎', title: 'Posture Pro', desc: 'Complete 50 sessions', unlocked: stats.totalSessions >= 50 },
    { icon: '⭐', title: 'Rising Star', desc: 'Complete 10 sessions', unlocked: stats.totalSessions >= 10 },
  ];

  const handleToggleNotifications = () => {
    const newVal = !profile.notificationsEnabled;
    updateProfile({ notificationsEnabled: newVal });
    if (newVal && 'Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  };

  const handleChangeGoal = () => {
    const newGoalStr = window.prompt('Enter daily goal in minutes:', (profile.dailyGoal || 180).toString());
    if (newGoalStr !== null) {
      const newGoal = parseInt(newGoalStr, 10);
      if (!isNaN(newGoal) && newGoal > 0) {
        updateProfile({ dailyGoal: newGoal });
      } else {
        alert('Please enter a valid number of minutes.');
      }
    }
  };

  const settingsItems = [
    { icon: Bell, label: 'Notifications', value: profile.notificationsEnabled ? 'On' : 'Off', onClick: handleToggleNotifications },
    { 
      icon: Bluetooth, 
      label: 'Device', 
      value: btStatus === 'connected' ? 'Connected' : btStatus === 'connecting' ? 'Connecting...' : 'Tap to pair', 
      onClick: btStatus === 'connected' ? onDisconnectDevice : onConnectDevice 
    },
    { icon: Target, label: 'Daily Goal', value: `${profile.dailyGoal || 180} min`, onClick: handleChangeGoal },
    { icon: Shield, label: 'Privacy', value: 'Local only' },
    { icon: Info, label: 'About', value: 'v1.0.0' },
  ];

  return (
    <div className="px-5 py-6 space-y-5">
      {/* Profile Card */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-surface-elevated rounded-3xl p-6 shadow-sm border border-outline-variant/10 flex flex-col items-center text-center">
        <div className="relative mb-3">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center overflow-hidden border-2 border-surface-elevated">
            {isEditing ? (
              editPhoto ? (
                <img src={editPhoto} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-white" />
              )
            ) : (
              profile.photo ? (
                <img src={profile.photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-white" />
              )
            )}
          </div>
          {isEditing && (
            <>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-1.5 bg-primary text-white rounded-full border-2 border-surface-elevated shadow-md hover:bg-primary-dark transition-colors"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </>
          )}
        </div>
        
        {isEditing ? (
          <div className="w-full space-y-3 mt-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-surface-dim border border-outline rounded-xl px-4 py-2 text-sm font-bold text-on-surface focus:outline-none focus:border-primary transition-colors text-center"
              placeholder="Your Name"
            />
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="w-full bg-surface-dim border border-outline rounded-xl px-4 py-2 text-sm text-on-surface-muted focus:outline-none focus:border-primary transition-colors text-center"
              placeholder="your.email@example.com"
            />
            <div className="flex gap-2 justify-center pt-2">
              <button 
                onClick={handleCancel}
                className="flex-1 px-4 py-2 rounded-xl border border-outline text-xs font-semibold text-on-surface-variant hover:bg-surface-dim transition-all flex items-center justify-center gap-1"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold shadow-md shadow-primary/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1"
              >
                <Check className="w-4 h-4" /> Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-extrabold text-on-surface">{profile.name}</h2>
            <p className="text-sm text-on-surface-muted">{profile.email}</p>
            <button 
              onClick={() => setIsEditing(true)}
              className="mt-3 px-4 py-1.5 rounded-lg border border-outline text-xs font-semibold text-on-surface-variant hover:bg-surface-dim transition-all"
            >
              Edit Profile
            </button>
          </>
        )}
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Flame, value: stats.currentStreak, label: 'Streak', color: 'text-accent' },
          { icon: Clock, value: `${Math.floor(stats.todayUprightMinutes / 60)}h`, label: 'Today', color: 'text-success' },
          { icon: Trophy, value: stats.totalSessions, label: 'Sessions', color: 'text-secondary' },
          { icon: Award, value: `${stats.bestScore}%`, label: 'Best', color: 'text-primary' },
        ].map((item, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="bg-surface-elevated rounded-2xl p-3 border border-outline-variant/10 text-center">
            <item.icon className={`w-4 h-4 ${item.color} mx-auto mb-1.5`} />
            <p className="text-lg font-extrabold text-on-surface leading-none">{item.value}</p>
            <p className="text-[9px] text-on-surface-muted font-medium uppercase tracking-wider mt-1">{item.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Achievements */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h3 className="text-base font-bold text-on-surface mb-3 flex items-center gap-2">
          <Award className="w-4 h-4 text-accent" /> Achievements
        </h3>
        <div className="grid grid-cols-3 gap-2.5">
          {achievements.map((ach, i) => (
            <div key={i} className={`rounded-2xl p-3 text-center border transition-all ${
              ach.unlocked
                ? 'bg-surface-elevated border-primary/20 shadow-sm'
                : 'bg-surface-dim border-outline-variant/10 opacity-50'
            }`}>
              <span className="text-2xl block mb-1.5">{ach.icon}</span>
              <p className="text-[11px] font-bold text-on-surface leading-tight">{ach.title}</p>
              <p className="text-[9px] text-on-surface-muted mt-0.5 leading-tight">{ach.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Settings */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h3 className="text-base font-bold text-on-surface mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4 text-on-surface-variant" /> Settings
        </h3>
        <div className="bg-surface-elevated rounded-2xl border border-outline-variant/10 overflow-hidden divide-y divide-outline-variant/10">
          {settingsItems.map((item, i) => (
            <button key={i} onClick={item.onClick} className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-surface-dim transition-all">
              <item.icon className="w-4.5 h-4.5 text-on-surface-variant" />
              <span className="flex-1 text-left text-sm font-medium text-on-surface">{item.label}</span>
              <span className="text-xs text-on-surface-muted">{item.value}</span>
              <ChevronRight className="w-4 h-4 text-on-surface-muted" />
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
