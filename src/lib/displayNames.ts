export const formatOrgName = (name?: string | null) => {
  if (!name) return '';
  return name.trim().toUpperCase() === 'PCG' ? 'Pure Capital' : name;
};
