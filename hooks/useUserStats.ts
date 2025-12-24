import { useState, useEffect } from 'react';
import { DetailedStats } from '../types';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';

export const useUserStats = () => {
  const { user } = useAuth();
  const [userStats, setUserStats] = useState<DetailedStats | null>(null);
  const [systemStats, setSystemStats] = useState<DetailedStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      if (user) {
        setLoading(true);
        const [uStats, sStats] = await Promise.all([
          userService.getUserDetailedStats(user.id),
          userService.getGlobalDetailedStats(),
        ]);
        setUserStats(uStats);
        setSystemStats(sStats);
        setLoading(false);
      }
    };
    loadStats();
  }, [user]);

  return { userStats, systemStats, loading };
};
