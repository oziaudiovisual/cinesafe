
import { supabase } from './supabase';
import { Ad } from '../types';
import { processImageForWebP } from '../utils/imageProcessor';

// --- Ads Service Logic ---
export const adService = {
  createAd: async (ad: Ad): Promise<boolean> => {
    try {
      const { error } = await supabase.from('ads').upsert({
        id: ad.id,
        advertiser_name: ad.advertiserName,
        tagline: ad.tagline,
        title: ad.title,
        price_old: ad.priceOld,
        price_new: ad.priceNew,
        button_text: ad.buttonText,
        image_url: ad.imageUrl,
        link_url: ad.linkUrl,
        start_date: ad.startDate,
        end_date: ad.endDate,
        weight: ad.weight,
        active: ad.active,
        impressions: ad.impressions || 0,
        clicks: ad.clicks || 0,
      });
      return !error;
    } catch (e) { return false; }
  },

  updateAd: async (ad: Ad): Promise<boolean> => {
    try {
      const { error } = await supabase.from('ads').update({
        advertiser_name: ad.advertiserName,
        tagline: ad.tagline,
        title: ad.title,
        price_old: ad.priceOld,
        price_new: ad.priceNew,
        button_text: ad.buttonText,
        image_url: ad.imageUrl,
        link_url: ad.linkUrl,
        start_date: ad.startDate,
        end_date: ad.endDate,
        weight: ad.weight,
        active: ad.active,
        impressions: ad.impressions,
        clicks: ad.clicks,
      }).eq('id', ad.id);
      return !error;
    } catch (e) { return false; }
  },

  deleteAd: async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('ads').delete().eq('id', id);
      return !error;
    } catch (e) { return false; }
  },

  getAllAds: async (): Promise<Ad[]> => {
    const { data: rows } = await supabase.from('ads').select('*').order('start_date', { ascending: false });
    return (rows || []).map((r: any) => ({
      id: r.id,
      advertiserName: r.advertiser_name,
      tagline: r.tagline,
      title: r.title,
      priceOld: r.price_old,
      priceNew: r.price_new,
      buttonText: r.button_text,
      imageUrl: r.image_url,
      linkUrl: r.link_url,
      startDate: r.start_date,
      endDate: r.end_date,
      weight: r.weight,
      active: r.active,
      impressions: r.impressions,
      clicks: r.clicks,
    }));
  },

  getActiveAd: async (): Promise<Ad | null> => {
    const now = new Date().toISOString().split('T')[0];
    const { data: rows } = await supabase.from('ads').select('*').eq('active', true);
    const allAds = (rows || []).map((r: any) => ({
      id: r.id,
      advertiserName: r.advertiser_name,
      tagline: r.tagline,
      title: r.title,
      priceOld: r.price_old,
      priceNew: r.price_new,
      buttonText: r.button_text,
      imageUrl: r.image_url,
      linkUrl: r.link_url,
      startDate: r.start_date,
      endDate: r.end_date,
      weight: r.weight,
      active: r.active,
      impressions: r.impressions,
      clicks: r.clicks,
    }));
    const validAds = allAds.filter((ad: Ad) => ad.startDate <= now && ad.endDate >= now);
    
    if (validAds.length === 0) return null;
    
    const totalWeight = validAds.reduce((sum: number, ad: Ad) => sum + (ad.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (const ad of validAds) {
        random -= (ad.weight || 1);
        if (random <= 0) return ad;
    }
    return validAds[0];
  },

  trackAdImpression: async (id: string) => {
    try {
        const { data } = await supabase.from('ads').select('impressions').eq('id', id).single();
        if (data) {
          await supabase.from('ads').update({ impressions: (data.impressions || 0) + 1 }).eq('id', id);
        }
    } catch (e) { console.error(e); }
  },

  trackAdClick: async (id: string) => {
    try {
        const { data } = await supabase.from('ads').select('clicks').eq('id', id).single();
        if (data) {
          await supabase.from('ads').update({ clicks: (data.clicks || 0) + 1 }).eq('id', id);
        }
    } catch (e) { console.error(e); }
  },

  uploadAdImage: async (file: File): Promise<string | null> => {
    try {
      const optimizedBlob = await processImageForWebP(file);
      const fileName = `${Date.now()}.webp`;
      const { error } = await supabase.storage.from('ads').upload(fileName, optimizedBlob, {
        contentType: 'image/webp',
      });
      if (error) { console.error('Ad image upload error:', error); return null; }
      const { data: { publicUrl } } = supabase.storage.from('ads').getPublicUrl(fileName);
      return publicUrl;
    } catch (e) { console.error('uploadAdImage error:', e); return null; }
  }
};
