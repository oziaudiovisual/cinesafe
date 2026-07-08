

export const processImageForWebP = async (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDimension = 800; // Limite máximo de largura OU altura
      
      let width = img.width;
      let height = img.height;
      
      // Redimensiona pelo lado maior, mantendo proporção
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round(height * (maxDimension / width));
          width = maxDimension;
        } else {
          width = Math.round(width * (maxDimension / height));
          height = maxDimension;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('Canvas context not available');
      
      ctx.drawImage(img, 0, 0, width, height);
      
      URL.revokeObjectURL(img.src); // Libera memória do blob URL
      
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject('Image processing failed');
      }, 'image/webp', 0.75); // 75% quality WebP
    };
    img.onerror = reject;
  });
};

// resilientUpload removido — upload agora é feito diretamente via supabase.storage nos services.

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous') 
    image.src = url
  });

export const cropImageHelper = async (imageSrc: string, pixelCrop: { x: number, y: number, width: number, height: number }): Promise<Blob | null> => {
    try {
      const image = await createImage(imageSrc);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.95);
      });
    } catch (e) {
      console.error('Error cropping image:', e);
      return null;
    }
}
