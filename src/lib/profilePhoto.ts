export const getProfilePhotoKey = (userId: string | number) =>
`vault_profile_photo_${userId}`;

export const getProfilePhoto = (userId?: string | number) => {
  if (!userId) return '';
  return localStorage.getItem(getProfilePhotoKey(userId)) || '';
};

export const saveProfilePhoto = (userId: string | number, photoDataUrl: string) => {
  localStorage.setItem(getProfilePhotoKey(userId), photoDataUrl);
  window.dispatchEvent(new CustomEvent('vault_profile_photo_changed', {
    detail: {
      userId,
      photoDataUrl
    }
  }));
};

export const prepareProfilePhoto = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Could not load image file'));
      image.onload = () => {
        const maxSize = 512;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');

        if (!context) {
          reject(new Error('Could not process image'));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = reader.result?.toString() || '';
    };

    reader.readAsDataURL(file);
  });
};

export const removeProfilePhoto = (userId: string | number) => {
  localStorage.removeItem(getProfilePhotoKey(userId));
  window.dispatchEvent(new CustomEvent('vault_profile_photo_changed', {
    detail: {
      userId,
      photoDataUrl: ''
    }
  }));
};
