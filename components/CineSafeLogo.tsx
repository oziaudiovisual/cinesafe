import React, { memo } from 'react';

interface CineSafeLogoProps {
  size?: number;
  className?: string;
}

const CineSafeLogoComponent: React.FC<CineSafeLogoProps> = ({ size = 40, className = '' }) => {
  // The style object is used as a fallback if no width class is provided via className.
  const style = !className.includes('w-') ? { width: size, height: 'auto' } : { height: 'auto' };

  return (
    <img 
      src="https://ozi.com.br/cinesafe/logo.webp" 
      alt="Cine Safe Logo" 
      className={className} 
      style={style} 
    />
  );
};

export const CineSafeLogo = memo(CineSafeLogoComponent);
