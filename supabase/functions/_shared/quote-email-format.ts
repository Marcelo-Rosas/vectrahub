export const LOGO_URL = 'https://app.hub.vectracargo.com.br/brand/logo_vectra.jpg';

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  cartao: 'Cartão',
  transferencia: 'Transferência',
  outro: 'Outro',
};

export function formatQuoteBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const end = i + chunk > bytes.length ? bytes.length : i + chunk;
    for (let j = i; j < end; j++) {
      binary += String.fromCharCode(bytes[j]);
    }
  }
  return btoa(binary);
}

export function quotePdfFileName(quoteCode: string, mode: 'simplified' | 'detailed'): string {
  const suffix = mode === 'detailed' ? 'interno' : 'cliente';
  const safe = quoteCode.replace(/[^\w-]/g, '_');
  return `cotacao-${safe}-${suffix}.pdf`;
}
