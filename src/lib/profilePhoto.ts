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

export const removeProfilePhoto = (userId: string | number) => {
  localStorage.removeItem(getProfilePhotoKey(userId));
  window.dispatchEvent(new CustomEvent('vault_profile_photo_changed', {
    detail: {
      userId,
      photoDataUrl: ''
    }
  }));
};
