import { describe, expect, it } from 'vitest';
import {
  ailogCiotBaseUrl,
  buildAilogEmitBody,
  formatCiotDate,
  formatPlateForCiot,
  parseAilogCiotResponse,
  parseCityUfLabel,
  resolveAilogCiotAmbiente,
} from '../ailog-ciot-client.ts';
import {
  buildHubAilogEmit,
  pickContratadoFromDriverCadastro,
  type HubCiotLoad,
} from '../ailog-ciot-hub.ts';

const load: HubCiotLoad = {
  osNumber: 'OS-2026-08-0008',
  originLabel: 'Navegantes - SC',
  destLabel: 'Itajaí - SC',
  originCep: '88370000',
  destCep: '88301100',
  originIbge: 4211306,
  destIbge: 4208203,
  km: 12,
  valorFrete: 2300,
  valorPedagio: 0,
  pesoKg: 1500,
  plate: 'EFO-7869',
  tipoViagem: 1,
  contratadoDoc: '12345678901',
  contratadoNome: 'TAC Teste',
  contratadoRntrc: '12345678',
  destDoc: '30735998000214',
  destNome: 'Cliente Destino',
  contratanteDoc: '62188748000117',
  contratanteNome: 'VECTRA HUB LTDA',
  contratanteRntrc: '87654321',
  contratanteLogradouro: 'Rua A',
  contratanteNumero: '10',
  contratanteBairro: 'Centro',
  contratanteCidade: 'Navegantes',
  contratanteUf: 'SC',
  contratanteCep: '88370000',
  contratanteIbge: 4211306,
};

describe('ailog-ciot-client', () => {
  it('placa sem hífen 7 chars', () => {
    expect(formatPlateForCiot('EFO-7869')).toBe('EFO7869');
  });

  it('cidade/UF do label OS', () => {
    expect(parseCityUfLabel('Navegantes - SC')).toEqual({ cidade: 'Navegantes', uf: 'SC' });
  });

  it('base homolog vs prod', () => {
    expect(ailogCiotBaseUrl('homologacao')).toContain('way-hml.webrouter.com.br');
    expect(ailogCiotBaseUrl('producao')).toBe('https://way.webrouter.com.br/AilogBankService');
  });

  it('parse numeroCiot da resposta AILOG', () => {
    const r = parseAilogCiotResponse({
      numeroCiot: '520021362773',
      numeroProtocoloCiot: 'P1',
    });
    expect(r.ok).toBe(true);
    expect(r.ciotNumber).toBe('520021362773');
    expect(r.protocolo).toBe('P1');
  });

  it('emit body guarda campos vazios de pagamento OUTROS', () => {
    const built = buildHubAilogEmit(load, {
      origin: {
        ibge_code: 4211306,
        uf: 'SC',
        municipio: 'Navegantes',
      },
      dest: { ibge_code: 4208203, uf: 'SC', municipio: 'Itajaí' },
      contratante: { ibge_code: 4211306, uf: 'SC', municipio: 'Navegantes' },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const body = buildAilogEmitBody(built.input);
    expect(body.tipoPagamento).toBe('OUTROS');
    expect(body.codigoCliente).toBe('OS-2026-08-0008');
    expect((body.veiculos as Array<{ placa: string }>)[0].placa).toBe('EFO7869');
    expect(body.cepOrigem).toBe('88370-000');
  });

  it('recusa contratado sem RNTRC', () => {
    const r = buildHubAilogEmit(
      { ...load, contratadoRntrc: '' },
      {
        origin: { ibge_code: 1, uf: 'SC', municipio: 'X' },
        dest: { ibge_code: 2, uf: 'SC', municipio: 'Y' },
        contratante: { ibge_code: 1, uf: 'SC', municipio: 'X' },
      }
    );
    expect(r.ok).toBe(false);
  });

  it('formatCiotDate dd/MM/yyyy', () => {
    expect(formatCiotDate(new Date('2026-08-19T15:00:00-03:00'))).toMatch(/^\d{2}\/\d{2}\/2026$/);
  });

  it('TAC usa CPF+ANTT do cadastro Motoristas, não owner vazio', () => {
    const r = pickContratadoFromDriverCadastro({
      rntrcRegistryType: 'TAC',
      driverCpf: '123.456.789-01',
      driverAntt: '12345678',
      driverName: 'João TAC',
      ownerCpfCnpj: '',
      ownerRntrc: '',
    });
    expect(r.doc).toBe('12345678901');
    expect(r.rntrc).toBe('12345678');
    expect(r.nome).toBe('João TAC');
  });
});

describe('ailog-ciot-client — resposta real 02/10/2026 e ambiente', () => {
  it('NAO_AUTORIZADO sem mensagens → erro explícito (não "sem número")', () => {
    const r = parseAilogCiotResponse({
      ciot: null,
      status: 'NAO_AUTORIZADO',
      sucesso: false,
      mensagens: null,
      numeroCIOT: null,
      dataHoraEmissao: null,
    });
    expect(r.ok).toBe(false);
    expect(r.message).toBe('AILOG CIOT nao autorizado — sem motivo informado pela AILOG');
  });

  it('mensagens[] da AILOG vira a mensagem de erro', () => {
    const r = parseAilogCiotResponse({
      sucesso: false,
      status: 'NAO_AUTORIZADO',
      mensagens: [{ mensagem: 'RNTRC do contratado inválido' }, 'Placa não vinculada'],
    });
    expect(r.ok).toBe(false);
    expect(r.message).toBe('RNTRC do contratado inválido; Placa não vinculada');
  });

  it('numeroCIOT (maiúsculo) com sucesso', () => {
    const r = parseAilogCiotResponse({
      sucesso: true,
      status: 'AUTORIZADO',
      numeroCIOT: '520021999999',
    });
    expect(r.ok).toBe(true);
    expect(r.ciotNumber).toBe('520021999999');
  });

  it("FOCUS_NFE_AMBIENTE='prod' → CIOT em produção", () => {
    const g = globalThis as { Deno?: unknown };
    const prev = g.Deno;
    const env: Record<string, string> = { FOCUS_NFE_AMBIENTE: 'prod' };
    g.Deno = { env: { get: (k: string) => env[k] } };
    try {
      expect(resolveAilogCiotAmbiente()).toBe('producao');
      env.FOCUS_NFE_AMBIENTE = 'homolog';
      expect(resolveAilogCiotAmbiente()).toBe('homologacao');
      env.CIOT_AMBIENTE = 'homologacao';
      env.FOCUS_NFE_AMBIENTE = 'prod';
      expect(resolveAilogCiotAmbiente()).toBe('homologacao'); // override explícito vence
    } finally {
      g.Deno = prev;
    }
  });
});

describe('buildHubAilogEmit — data de início não pode ser passada', () => {
  const lookups = {
    origin: { ibge_code: 4211306, uf: 'SC', municipio: 'Navegantes' },
    dest: { ibge_code: 4208203, uf: 'SC', municipio: 'Itajaí' },
    contratante: { ibge_code: 4211306, uf: 'SC', municipio: 'Navegantes' },
  };
  const now = new Date('2026-10-02T19:31:00Z'); // 02/10 16:31 BRT

  it('coleta 30/09 emitida 02/10 → início 02/10, fim mantém duração', () => {
    const built = buildHubAilogEmit(
      { ...load, pickupDate: '2026-09-30T12:00:00Z', eta: '2026-10-05T12:00:00Z' },
      lookups,
      now
    );
    if (!built.ok) throw new Error(built.error);
    expect(built.input.dataInicioViagem).toBe('02/10/2026');
    expect(built.input.dataFimViagem).toBe('07/10/2026');
  });

  it('coleta futura é mantida', () => {
    const built = buildHubAilogEmit(
      { ...load, pickupDate: '2026-10-04T12:00:00Z', eta: null },
      lookups,
      now
    );
    if (!built.ok) throw new Error(built.error);
    expect(built.input.dataInicioViagem).toBe('04/10/2026');
    expect(built.input.dataFimViagem).toBe('11/10/2026');
  });
});
