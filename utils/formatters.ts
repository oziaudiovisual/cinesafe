
export const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  });
};

export const formatCompactCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  });
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('pt-BR');
};

export const toTitleCase = (str: string): string => {
  return str.replace(/\w\S*/g, (text) => 
    text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
  );
};
