export const getProjectTypeCode = (projectType: string): string => {
  switch (projectType.toLowerCase()) {
    case 'apartment': return 'PRA';
    case 'villa':     return 'PRV';
    default:          return 'PRO';
  }
};

export const generateProjectCode = (projectType: string, id: number): string => {
  const prefix = getProjectTypeCode(projectType);
  return `${prefix}${String(id).padStart(4, '0')}`;
};
