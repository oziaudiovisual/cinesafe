

export const processImageForWebP = async (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const targetWidth = 480; // Optimize for mobile/web performance
      const scaleFactor = targetWidth / img.width;
      canvas.width = targetWidth;
      canvas.height = img.height * scaleFactor;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('Canvas context not available');
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject('Image processing failed');
      }, 'image/webp', 0.85); // 85% quality WebP
    };
    img.onerror = reject;
  });
};

export const resilientUpload = async (storageRef: any, blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadTask = storageRef.put(blob);
    
    uploadTask.on(
      'state_changed',
      null, // Progress listener (can be added later)
      (error: any) => {
        // Handle Firebase specific errors
        if (error.code === 'storage/unauthorized' && error.message.includes('CORS')) {
          reject(new Error('CORS_CONFIG_ERROR'));
        } else {
          reject(error);
        }
      },
      async () => {
        try {
          const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
          resolve(downloadURL);
        } catch (e) {
          reject(e);
        }
      }
    );
  });
};

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
