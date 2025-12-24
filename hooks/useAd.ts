import { useState, useEffect } from 'react';
import { Ad } from '../types';
import { adService } from '../services/adService';

export const useAd = () => {
  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAd = async () => {
      setLoading(true);
      const activeAd = await adService.getActiveAd();
      setAd(activeAd);
      if (activeAd) {
        await adService.trackAdImpression(activeAd.id);
      }
      setLoading(false);
    };

    fetchAd();
  }, []);

  return { ad, loading };
};
