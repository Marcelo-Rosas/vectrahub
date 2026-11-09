import { signedExceptionFileUrl } from '@/hooks/useInsuranceExceptions';
import type { EffectiveStatus } from '@/lib/insurance-exception';

export const EXCEPTION_STATUS_LABEL: Record<EffectiveStatus, string> = {
  draft: 'Rascunho',
  sent: 'Aguardando MS',
  risk_accepted: 'Risco assumido',
  accepted: 'Aceito',
  tacit_accepted: 'Aceite tácito',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
};

export const EXCEPTION_STATUS_CLASS: Record<EffectiveStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  risk_accepted: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  accepted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  tacit_accepted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  cancelled: 'bg-muted text-muted-foreground line-through',
};

export function formatDeadline(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export async function openExceptionFile(path: string | null) {
  if (!path) return;
  const url = await signedExceptionFileUrl(path);
  if (url) window.open(url, '_blank', 'noopener');
}
