/**
 * e-FRETE (Nstech) — CIOT modalidade GRATUITA (declaratória).
 * Sem PEF / sem movimentação financeira / sem saldo.
 *
 * Docs: docs/CIOT/Análise da Integração efrete Gratuita.pdf
 * Homolog WSDL: https://dev.efrete.com.br/Services/PefService.asmx?WSDL
 *
 * Secrets: EFRETE_HASH, EFRETE_BASE_URL (opcional)
 *
 * NÃO usar WebRouter/AILOG Bank para CIOT (pago).
 */

export interface EfreteCiotFreeInput {
  /** Identificador único da operação no TMS (idempotência). */
  codigoOperacao: string;
  contratanteCnpj: string;
  contratadoCpfCnpj: string;
  motoristaCpf: string;
  placa: string;
  rntrcContratado?: string;
  valorFrete: number; // R$
  pesoKg: number;
  origemUf: string;
  destinoUf: string;
  origemMunicipio?: string;
  destinoMunicipio?: string;
  /** Chaves CT-e / NF-e vinculadas (opcional). */
  documentos?: string[];
}

export interface EfreteCiotFreeResult {
  ok: boolean;
  ciotNumber?: string;
  protocolo?: string;
  message?: string;
  raw?: unknown;
  stub?: boolean;
}

function env(key: string): string | undefined {
  return Deno.env.get(key) ?? undefined;
}

/**
 * Emite CIOT gratuito via e-FRETE.
 * Sem EFRETE_HASH: retorna stub explícito (não inventa sucesso silencioso em prod).
 */
export async function emitCiotGratuitoEfrete(
  input: EfreteCiotFreeInput
): Promise<EfreteCiotFreeResult> {
  const hash = env('EFRETE_HASH');
  const base =
    env('EFRETE_BASE_URL') ??
    (env('EFRETE_AMBIENTE') === 'prod' ? 'https://www.efrete.com.br' : 'https://dev.efrete.com.br');

  if (!hash) {
    return {
      ok: false,
      message:
        'EFRETE_HASH ausente — cadastre integrador Nstech e sete secret no Hub. CIOT gratuito não emitido.',
      stub: true,
    };
  }

  // Placeholder: integração SOAP AdicionarOperacaoTransporte + AdicionarViagem
  // (manual v6/v8). Payload JSON abaixo é contrato interno até WSDL amarrado.
  const url = `${base.replace(/\/$/, '')}/Services/PefService.asmx`;
  const body = {
    modalidade: 'ciot_gratuito',
    hash,
    operacao: {
      codigo: input.codigoOperacao,
      contratante_cnpj: input.contratanteCnpj.replace(/\D/g, ''),
      contratado_documento: input.contratadoCpfCnpj.replace(/\D/g, ''),
      motorista_cpf: input.motoristaCpf.replace(/\D/g, ''),
      placa: input.placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
      rntrc: input.rntrcContratado?.replace(/\D/g, ''),
      valor_frete: input.valorFrete,
      peso_kg: input.pesoKg,
      origem_uf: input.origemUf,
      destino_uf: input.destinoUf,
      documentos: input.documentos ?? [],
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Efrete-Hash': hash,
        'X-Efrete-Modalidade': 'gratuito',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let raw: unknown = text;
    try {
      raw = JSON.parse(text);
    } catch {
      /* SOAP XML — parse depois */
    }
    if (!res.ok) {
      return {
        ok: false,
        message: `e-FRETE HTTP ${res.status}: ${text.slice(0, 300)}`,
        raw,
      };
    }
    const obj = raw as Record<string, unknown>;
    const ciot =
      String(obj.ciot ?? obj.CIOT ?? obj.numeroCiot ?? obj.NumeroCIOT ?? '').replace(/\D/g, '') ||
      undefined;
    if (!ciot) {
      return {
        ok: false,
        message:
          'e-FRETE respondeu sem número CIOT — amarrar parser SOAP (AdicionarOperacaoTransporte) ao WSDL homolog',
        raw,
      };
    }
    return {
      ok: true,
      ciotNumber: ciot.slice(0, 16),
      protocolo: String(obj.protocolo ?? obj.Protocolo ?? '') || undefined,
      raw,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
