import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkCoverageLimit,
  isAcademiaCargo,
  pickReferencePolicy,
  resolveCoverageLimit,
  touchesRjMetro,
} from '../insurance-limit';
import {
  evaluateEmissionGate,
  effectiveStatus,
  findCoveringException,
  responseDeadline,
} from '../insurance-exception';

const RCDC = {
  policy_type: 'RC-DC',
  coverage_limit: '600000.00',
  metadata: {
    lmg_breakdown: { academia: 3000000, rj_metropolitano: 600000, academia_rj: 600000 },
  },
};

const RIO = 3304557;
const JOAO_PESSOA = 2507507;
const ITAJAI = 4208203;
const CURITIBA = 4106902;

describe('isAcademiaCargo', () => {
  it('tipos fitness do HUB são academia (inclusive vazio e grafia errada)', () => {
    for (const t of [
      'EQUIPAMENTOS',
      'EQUIPAMENTOS ',
      'EQUPAMENTOS',
      'ESTEIRAS',
      'ACESSÓRIOS',
      null,
      '',
    ]) {
      expect(isAcademiaCargo(t)).toBe(true);
    }
  });
  it('mercadoria não fitness sai da classe academia', () => {
    expect(isAcademiaCargo('PRODUTOS QUÍMICOS')).toBe(false);
    expect(isAcademiaCargo('Alimentos')).toBe(false);
  });
});

describe('touchesRjMetro', () => {
  it('origem na RM-RJ por IBGE', () => {
    expect(touchesRjMetro({ originIbge: RIO, destinationIbge: JOAO_PESSOA })).toBe('origem');
  });
  it('destino na RM-RJ', () => {
    expect(touchesRjMetro({ originIbge: ITAJAI, destinationIbge: 3303302 })).toBe('destino');
  });
  it('RJ fora da RM (Campos) não conta quando há IBGE', () => {
    expect(touchesRjMetro({ originIbge: 3301009, destinationIbge: ITAJAI })).toBeNull();
  });
  it('sem IBGE, UF RJ conta (conservador)', () => {
    expect(touchesRjMetro({ originUf: 'rj', destinationUf: 'PB' })).toBe('origem');
  });
  it('percurso passando pelo RJ conta', () => {
    expect(
      touchesRjMetro({
        originIbge: ITAJAI,
        destinationIbge: JOAO_PESSOA,
        routeUfs: ['SP', 'RJ', 'MG'],
      })
    ).toBe('percurso');
  });
  it('rota sem RJ', () => {
    expect(
      touchesRjMetro({ originIbge: ITAJAI, destinationIbge: CURITIBA, routeUfs: ['SC', 'PR'] })
    ).toBeNull();
  });
});

describe('resolveCoverageLimit / checkCoverageLimit', () => {
  it('academia fora do RJ: R$ 3 mi', () => {
    const r = resolveCoverageLimit(RCDC, {
      cargoType: 'EQUIPAMENTOS',
      originIbge: ITAJAI,
      destinationIbge: CURITIBA,
    });
    expect(r.limit).toBe(3000000);
    expect(r.basis).toBe('academia');
  });
  it('academia saindo do Rio: sublimite R$ 600 mil', () => {
    const r = resolveCoverageLimit(RCDC, {
      cargoType: 'ESTEIRAS',
      originIbge: RIO,
      destinationIbge: JOAO_PESSOA,
    });
    expect(r.limit).toBe(600000);
    expect(r.basis).toBe('academia_rj');
    expect(r.rjTouch).toBe('origem');
  });
  it('não academia fora do RJ: coverage_limit base', () => {
    const r = resolveCoverageLimit(RCDC, {
      cargoType: 'ALIMENTOS',
      originIbge: ITAJAI,
      destinationIbge: CURITIBA,
    });
    expect(r.limit).toBe(600000);
    expect(r.basis).toBe('base');
  });
  it('sem lmg_breakdown: coverage_limit', () => {
    const r = resolveCoverageLimit(
      { coverage_limit: 600000, metadata: {} },
      { cargoType: 'EQUIPAMENTOS' }
    );
    expect(r.limit).toBe(600000);
  });
  it('caso Academia JP: caminhão 1 (10583+10584+16775) excede, caminhão 2 passa', () => {
    const ctx = { cargoType: 'EQUIPAMENTOS', originIbge: RIO, destinationIbge: JOAO_PESSOA };
    const c1 = checkCoverageLimit(RCDC, 932614.15, ctx);
    expect(c1.ok).toBe(false);
    expect(c1.excess).toBeCloseTo(332614.15, 2);
    expect(checkCoverageLimit(RCDC, 597075.19, ctx).ok).toBe(true);
  });
  it('academia R$ 1,5 mi fora do RJ passa (antes bloqueava em R$ 600 mil)', () => {
    expect(
      checkCoverageLimit(RCDC, 1500000, {
        cargoType: 'EQUIPAMENTOS',
        originIbge: ITAJAI,
        destinationIbge: CURITIBA,
      }).ok
    ).toBe(true);
  });
});

describe('pickReferencePolicy', () => {
  it('prefere RC-DC independente da ordem', () => {
    const rctrc = { policy_type: 'RCTR-C', coverage_limit: 1 };
    const rcdc = { policy_type: 'RC-DC', coverage_limit: 2 };
    expect(pickReferencePolicy([rctrc, rcdc])).toBe(rcdc);
    expect(pickReferencePolicy([rctrc])).toBe(rctrc);
    expect(pickReferencePolicy([])).toBeNull();
  });
});

describe('responseDeadline (3 dias úteis, BRT)', () => {
  it('envio na quarta 30/09/2026 → fim do dia seg 05/10', () => {
    // qua 30/09 14:00 BRT → qui 01, sex 02, seg 05 → 05/10 23:59:59 BRT
    const d = responseDeadline(new Date('2026-09-30T17:00:00Z'));
    expect(d.toISOString()).toBe('2026-10-06T02:59:59.000Z');
  });
  it('envio na sexta pula fim de semana', () => {
    // sex 02/10 → seg 05, ter 06, qua 07
    const d = responseDeadline(new Date('2026-10-02T15:00:00Z'));
    expect(d.toISOString()).toBe('2026-10-08T02:59:59.000Z');
  });
  it('pula feriado nacional fixo (12/10)', () => {
    // sex 09/10 → seg 12 feriado → ter 13, qua 14, qui 15
    const d = responseDeadline(new Date('2026-10-09T15:00:00Z'));
    expect(d.toISOString()).toBe('2026-10-16T02:59:59.000Z');
  });
  it('envio 23h BRT conta pelo dia BRT (não UTC)', () => {
    // qua 30/09 23:30 BRT = 01/10 02:30Z → mesmo prazo que envio na quarta
    const d = responseDeadline(new Date('2026-10-01T02:30:00Z'));
    expect(d.toISOString()).toBe('2026-10-06T02:59:59.000Z');
  });
});

describe('liberação: status efetivo e cobertura', () => {
  const base = {
    id: 'r1',
    quote_ids: ['q1', 'q2'],
    cargo_value: 932614.15,
    response_deadline: '2026-10-06T02:59:59.000Z',
  };
  it('enviado dentro do prazo = sent; após prazo = aceite tácito', () => {
    expect(effectiveStatus({ ...base, status: 'sent' }, new Date('2026-10-05T12:00:00Z'))).toBe(
      'sent'
    );
    expect(effectiveStatus({ ...base, status: 'sent' }, new Date('2026-10-06T03:00:00Z'))).toBe(
      'tacit_accepted'
    );
  });
  it('recusado nunca vira tácito', () => {
    expect(effectiveStatus({ ...base, status: 'rejected' }, new Date('2027-01-01'))).toBe(
      'rejected'
    );
  });
  it('cobre só se contém todas as cotações e valor aprovado ≥ atual', () => {
    const now = new Date('2026-10-02');
    const reqs = [{ ...base, status: 'accepted' }];
    expect(findCoveringException(reqs, { quoteIds: ['q1'], cargoValue: 500000 }, now)?.id).toBe(
      'r1'
    );
    expect(
      findCoveringException(reqs, { quoteIds: ['q1', 'q3'], cargoValue: 500000 }, now)
    ).toBeNull();
    expect(findCoveringException(reqs, { quoteIds: ['q1'], cargoValue: 950000 }, now)).toBeNull();
  });
});

describe('evaluateEmissionGate', () => {
  const common = {
    limit: 600000,
    limitLabel: 'Sublimite academia RJ: R$ 600.000,00',
    cargoValue: 932614.15,
    quoteIds: ['q1'],
  };
  it('dentro do limite libera sem pedido', () => {
    expect(evaluateEmissionGate({ ...common, limitOk: true, requests: [] }).allowed).toBe(true);
  });
  it('acima do limite sem pedido bloqueia (required)', () => {
    const g = evaluateEmissionGate({ ...common, limitOk: false, requests: [] });
    expect(g.allowed).toBe(false);
    if (!g.allowed) expect(g.error).toBe('insurance_exception_required');
  });
  it('pedido enviado no prazo bloqueia (pending)', () => {
    const g = evaluateEmissionGate({
      ...common,
      limitOk: false,
      now: new Date('2026-10-01'),
      requests: [
        {
          id: 'r',
          status: 'sent',
          quote_ids: ['q1'],
          cargo_value: 932614.15,
          response_deadline: '2026-10-06T02:59:59Z',
        },
      ],
    });
    expect(g.allowed).toBe(false);
    if (!g.allowed) expect(g.error).toBe('insurance_exception_pending');
  });
  it('aceito libera', () => {
    const g = evaluateEmissionGate({
      ...common,
      limitOk: false,
      requests: [{ id: 'r', status: 'accepted', quote_ids: ['q1'], cargo_value: 932614.15 }],
    });
    expect(g.allowed).toBe(true);
  });
});

describe('risco assumido (admin, sem retorno da MS)', () => {
  const base = {
    id: 'r9',
    quote_ids: ['q1'],
    cargo_value: 932614.15,
    response_deadline: '2026-10-08T02:59:59.000Z',
  };
  const before = new Date('2026-10-05T12:00:00Z');
  const after = new Date('2026-10-08T03:00:00Z');

  it('libera emissão antes do prazo, mas continua sendo risco assumido (não aceite)', () => {
    const req = { ...base, status: 'risk_accepted' };
    expect(effectiveStatus(req, before)).toBe('risk_accepted');
    const g = evaluateEmissionGate({
      limitOk: false,
      limit: 600000,
      limitLabel: 'Sublimite academia RJ',
      cargoValue: 932614.15,
      quoteIds: ['q1'],
      requests: [req],
      now: before,
    });
    expect(g.allowed).toBe(true);
  });

  it('prazo vence sem resposta → vira aceite tácito', () => {
    expect(effectiveStatus({ ...base, status: 'risk_accepted' }, after)).toBe('tacit_accepted');
  });

  it('risco assumido não cobre valor maior que o submetido à MS', () => {
    const g = evaluateEmissionGate({
      limitOk: false,
      limit: 600000,
      limitLabel: 'x',
      cargoValue: 950000,
      quoteIds: ['q1'],
      requests: [{ ...base, status: 'risk_accepted' }],
      now: before,
    });
    expect(g.allowed).toBe(false);
  });
});

describe('paridade src/lib ↔ supabase/functions/_shared', () => {
  const strip = (s: string) => s.replace(/^ \* Paridade obrigatória com .*$/m, '');
  for (const f of ['insurance-limit.ts', 'insurance-exception.ts']) {
    it(f, () => {
      const root = resolve(__dirname, '../../..');
      const a = readFileSync(resolve(root, 'src/lib', f), 'utf8');
      const b = readFileSync(resolve(root, 'supabase/functions/_shared', f), 'utf8');
      expect(strip(a)).toBe(strip(b));
    });
  }
});
