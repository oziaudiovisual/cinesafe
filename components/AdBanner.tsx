import React, { useState, useEffect, memo } from 'react';
import { adService } from '../services/adService';
import { Ad } from '../types';
import { Icons } from './Icons';

interface AdBannerProps {
  ad: Ad;
}

const AdBannerComponent: React.FC<AdBannerProps> = ({ ad }) => {
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  // Reset image loaded state when the ad image URL changes (for rotation)
  useEffect(() => {
    setIsImageLoaded(false);
  }, [ad.imageUrl]);

  const handleClick = async () => {
    if (!ad || !ad.linkUrl) return;
    await adService.trackAdClick(ad.id);
    window.open(ad.linkUrl, '_blank');
  };

  return (
    <div
      onClick={handleClick}
      className={`relative w-full h-64 bg-[radial-gradient(ellipse_at_top_right,_#1a1a1a_0%,_#000000_70%)] rounded-[2.5rem] overflow-hidden border border-white/10 shadow-lg group transition-transform hover:scale-[1.01] ${ad.linkUrl ? 'cursor-pointer' : ''}`}
    >
      {/* Concentric Lines Background */}
      <div className="absolute top-[-50%] right-[-50%] w-[200%] h-[200%] z-0 pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="line" />
        ))}
      </div>

      {/* Gradient for Text Legibility */}
      <div className="absolute inset-0 z-20 bg-gradient-to-r from-black/60 via-black/40 to-transparent pointer-events-none w-4/5 md:w-3/4" />

      {/* TEXT CONTENT */}
      <div className="relative z-30 h-full flex flex-col justify-center pl-8 w-full md:w-2/3">
        {ad.tagline && (
          <div className="mb-3">
            <span className="bg-gradient-to-r from-orange-500 to-yellow-500 text-black text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-lg">
              {ad.tagline}
            </span>
          </div>
        )}

        <h3 className="text-white text-3xl font-bold leading-tight mb-1" style={{ textShadow: '0 2px 5px rgba(0,0,0,0.5)' }}>
          {ad.title}
        </h3>

        {(ad.priceOld || ad.priceNew) && (
          <div className="flex items-baseline gap-2 mb-4">
            {ad.priceOld && <p className="text-gray-400 text-sm line-through">{ad.priceOld}</p>}
            {ad.priceNew && <p className="text-white text-2xl font-bold">{ad.priceNew}</p>}
          </div>
        )}

        {ad.buttonText && (
          <button className="bg-white text-black px-6 py-2.5 rounded-full text-sm font-bold hover:bg-gray-200 transition-colors w-fit flex items-center gap-2">
            {ad.buttonText}
            <Icons.ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* IMAGE */}
      {ad.imageUrl && (
        <div className="absolute right-4 top-4 bottom-4 w-1/2 md:w-3/5 flex items-center justify-center pointer-events-none z-10">
          {/* Product Image */}
          <img
            src={ad.imageUrl}
            alt={ad.title}
            loading="eager"
            onLoad={() => setIsImageLoaded(true)}
            className={`max-h-full max-w-full object-contain drop-shadow-2xl transform group-hover:scale-105 transition-all duration-700 ease-out ${
              isImageLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          />
        </div>
      )}
    </div>
  );
};

export const AdBanner = memo(AdBannerComponent);
