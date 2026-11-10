/**
 * Mensagens PT-BR para códigos de erro do CIOT Online / manage-ciot / generate-ciot.
 * Spec: docs/superpowers/specs/2026-11-10-ciot-online-provider-design.md §6
 */
const LICENCA =
  'Sem créditos/licença CIOT Online — regularize em https://ciotonline.com.br/assinatura';

const MESSAGES: Record<string, string> = {
  token_invalido: 'Integração CIOT Online inválida — falar com admin',
  empresa_inativa: 'Integração CIOT Online inválida — falar com admin',
  api_desabilitada:
    'Integração via API não liberada no CIOT Online — pedir habilitação a adm@ciotonline.com.br',
  token_ausente: 'Integração CIOT Online inválida — falar com admin',
  sem_creditos: LICENCA,
  licenca_vencida: LICENCA,
  licenca_softhouse_vencida: LICENCA,
  licencas_pendentes: LICENCA,
  ciclo_vencido: LICENCA,
  antt_sem_protocolo: 'ANTT não confirmou — consultar antes de reemitir',
  network_error: 'ANTT não confirmou — consultar antes de reemitir',
  status_invalido: 'Operação não permitida no status atual do CIOT',
  motivo_invalido: 'Motivo deve ter ao menos 10 caracteres',
  rate_limit: 'Limite de consultas atingido — tentar mais tarde',
  limite_diario: 'Limite de consultas atingido — tentar mais tarde',
  nao_encontrado: 'CIOT não encontrado no CIOT Online',
  ciot_ja_emitido: 'Esta OS já tem CIOT emitido — cancele antes de emitir outro',
};

export function ciotErrorMessage(code?: string, anttStatus?: string, fallback?: string): string {
  if (
    code === 'emissao_falhou' ||
    code === 'cancelamento_falhou' ||
    code === 'encerramento_falhou'
  ) {
    const head = anttStatus ? `ANTT: ${anttStatus}` : 'ANTT recusou a operação';
    return fallback ? `${head} — ${fallback}` : head;
  }
  if (code && MESSAGES[code]) return MESSAGES[code];
  return fallback || 'Falha ao processar CIOT';
}
