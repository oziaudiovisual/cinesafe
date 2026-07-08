// Validação e máscara de CPF (client-side, apenas UX).
// A fonte da verdade do antifraude é a função `is_valid_cpf` no Postgres —
// ver supabase/migrations/20260708_antifraude_sorteios.sql e o spec em
// docs/superpowers/specs/2026-07-08-antifraude-sorteios-design.md.

// Valida os dígitos verificadores do CPF. Rejeita tamanho errado e sequências
// repetidas (ex.: 111.111.111-11). Aceita com ou sem máscara.
export const isValidCPF = (cpf: string): boolean => {
  const c = (cpf || '').replace(/\D/g, '');
  if (c.length !== 11) return false;
  if (new RegExp(`^(${c[0]}){11}$`).test(c)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i], 10) * (10 - i);
  let d = (sum * 10) % 11;
  if (d === 10) d = 0;
  if (d !== parseInt(c[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i], 10) * (11 - i);
  d = (sum * 10) % 11;
  if (d === 10) d = 0;
  if (d !== parseInt(c[10], 10)) return false;

  return true;
};

// Aplica a máscara progressiva "000.000.000-00" conforme o usuário digita.
export const maskCPF = (value: string): string => {
  const c = (value || '').replace(/\D/g, '').slice(0, 11);
  return c
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};
