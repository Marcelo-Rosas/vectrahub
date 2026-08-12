// @ts-nocheck
/**
 * emit-mdfe: build and submit an MDF-e (modelo 58) to Focus NFe aggregating
 * N authorized CT-es for a single (vehicle, driver, date, UF route).
 *
 * Body: {
 *   cte_emission_ids: string[],   // must all be status=authorized
 *   vehicle_id: string,
 *   driver_id: string,
 *   percurso_ufs?: string[],      // intermediate UFs between origin and destination
 *   produto_predominante?: { descricao: string, ncm?: string, cean?: string }
 * }
 *
 * Flow:
 *   1. Auth JWT.
 *   2. Load N CT-e rows (all must be authorized + chave_cte populated).
 *   3. Load vehicle + driver.
 *   4. Derive municipios_carregamento from shipper.ibge of each CT-e's quote.
 *   5. Allocate (serie, numero) via next_mdfe_numero RPC.
 *   6. Build payload via mdfe-mapper.
 *   7. POST Focus /v2/mdfe.
 *   8. Persist mdfe_emissions + mdfe_cte_link.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { FocusClient, type FocusAmbiente } from '../_shared/focus-client.ts';
import type { VectraConfig } from '../_shared/cte-mapper.ts';
import {
  buildMdfePayload,
  type VehicleRow,
  type DriverRow,
  type CteRowForMdfe,
  type MunicipioCarregamento,
} from '../_shared/mdfe-mapper.ts';
import { resolveMdfePercursoUfs } from '../_shared/uf-percurso.ts';
import { calculateRouteDistanceFull } from '../_shared/webrouter-client.ts';
import { extractNcmFromNfeXml, extractNcmFromPdfBytes } from '../_shared/nfe-extract.ts';
import { resolveMdfeSeguros } from '../_shared/mdfe-seguro-resolver.ts';

function envOrThrow(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`[emit-mdfe] missing env: ${key}`);
  return v;
}

function buildVectraConfig(): VectraConfig {
  return {
    cnpj: envOrThrow('VECTRA_CNPJ'),
    nome: envOrThrow('VECTRA_NOME'),
    fantasia: Deno.env.get('VECTRA_FANTASIA') ?? envOrThrow('VECTRA_NOME'),
    ie: envOrThrow('VECTRA_IE'),
    iest: Deno.env.get('VECTRA_IEST') ?? envOrThrow('VECTRA_IE'),
    rntrc: envOrThrow('VECTRA_RNTRC'),
    logradouro: envOrThrow('VECTRA_LOGRADOURO'),
    numero: envOrThrow('VECTRA_NUMERO'),
    complemento: Deno.env.get('VECTRA_COMPLEMENTO'),
    bairro: envOrThrow('VECTRA_BAIRRO'),
    municipio: envOrThrow('VECTRA_MUNICIPIO'),
    ibge: Number(envOrThrow('VECTRA_IBGE_MUN')),
    uf: envOrThrow('VECTRA_UF'),
    cep: envOrThrow('VECTRA_CEP'),
    telefone: Deno.env.get('VECTRA_TELEFONE'),
    crt: Number(envOrThrow('VECTRA_CRT')),
  };
}

function json(body: unknown, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  });
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);

  // Auth
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401, cors);
  const userJwt = authHeader.slice('Bearer '.length);

  const supabaseUrl = envOrThrow('SUPABASE_URL');
  const serviceRoleKey = envOrThrow('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = envOrThrow('SUPABASE_ANON_KEY');

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401, cors);
  const userId = userData.user.id;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, cors);
  }

  const cteIds: string[] = Array.isArray(body.cte_emission_ids)
    ? (body.cte_emission_ids as string[])
    : [];
  const vehicleId = String(body.vehicle_id ?? '');
  const driverId = String(body.driver_id ?? '');
  if (cteIds.length === 0) return json({ error: 'cte_emission_ids_required' }, 400, cors);
  if (!vehicleId) return json({ error: 'vehicle_id_required' }, 400, cors);
  if (!driverId) return json({ error: 'driver_id_required' }, 400, cors);

  // Load CT-es + payload_sent (fonte IBGE/UF já aceitos pela SEFAZ no CT-e)
  const { data: ctes, error: ctesErr } = await supabase
    .from('cte_emissions')
    .select('id, status, chave_cte, quote_id, payload_sent')
    .in('id', cteIds);
  if (ctesErr) return json({ error: 'cte_load_failed', detail: ctesErr.message }, 500, cors);
  if (!ctes || ctes.length !== cteIds.length) {
    return json(
      {
        error: 'some_ctes_not_found',
        detail: { requested: cteIds.length, found: ctes?.length ?? 0 },
      },
      404,
      cors
    );
  }
  const notAuthorized = ctes.filter((c: { status: string }) => c.status !== 'authorized');
  if (notAuthorized.length > 0) {
    return json(
      {
        error: 'cte_not_authorized',
        detail: { ids: notAuthorized.map((c: { id: string }) => c.id) },
      },
      422,
      cors
    );
  }
  const missingChave = ctes.filter((c: { chave_cte: string | null }) => !c.chave_cte);
  if (missingChave.length > 0) {
    return json(
      {
        error: 'cte_missing_chave',
        detail: { ids: missingChave.map((c: { id: string }) => c.id) },
      },
      422,
      cors
    );
  }

  // Load quotes for the CT-es (for cargo data, municipios, etc.)
  const quoteIds = ctes.map((c: { quote_id: string | null }) => c.quote_id).filter(Boolean);
  const { data: quotes, error: quotesErr } = await supabase
    .from('quotes')
    .select(
      'id, shipper_id, client_id, weight, cargo_value, cargo_type, nfe_keys, destination_ibge, destination, destination_uf, destination_cep, origin_ibge, origin, origin_uf, origin_cep'
    )
    .in('id', quoteIds);
  if (quotesErr || !quotes) return json({ error: 'quotes_load_failed' }, 500, cors);
  const quoteById = new Map<string, any>(quotes.map((q: any) => [q.id, q]));

  // Load shippers + clients (IBGE/UF fallback quando quote.*_ibge/_uf vazios)
  const shipperIds = Array.from(new Set(quotes.map((q: any) => q.shipper_id).filter(Boolean)));
  const clientIds = Array.from(new Set(quotes.map((q: any) => q.client_id).filter(Boolean)));
  const [{ data: shippers, error: shipErr }, { data: clients, error: clientErr }] =
    await Promise.all([
      supabase
        .from('shippers')
        .select('id, name, cnpj, ibge_code, city, state, zip_code')
        .in('id', shipperIds),
      clientIds.length
        ? supabase
            .from('clients')
            .select('id, ibge_code, city, state, zip_code')
            .in('id', clientIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (shipErr || !shippers) return json({ error: 'shippers_load_failed' }, 500, cors);
  if (clientErr)
    return json({ error: 'clients_load_failed', detail: clientErr.message }, 500, cors);
  const shipperById = new Map<string, any>(shippers.map((s: any) => [s.id, s]));
  const clientById = new Map<string, any>((clients ?? []).map((c: any) => [c.id, c]));

  const ufFromText = (s: string | null | undefined): string => {
    const m = String(s ?? '').match(/,?\s*([A-Za-z]{2})\s*$/);
    return m ? m[1].toUpperCase() : '';
  };

  // Build CteRowForMdfe[] + municipios_carregamento[]
  // Prioridade IBGE/UF: payload CT-e autorizado → quote → client/shipper → texto.
  const ctesForMdfe: CteRowForMdfe[] = [];
  const carregamentoMap = new Map<number, { nome: string; uf: string }>(); // ibge → meta
  for (const cte of ctes) {
    const quote = quoteById.get(cte.quote_id);
    if (!quote) continue;
    const shipper = shipperById.get(quote.shipper_id);
    const client = clientById.get(quote.client_id);
    const ps = (cte.payload_sent ?? {}) as Record<string, unknown>;

    const originIbge = Number(
      ps.codigo_municipio_inicio ||
        ps.codigo_municipio_envio ||
        quote.origin_ibge ||
        shipper?.ibge_code ||
        0
    );
    const originUf = String(
      ps.uf_inicio ||
        ps.uf_envio ||
        quote.origin_uf ||
        shipper?.state ||
        ufFromText(quote.origin) ||
        ''
    )
      .toUpperCase()
      .slice(0, 2);
    const originNome = String(
      ps.municipio_inicio || ps.municipio_envio || shipper?.city || quote.origin || 'SEM CIDADE'
    );
    if (originIbge > 0) carregamentoMap.set(originIbge, { nome: originNome, uf: originUf });

    const destIbge = Number(
      ps.codigo_municipio_fim || quote.destination_ibge || client?.ibge_code || 0
    );
    const destUf = String(
      ps.uf_fim || quote.destination_uf || client?.state || ufFromText(quote.destination) || ''
    )
      .toUpperCase()
      .slice(0, 2);
    const destNome = String(ps.municipio_fim || client?.city || quote.destination || 'SEM DESTINO');

    // Self-heal cadastro se CT-e já tinha IBGE e quote/cliente não
    if (destIbge > 0 && quote.id && !quote.destination_ibge) {
      void supabase
        .from('quotes')
        .update({ destination_ibge: destIbge, ...(destUf ? { destination_uf: destUf } : {}) })
        .eq('id', quote.id);
    }
    if (destIbge > 0 && quote.client_id && !client?.ibge_code) {
      void supabase.from('clients').update({ ibge_code: destIbge }).eq('id', quote.client_id);
    }

    ctesForMdfe.push({
      chave_cte: cte.chave_cte,
      municipio_destino_ibge: destIbge,
      municipio_destino_nome: destNome,
      uf_destino: destUf,
      uf_origem: originUf,
      valor_carga: Number(quote.cargo_value ?? 0),
      peso_kg: Number(quote.weight ?? 0),
    });
  }
  // Fallback carregamento = município emitente Vectra só se CT-e sem origem
  if (carregamentoMap.size === 0) {
    try {
      const ibge = Number(envOrThrow('VECTRA_IBGE_MUN'));
      const mun = Deno.env.get('VECTRA_MUNICIPIO') ?? 'Itajai';
      const uf = String(Deno.env.get('VECTRA_UF') ?? 'SC')
        .toUpperCase()
        .slice(0, 2);
      if (ibge > 0) carregamentoMap.set(ibge, { nome: mun, uf });
    } catch {
      /* vectra secrets ausentes — mapper vai warn */
    }
  }
  const municipiosCarregamento: MunicipioCarregamento[] = Array.from(carregamentoMap.entries()).map(
    ([codigo, meta]) => ({ codigo, nome: meta.nome, uf: meta.uf })
  );

  // Load vehicle + driver
  const [{ data: vehicle, error: vErr }, { data: driver, error: dErr }] = await Promise.all([
    supabase.from('vehicles').select('*').eq('id', vehicleId).single(),
    supabase.from('drivers').select('*').eq('id', driverId).single(),
  ]);
  if (vErr || !vehicle) return json({ error: 'vehicle_not_found' }, 404, cors);
  if (dErr || !driver) return json({ error: 'driver_not_found' }, 404, cors);

  // Proprietário (terceiro/TAC) vem do owner vinculado ao veículo. Sem owner_id
  // = veículo próprio Vectra (mapper usa os dados da Vectra).
  let proprietario: Record<string, unknown> | undefined;
  if ((vehicle as any).owner_id) {
    const { data: owner } = await supabase
      .from('owners')
      .select(
        'name, cpf_cnpj, rntrc, uf, tipo_proprietario, payment_prefer, pix_key, bank_code, bank_agency, bank_account'
      )
      .eq('id', (vehicle as any).owner_id)
      .single();
    if (owner) {
      proprietario = {
        nome: (owner as any).name ?? '',
        cpf_cnpj: (owner as any).cpf_cnpj ?? '',
        rntrc: (owner as any).rntrc ?? '',
        uf: (owner as any).uf ?? '',
        tipo_proprietario: (owner as any).tipo_proprietario ?? 0,
        payment_prefer: (owner as any).payment_prefer ?? null,
        pix_key: (owner as any).pix_key ?? null,
        bank_code: (owner as any).bank_code ?? null,
        bank_agency: (owner as any).bank_agency ?? null,
        bank_account: (owner as any).bank_account ?? null,
      };
    }
  }

  // Seguro da carga: apólices ativas (RCTR-C / RC-DC). Responsável = emitente (Vectra).
  // SEFAZ 699: nAver obrigatório no rodoviário. Fontes (ordem — ver mdfe-seguro-resolver):
  //   1) averbacoes AT&M do CT-e
  //   2) risk_policies.metadata.numero_averbacao
  //   3) proposta Fairfax (averbacao_modo=email_ms) — averbação manual MS até AT&M
  //   4) secret VECTRA_SEGURO_NAVER
  const { data: averbRows } = await supabase
    .from('averbacoes')
    .select('numero_averbacao, cte_emission_id, status')
    .in('cte_emission_id', cteIds)
    .eq('status', 'averbado');
  const naverFromCte = (averbRows ?? [])
    .map((a: any) =>
      String(a.numero_averbacao ?? '')
        .replace(/\s/g, '')
        .slice(0, 40)
    )
    .filter(Boolean);

  const naverEnv = String(Deno.env.get('VECTRA_SEGURO_NAVER') ?? '')
    .replace(/\s/g, '')
    .slice(0, 40);

  const ambienteEarly = (Deno.env.get('FOCUS_NFE_AMBIENTE') as FocusAmbiente) ?? 'homolog';

  const { data: policies } = await supabase
    .from('risk_policies')
    .select('code, policy_type, insurer, metadata')
    .eq('is_active', true);

  const seguros = resolveMdfeSeguros({
    policies: (policies ?? []) as any[],
    naverFromCte,
    naverEnvOverride: naverEnv || undefined,
    ambiente: ambienteEarly === 'homolog' ? 'homolog' : 'prod',
  });

  if (seguros.length === 0) {
    return json(
      {
        error: 'seguro_incompleto',
        detail:
          'SEFAZ 699: seguro rodoviário exige nAver. Cadastre apólices Fairfax em risk_policies (propostas 63434060699 RCTR-C / 63433997322 RC-DC), averbe o CT-e via AT&M, ou defina VECTRA_SEGURO_NAVER. Averbação manual MS usa proposta como nAver até protocolo AT&M.',
      },
      422,
      cors
    );
  }

  // Vectra config + ambiente
  const ambiente = (Deno.env.get('FOCUS_NFE_AMBIENTE') as FocusAmbiente) ?? 'homolog';
  let vectra: VectraConfig;
  try {
    vectra = buildVectraConfig();
  } catch (err) {
    return json({ error: 'vectra_config_missing', detail: String(err) }, 500, cors);
  }

  // Allocate next numero (atomic)
  const { data: numeroData, error: numeroErr } = await supabase.rpc('next_mdfe_numero', {
    p_ambiente: ambiente,
    p_serie: 1,
  });
  if (numeroErr || numeroData == null) {
    return json({ error: 'numero_alloc_failed', detail: numeroErr?.message }, 500, cors);
  }
  const numero = Number(numeroData);
  const serie = 1;

  // Retry/ref: cada MDF-e prévio ligado aos mesmos CT-es incrementa `-rN`
  // (espelha emit-cte; evita UNIQUE mdfe_emissions_ref_key + dedup Focus).
  const bodyRetry = Number(body.retry ?? body.force_retry ?? NaN);
  let retry = Number.isFinite(bodyRetry) && bodyRetry >= 0 ? Math.floor(bodyRetry) : 0;
  if (!Number.isFinite(bodyRetry)) {
    const { data: priorLinks, error: priorErr } = await supabase
      .from('mdfe_cte_link')
      .select('mdfe_id')
      .in('cte_emission_id', cteIds);
    if (priorErr) {
      return json({ error: 'retry_count_failed', detail: priorErr.message }, 500, cors);
    }
    retry = new Set((priorLinks ?? []).map((l: { mdfe_id: string }) => l.mdfe_id)).size;
  }

  // Contratante hint = shipper (frota própria). Com prop TAC/ETC o mapper força
  // emitente Vectra (SEFAZ 741). SEFAZ 578 exige ≥1 infContratante.
  const firstQuote = quotes[0];
  const firstShipper = firstQuote ? shipperById.get(firstQuote.shipper_id) : null;
  const firstClient = firstQuote ? clientById.get(firstQuote.client_id) : null;
  const firstPs = (ctes[0]?.payload_sent ?? {}) as Record<string, unknown>;
  const contratante = {
    nome: String(
      firstPs.nome_remetente || firstShipper?.name || vectra.nome || 'CONTRATANTE'
    ).slice(0, 60),
    cnpj:
      String(firstPs.cnpj_remetente || firstShipper?.cnpj || '').replace(/\D/g, '') || undefined,
    cpf: String(firstPs.cpf_remetente || '').replace(/\D/g, '') || undefined,
  };

  // CEPs origem/destino — WebRouter + SEFAZ 726 (infLotacao quando 1 CT-e)
  const originCep = String(
    (body.cep_carregamento as string) ||
      firstQuote?.origin_cep ||
      firstShipper?.zip_code ||
      firstPs.cep_remetente ||
      ''
  ).replace(/\D/g, '');
  const destCep = String(
    (body.cep_descarregamento as string) ||
      firstQuote?.destination_cep ||
      firstClient?.zip_code ||
      firstPs.cep_destinatario ||
      ''
  ).replace(/\D/g, '');

  // Percurso (UFPer) — SEFAZ 663 se vazio/errado quando UFIni e UFFim não fazem fronteira.
  // Override manual: body.percurso_ufs. Senão: WebRouter (praças) → BFS divisas.
  let percursoUfs: string[] | undefined = Array.isArray(body.percurso_ufs)
    ? (body.percurso_ufs as string[]).map((u) => String(u).toUpperCase().slice(0, 2))
    : undefined;
  let percursoSource = 'body';
  if (percursoUfs === undefined) {
    const ufIniHint = String(ctesForMdfe[0]?.uf_origem ?? '')
      .toUpperCase()
      .slice(0, 2);
    const ufFimHint = String(ctesForMdfe[0]?.uf_destino ?? '')
      .toUpperCase()
      .slice(0, 2);
    let wrHint: string[] = [];
    if (originCep.length === 8 && destCep.length === 8) {
      try {
        const wr = await calculateRouteDistanceFull(originCep, destCep, [], vehicle?.axes_count);
        if (wr.success) {
          wrHint = wr.percurso_ufs_hint;
          console.log(
            `[emit-mdfe] WebRouter percurso hint: ${wrHint.join('-')} (${wr.km_distance} km, ${wr.toll_plazas.length} pedágios)`
          );
        } else {
          console.warn(`[emit-mdfe] WebRouter percurso skip: ${wr.error}`);
        }
      } catch (e) {
        console.warn(`[emit-mdfe] WebRouter percurso error:`, e);
      }
    } else {
      console.warn(
        `[emit-mdfe] CEPs incompletos p/ WebRouter (ori=${originCep || '?'} dest=${destCep || '?'}) — BFS só`
      );
    }
    const resolved = resolveMdfePercursoUfs(ufIniHint, ufFimHint, wrHint);
    percursoUfs = resolved.percurso;
    percursoSource = resolved.source;
    console.log(
      `[emit-mdfe] percurso ${ufIniHint}→${ufFimHint}: [${percursoUfs.join(',')}] source=${percursoSource}` +
        (resolved.emptyReason ? ` (${resolved.emptyReason})` : '')
    );
  }

  // Produto predominante + NCM (lotação/1 CT-e exige NCM — SEFAZ 301)
  // Ordem: body → documents.validation_metadata / XML|PDF NF-e → secret → cargo_type
  const bodyProd =
    typeof body.produto_predominante === 'object' && body.produto_predominante
      ? (body.produto_predominante as {
          descricao?: string;
          ncm?: string;
          cean?: string;
          tipoCarga?: string;
        })
      : null;

  let ncmFromNfe = '';
  let descFromNfe = '';
  let ncmSource = 'none';
  try {
    const { data: ordersForQuotes } = await supabase
      .from('orders')
      .select('id, quote_id')
      .in('quote_id', quoteIds);
    const orderIds = (ordersForQuotes ?? []).map((o: { id: string }) => o.id);

    let docsQuery = supabase
      .from('documents')
      .select('id, type, nfe_key, file_url, file_name, validation_metadata, quote_id, order_id')
      .or(
        [
          quoteIds.length ? `quote_id.in.(${quoteIds.join(',')})` : null,
          orderIds.length ? `order_id.in.(${orderIds.join(',')})` : null,
        ]
          .filter(Boolean)
          .join(',') || 'id.eq.00000000-0000-0000-0000-000000000000'
      );

    const { data: docs } = await docsQuery;
    const nfeDocs = (docs ?? []).filter((d: any) => {
      const t = String(d.type ?? '').toLowerCase();
      const name = String(d.file_name ?? '').toLowerCase();
      return (
        t === 'nfe' ||
        name.includes('nfe') ||
        name.endsWith('.xml') ||
        (d.nfe_key && String(d.nfe_key).replace(/\D/g, '').length === 44)
      );
    });

    for (const doc of nfeDocs) {
      const meta = (doc.validation_metadata ?? {}) as Record<string, unknown>;
      const metaNcm = String(meta.ncm ?? '')
        .replace(/\D/g, '')
        .slice(0, 8);
      if (metaNcm.length === 8) {
        ncmFromNfe = metaNcm;
        descFromNfe = String(meta.produto_predominante ?? '').slice(0, 120);
        ncmSource = `document_meta:${doc.id}`;
        break;
      }
    }

    if (ncmFromNfe.length !== 8) {
      for (const doc of nfeDocs) {
        const storagePath = String(doc.file_url ?? '').trim();
        if (!storagePath) continue;
        try {
          const { data: fileData, error: fileErr } = await supabase.storage
            .from('documents')
            .download(storagePath);
          if (fileErr || !fileData) continue;
          const bytes = new Uint8Array(await fileData.arrayBuffer());
          const head = new TextDecoder('utf-8').decode(bytes.slice(0, 512)).trim();
          let pred = null;
          if (head.startsWith('<?xml') || head.startsWith('<')) {
            pred = extractNcmFromNfeXml(new TextDecoder('utf-8').decode(bytes));
          } else if (
            storagePath.toLowerCase().includes('.pdf') ||
            String(doc.file_name ?? '')
              .toLowerCase()
              .endsWith('.pdf')
          ) {
            pred = extractNcmFromPdfBytes(bytes);
          }
          if (pred?.ncm?.length === 8) {
            ncmFromNfe = pred.ncm;
            descFromNfe = pred.descricao;
            ncmSource = `document_file:${doc.id}`;
            // Persiste p/ próximos emits
            void supabase
              .from('documents')
              .update({
                validation_metadata: {
                  ...((doc.validation_metadata as object) ?? {}),
                  ncm: pred.ncm,
                  produto_predominante: pred.descricao,
                  ncm_itens: pred.itens.length,
                },
                ...(doc.nfe_key
                  ? {}
                  : {
                      nfe_key:
                        String(doc.nfe_key ?? '').replace(/\D/g, '').length === 44
                          ? doc.nfe_key
                          : undefined,
                    }),
              })
              .eq('id', doc.id);
            break;
          }
        } catch (e) {
          console.warn(`[emit-mdfe] NCM extract fail doc=${doc.id}:`, e);
        }
      }
    }
  } catch (e) {
    console.warn('[emit-mdfe] NCM from NF-e lookup failed:', e);
  }

  const prodDescricao = String(
    bodyProd?.descricao ||
      descFromNfe ||
      firstPs.produto_predominante ||
      firstQuote?.cargo_type ||
      'CARGA GERAL'
  ).slice(0, 120);
  const prodNcm = String(
    bodyProd?.ncm || ncmFromNfe || Deno.env.get('VECTRA_MDFE_NCM_DEFAULT') || ''
  ).replace(/\D/g, '');
  if (bodyProd?.ncm && String(bodyProd.ncm).replace(/\D/g, '').length === 8) {
    ncmSource = 'body';
  } else if (ncmFromNfe.length === 8 && ncmSource === 'none') {
    ncmSource = 'nfe';
  } else if (prodNcm.length === 8 && ncmFromNfe.length !== 8 && !bodyProd?.ncm) {
    ncmSource = 'env_default';
  }

  console.log(
    `[emit-mdfe] produto predominante ncm=${prodNcm || '(vazio)'} source=${ncmSource} desc=${prodDescricao.slice(0, 40)}`
  );

  if (ctesForMdfe.length === 1 && prodNcm.length !== 8) {
    return json(
      {
        error: 'ncm_required_lotacao',
        detail:
          'SEFAZ 301: MDF-e com 1 CT-e (carga lotação) exige NCM do produto predominante. Anexe XML/PDF da NF-e na OS/cotação, revalide o documento, ou envie produto_predominante.ncm (8 dígitos).',
        hint_nfe_keys: firstQuote?.nfe_keys ?? [],
      },
      422,
      cors
    );
  }

  // Pagamento frete (SEFAZ 302 lotação) — valor carreteiro da OS / body
  const bodyPag =
    typeof body.pagamento === 'object' && body.pagamento
      ? (body.pagamento as { valor_contrato?: number; forma_pagamento?: 0 | 1 })
      : null;
  let valorContrato = Number(bodyPag?.valor_contrato ?? 0);
  const ciotsForMdfe: Array<{ ciot: string; cnpjResponsavel?: string }> = [];
  if (quoteIds.length > 0) {
    const { data: orderRows } = await supabase
      .from('orders')
      .select('carreteiro_real, carreteiro_antt, value, ciot_number, ciot_status')
      .in('quote_id', quoteIds)
      .limit(5);
    for (const o of orderRows ?? []) {
      const ciotStatus = String((o as any).ciot_status ?? '');
      const ciotN = String((o as any).ciot_number ?? '').replace(/\D/g, '');
      // CIOT cancelado no portal não vai no MDF-e (SEFAZ 304 com número inválido).
      if (ciotN.length >= 8 && ciotStatus !== 'cancelled') {
        ciotsForMdfe.push({ ciot: ciotN, cnpjResponsavel: vectra.cnpj });
      }
      if (!(valorContrato > 0)) {
        const raw = Number(
          (o as any).carreteiro_real ?? (o as any).carreteiro_antt ?? (o as any).value ?? 0
        );
        if (raw > 0) {
          const asCents = Deno.env.get('VECTRA_MONEY_CENTS') === '1';
          valorContrato = asCents ? raw / 100 : raw;
        }
      }
    }
  }
  // Body override CIOT (homolog / e-FRETE já gerado)
  if (Array.isArray(body.ciots)) {
    for (const c of body.ciots as Array<{ ciot?: string; cnpj_responsavel?: string }>) {
      const n = String(c?.ciot ?? '').replace(/\D/g, '');
      if (n.length >= 8) {
        ciotsForMdfe.push({
          ciot: n,
          cnpjResponsavel: c.cnpj_responsavel || vectra.cnpj,
        });
      }
    }
  }
  if (!(valorContrato > 0)) {
    const fromCte = Number(firstPs.valor_total ?? firstPs.valor_receber ?? 0);
    if (fromCte > 0) valorContrato = fromCte;
  }

  const hasPix = String(proprietario?.pix_key ?? '').trim().length >= 2;
  const hasBanco =
    String(proprietario?.bank_code ?? '').replace(/\D/g, '').length >= 3 &&
    String(proprietario?.bank_agency ?? '').trim().length > 0;
  const hasPayBank = hasPix || hasBanco;

  if (ctesForMdfe.length === 1 && (!hasPayBank || !(valorContrato > 0))) {
    return json(
      {
        error: 'payment_required_lotacao',
        detail:
          'SEFAZ 302: MDF-e carga lotação exige pagamentos (infPag). Cadastre PIX ou banco+agência no proprietário do veículo (Owners) e informe carreteiro_real na OS.',
        has_owner_bank: hasPayBank,
        valor_contrato: valorContrato,
        owner_id: (vehicle as any).owner_id ?? null,
      },
      422,
      cors
    );
  }

  // Build payload
  let built;
  try {
    built = buildMdfePayload({
      ctes: ctesForMdfe,
      vehicle: vehicle as VehicleRow,
      driver: driver as DriverRow,
      serie,
      numero,
      vectra,
      retry,
      municipiosCarregamento,
      seguros,
      proprietario,
      contratante,
      percursoUfs: percursoUfs && percursoUfs.length > 0 ? percursoUfs : undefined,
      cepCarregamento: originCep.length === 8 ? originCep : undefined,
      cepDescarregamento: destCep.length === 8 ? destCep : undefined,
      produtoPredominante: {
        descricao: prodDescricao,
        tipoCarga: bodyProd?.tipoCarga,
        ncm: prodNcm.length === 8 ? prodNcm : undefined,
        cean: bodyProd?.cean,
      },
      pagamento:
        valorContrato > 0
          ? {
              valorContrato,
              formaPagamento: bodyPag?.forma_pagamento ?? 0,
            }
          : undefined,
      ciots: ciotsForMdfe.length > 0 ? ciotsForMdfe : undefined,
    });
  } catch (err) {
    return json({ error: 'mapper_failed', detail: String(err) }, 500, cors);
  }

  // Lotação: mapper deve ter emitido pagamentos
  const modalRod = (built.payload as any)?.modal_rodoviario;
  if (ctesForMdfe.length === 1 && !modalRod?.pagamentos?.length) {
    return json(
      {
        error: 'payment_required_lotacao',
        detail:
          'SEFAZ 302: pagamentos não montados. Verifique nome/CPF e PIX ou banco no owner do veículo.',
        warnings: built.warnings,
      },
      422,
      cors
    );
  }

  // Insert mdfe_emissions BEFORE Focus call
  const ufInicio = built.payload.uf_inicio as string;
  const ufFim = built.payload.uf_fim as string;
  const { data: emission, error: insErr } = await supabase
    .from('mdfe_emissions')
    .insert({
      ref: built.ref,
      ambiente,
      serie,
      numero,
      status: 'sent',
      vehicle_id: vehicleId,
      driver_id: driverId,
      uf_inicio: ufInicio,
      uf_fim: ufFim,
      payload_sent: built.payload,
      created_by: userId,
    })
    .select()
    .single();
  if (insErr || !emission) {
    return json({ error: 'persist_failed', detail: insErr?.message }, 500, cors);
  }

  // Link CT-es
  const linkRows = cteIds.map((cid) => ({ mdfe_id: emission.id, cte_emission_id: cid }));
  await supabase.from('mdfe_cte_link').insert(linkRows);

  // POST Focus
  let focusResp;
  try {
    const focus = new FocusClient({ ambiente });
    focusResp = await focus.emitMdfe(built.ref, built.payload);
  } catch (err) {
    await supabase
      .from('mdfe_emissions')
      .update({
        status: 'rejected',
        rejection_code: 'focus_network',
        rejection_msg: String(err),
        response_received: { error: String(err) },
      })
      .eq('id', emission.id);
    return json({ error: 'focus_unreachable', detail: String(err) }, 502, cors);
  }

  const focusStatus = String(focusResp.body.status ?? '');
  const isError = focusResp.status >= 400 && focusResp.status !== 409 && focusResp.status !== 422;
  let newStatus = 'processing';
  let finalBody = focusResp.body;
  if (focusResp.status === 202 || focusStatus === 'processando_autorizacao')
    newStatus = 'processing';
  else if (focusStatus === 'autorizado') newStatus = 'authorized';
  else if (focusStatus === 'cancelado') newStatus = 'cancelled';
  else if (focusStatus === 'erro_autorizacao' || focusResp.status === 422) newStatus = 'rejected';
  // Pré-validação Focus (ex.: parametros_modal_nao_informados) volta {codigo,
  // mensagem} sem `status` e HTTP >= 400 — sem isto a row ficava 'processing'.
  else if (isError || focusResp.body.codigo) newStatus = 'rejected';

  // Homolog: poll curto se processando (mesmo padrão emit-cte).
  if (newStatus === 'processing') {
    const focus = new FocusClient({ ambiente });
    for (const waitMs of [2500, 3500, 5000]) {
      await new Promise((r) => setTimeout(r, waitMs));
      try {
        const polled = await focus.consultMdfe(built.ref);
        const st = String(polled.body.status ?? '');
        finalBody = polled.body;
        if (st === 'autorizado') {
          newStatus = 'authorized';
          break;
        }
        if (st === 'erro_autorizacao' || st === 'cancelado') {
          newStatus = st === 'cancelado' ? 'cancelled' : 'rejected';
          break;
        }
      } catch {
        // UI ainda pode Consultar
      }
    }
  }

  const isRejected = newStatus === 'rejected';
  await supabase
    .from('mdfe_emissions')
    .update({
      status: newStatus,
      response_received: finalBody,
      status_sefaz: finalBody.status_sefaz ?? null,
      chave_mdfe: finalBody.chave ?? null,
      protocolo: finalBody.protocolo ?? finalBody.numero_protocolo ?? null,
      data_autorizacao: newStatus === 'authorized' ? new Date().toISOString() : null,
      rejection_code: isRejected
        ? String(finalBody.codigo_status ?? finalBody.codigo ?? focusResp.status)
        : null,
      rejection_msg: isRejected
        ? String(finalBody.mensagem_sefaz ?? finalBody.mensagem ?? '')
        : null,
    })
    .eq('id', emission.id);

  return json(
    {
      ok: !isError && newStatus !== 'rejected',
      emission_id: emission.id,
      ref: built.ref,
      ambiente,
      serie,
      numero,
      status: newStatus,
      focus_status: focusResp.status,
      focus_body: finalBody,
      warnings: built.warnings,
      cte_count: cteIds.length,
      percurso_ufs: percursoUfs ?? [],
      percurso_source: percursoSource,
      cep_carregamento: originCep.length === 8 ? originCep : null,
      cep_descarregamento: destCep.length === 8 ? destCep : null,
    },
    isError || newStatus === 'rejected' ? 502 : 200,
    cors
  );
});
