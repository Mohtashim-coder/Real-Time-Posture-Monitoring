import { useState, useEffect } from 'react';

export interface UserProfile {
  name: string;
  email: string;
  photo?: string;
  notificationsEnabled: boolean;
  dailyGoal: number;
}

const DEFAULT_PROFILE: UserProfile = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  notificationsEnabled: true,
  dailyGoal: 180,
};

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('user_profile');
      return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const updateProfile = (newProfile: Partial<UserProfile>) => {
    setProfile(prev => {
      const updated = { ...prev, ...newProfile };
      localStorage.setItem('user_profile', JSON.stringify(updated));
      return updated;
    });
  };

  return { profile, updateProfile };
}
