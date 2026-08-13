/**
 * Validadores brasileiros centralizados
 * Usados nos schemas Zod de todos os formulários
 */
import { z } from 'zod';

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** Remove tudo que não for dígito */
const digits = (v: string) => v.replace(/\D/g, '');

// ─── CPF ──────────────────────────────────────────────────────────────────────

export function validateCpf(cpf: string): boolean {
  const n = digits(cpf);
  if (n.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(n)) return false; // todos iguais

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(n[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10 || d1 === 11) d1 = 0;
  if (d1 !== parseInt(n[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(n[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10 || d2 === 11) d2 = 0;
  return d2 === parseInt(n[10]);
}

/**
 * CPF opcional com suporte a mascaramento da Receita (1–10 dígitos visíveis).
 * Vazio OK; parcial OK; 11 dígitos exige dígito verificador; >11 rejeita.
 */
export function validateOptionalPartialCpf(value: string | null | undefined): boolean {
  const d = digits(String(value ?? ''));
  if (d.length === 0) return true;
  if (d.length < 11) return true;
  if (d.length > 11) return false;
  return validateCpf(value!);
}

// ─── CNPJ ─────────────────────────────────────────────────────────────────────

export function validateCnpj(cnpj: string): boolean {
  const n = digits(cnpj);
  if (n.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(n)) return false; // todos iguais

  const calc = (len: number) => {
    let sum = 0;
    let pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += parseInt(n[len - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    return sum % 11 < 2 ? 0 : 11 - (sum % 11);
  };

  return calc(12) === parseInt(n[12]) && calc(13) === parseInt(n[13]);
}

// ─── CPF ou CNPJ ──────────────────────────────────────────────────────────────

export function validateCpfOrCnpj(value: string): boolean {
  const n = digits(value);
  if (n.length === 11) return validateCpf(value);
  if (n.length === 14) return validateCnpj(value);
  return false;
}

// ─── Telefone brasileiro ───────────────────────────────────────────────────────
// Aceita fixo (10 dígitos) ou celular (11 dígitos), com ou sem formatação

export function validatePhone(phone: string): boolean {
  const n = digits(phone);
  return n.length === 10 || n.length === 11;
}

// ─── CEP ──────────────────────────────────────────────────────────────────────

export function validateCep(cep: string): boolean {
  const n = digits(cep);
  return n.length === 8;
}

// ─── Placa brasileira ─────────────────────────────────────────────────────────
// Padrão antigo: ABC1234
// Mercosul:      ABC1D23

export function validatePlate(plate: string): boolean {
  const p = plate.trim().toUpperCase().replace(/[-\s]/g, '');
  return /^[A-Z]{3}\d{4}$/.test(p) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(p);
}

// ─── Schemas Zod reutilizáveis ────────────────────────────────────────────────

/**
 * Campo CPF opcional com validação de formato e dígito verificador.
 * Aceita vazio ("") → null
 */
export const zodCpf = z
  .string()
  .optional()
  .refine((v) => !v || digits(v).length === 0 || validateCpf(v), 'CPF inválido');

/**
 * CPF opcional com parcial da Receita (1–10 dígitos) ou completo (11 + verificador).
 */
export const zodPartialCpf = z
  .string()
  .optional()
  .default('')
  .refine((v) => validateOptionalPartialCpf(v), 'CPF inválido');

/**
 * Campo CNPJ opcional com validação de formato e dígito verificador.
 * Aceita vazio ("") → null
 */
export const zodCnpj = z
  .string()
  .optional()
  .refine((v) => !v || digits(v).length === 0 || validateCnpj(v), 'CNPJ inválido');

/**
 * Campo CPF/CNPJ opcional com validação de formato e dígito verificador.
 * Detecta automaticamente CPF (11) ou CNPJ (14).
 */
export const zodCpfOrCnpj = z
  .string()
  .optional()
  .refine((v) => !v || digits(v).length === 0 || validateCpfOrCnpj(v), 'CPF ou CNPJ inválido');

/**
 * Telefone brasileiro opcional (fixo 10 dígitos ou celular 11 dígitos).
 */
export const zodPhone = z
  .string()
  .optional()
  .refine(
    (v) => !v || digits(v).length === 0 || validatePhone(v),
    'Telefone inválido – informe DDD + número (ex: (11) 99999-9999)'
  );

/**
 * CEP brasileiro opcional (8 dígitos).
 */
export const zodCep = z
  .string()
  .optional()
  .refine(
    (v) => !v || digits(v).length === 0 || validateCep(v),
    'CEP inválido – informe 8 dígitos (ex: 01310-100)'
  );

/**
 * Placa de veículo brasileira obrigatória.
 * Aceita padrão antigo (ABC1234) e Mercosul (ABC1D23).
 */
export const zodPlate = z
  .string()
  .min(1, 'Placa obrigatória')
  .refine(validatePlate, 'Placa inválida – use o formato ABC1234 ou ABC1D23 (Mercosul)');

// ─── RNTRC / Focus MDF-e (SEFAZ) ───────────────────────────────────────────────
// Pattern SEFAZ: `[0-9]{8}|ISENTO`. Portal ANTT às vezes mostra 9 dígitos c/ zero.

/**
 * Normaliza RNTRC para facet SEFAZ CT-e/MDF-e (`[0-9]{8}|ISENTO`).
 * Portal ANTT frequentemente exibe 9 dígitos (ex.: 002353222, 059734055).
 * Espelha `normalizeRntrcSefaz` em `supabase/functions/_shared/cte-mapper.ts`.
 */
export function normalizeRntrcSefaz(raw: string | null | undefined): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  if (/^ISENTO$/i.test(trimmed)) return 'ISENTO';
  const d = digits(trimmed);
  if (d.length === 8) return d;
  if (d.length === 9 && d.startsWith('0')) {
    // ANTT 9 dig c/ zero à esquerda → SEFAZ = 8 (drop 1 zero). Ex.: 059734055→59734055
    // NÃO strip all zeros (002353222→2353222 pad 02353222 ≠ portal).
    return d.slice(1);
  }
  if (d.length > 8) {
    const stripped = d.replace(/^0+/, '');
    if (stripped.length === 8) return stripped;
    if (stripped.length > 8) return stripped.slice(-8);
    return d.slice(-8);
  }
  if (d.length === 0) return '';
  return d.padStart(8, '0');
}

/**
 * Máscara input RNTRC (cadastro/ANTT): até 9 dígitos ou ISENTO.
 * Guarda valor do portal; SEFAZ 8 dig só no emit (`normalizeRntrcSefaz`).
 */
export function maskRntrcInput(raw: string): string {
  const v = String(raw ?? '');
  if (!v) return '';
  const letters = v.replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (letters.length > 0 && 'ISENTO'.startsWith(letters)) {
    return letters === 'ISENTO' ? 'ISENTO' : letters;
  }
  if (/^ISENTO$/i.test(v.trim())) return 'ISENTO';
  return digits(v).slice(0, 9);
}

/** Vazio OK; 8–9 dígitos (ANTT) ou ISENTO. */
export const zodRntrcOptional = z
  .string()
  .optional()
  .transform((v) => maskRntrcInput(v ?? ''))
  .refine(
    (v) => v === '' || v === 'ISENTO' || /^[0-9]{8,9}$/.test(v),
    'RNTRC inválido — 8 ou 9 dígitos (ANTT) ou ISENTO'
  );

/** Códigos Focus/SEFAZ — tipo rodado veículo tração (01–06). */
export const FOCUS_TIPO_RODADO = ['01', '02', '03', '04', '05', '06'] as const;

/** Códigos Focus/SEFAZ — tipo carroceria (00–05, MOC MDF-e). */
export const FOCUS_TIPO_CARROCERIA = ['00', '01', '02', '03', '04', '05'] as const;
