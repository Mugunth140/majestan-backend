export const getProjectTypeCode = (projectType: string): string => {
  switch (projectType.toLowerCase()) {
    case 'apartment': return 'PA';
    case 'villa':     return 'PV';
    case 'plot':      return 'PP';
    default:          return 'PRO';
  }
};

export const generateProjectCode = (projectType: string, id: number): string => {
  const prefix = getProjectTypeCode(projectType);
  return `${prefix}${String(id).padStart(4, '0')}`;
};
