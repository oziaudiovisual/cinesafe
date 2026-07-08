import React from 'react';
import { numberToCurrencyMask, parseCurrencyBRL } from '../utils/formatters';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Valor atual em reais (número). Ex.: 16900 é exibido como "16.900,00". */
  value: number | null | undefined;
  /** Recebe o novo valor em reais (número). */
  onValueChange: (value: number) => void;
}

/**
 * Input de moeda (BRL) com máscara "centavos": todos os dígitos digitados são
 * tratados como centavos e o valor cresce da direita para a esquerda
 * (digite "1690000" → exibe "16.900,00"). Ponto separa milhar, vírgula separa
 * centavos — padrão único de preço em todo o sistema.
 *
 * A fonte da verdade é sempre um `number` (reais). A formatação é derivada do
 * valor a cada render, então o texto exibido e o estado nunca divergem.
 */
export const CurrencyInput: React.FC<CurrencyInputProps> = ({ value, onValueChange, inputMode, ...rest }) => {
  const display = numberToCurrencyMask(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange(parseCurrencyBRL(e.target.value));
  };

  return (
    <input
      type="text"
      inputMode={inputMode ?? 'numeric'}
      value={display}
      onChange={handleChange}
      {...rest}
    />
  );
};
