
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

// --- Máscara de moeda (BRL) ---
// Padrão único de preço em todo o sistema: ponto como separador de milhar e
// vírgula como separador de centavos (ex.: "16.900,00"). A máscara é do tipo
// "centavos": todos os dígitos digitados são tratados como centavos, então o
// valor cresce da direita para a esquerda (digite "1690000" → "16.900,00").

// Recebe texto livre (input do usuário), considera só os dígitos como centavos
// e devolve o valor formatado no padrão brasileiro, SEM símbolo. "" se vazio.
export const maskCurrencyBRL = (input: string): string => {
  const digits = (input || '').replace(/\D/g, '');
  if (!digits) return '';
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Converte texto livre/mascarado em número de reais. "16.900,00" → 16900. 0 se vazio.
export const parseCurrencyBRL = (input: string): number => {
  const digits = (input || '').replace(/\D/g, '');
  return digits ? parseInt(digits, 10) / 100 : 0;
};

// Formata um número de reais no padrão mascarado "16.900,00" (para exibir no
// input ao editar um valor já salvo). Vazio quando não há valor positivo.
export const numberToCurrencyMask = (value?: number | null): string => {
  if (value == null || isNaN(value) || value <= 0) return '';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
