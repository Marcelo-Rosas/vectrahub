/**
 * Percurso MDF-e (UFPer) — UFs intermediárias entre UFIni e UFFim.
 *
 * SEFAZ 663:
 *  - UFs fronteiriças / mesma UF → NÃO informar percurso
 *  - Caso contrário → informar UFs de passagem na ordem, SEM incluir início/fim
 *  - Ordem deve respeitar divisas estaduais (grafo de adjacência)
 *
 * WebRouter: praças de pedágio trazem UF na ordem da rota — usa como hint;
 * se o caminho for inválido no grafo, cai no BFS por divisas.
 */

/** Divisas terrestres BR (bidirecional). */
const UF_BORDERS: Record<string, string[]> = {
  AC: ['AM', 'RO'],
  AL: ['BA', 'PE', 'SE'],
  AP: ['PA'],
  AM: ['AC', 'MT', 'PA', 'RO', 'RR'],
  BA: ['AL', 'ES', 'GO', 'MG', 'PE', 'PI', 'SE', 'TO'],
  CE: ['PB', 'PE', 'PI', 'RN'],
  DF: ['GO'],
  ES: ['BA', 'MG', 'RJ'],
  GO: ['BA', 'DF', 'MG', 'MT', 'MS', 'TO'],
  MA: ['PA', 'PI', 'TO'],
  MT: ['AM', 'GO', 'MS', 'PA', 'RO', 'TO'],
  MS: ['GO', 'MT', 'MG', 'PR', 'SP'],
  MG: ['BA', 'ES', 'GO', 'MS', 'RJ', 'SP'],
  PA: ['AP', 'AM', 'MA', 'MT', 'TO'],
  PB: ['CE', 'PE', 'RN'],
  PR: ['MS', 'SC', 'SP'],
  PE: ['AL', 'BA', 'CE', 'PB', 'PI'],
  PI: ['BA', 'CE', 'MA', 'PE', 'TO'],
  RJ: ['ES', 'MG', 'SP'],
  RN: ['CE', 'PB'],
  RS: ['SC'],
  RO: ['AC', 'AM', 'MT'],
  RR: ['AM'],
  SC: ['PR', 'RS'],
  SP: ['MG', 'MS', 'PR', 'RJ'],
  SE: ['AL', 'BA'],
  TO: ['BA', 'GO', 'MA', 'MT', 'PA', 'PI'],
};

function normUf(u: string | null | undefined): string {
  return String(u ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2);
}

export function ufsFazemFronteira(a: string, b: string): boolean {
  const A = normUf(a);
  const B = normUf(b);
  if (!A || !B || A === B) return A === B;
  return (UF_BORDERS[A] ?? []).includes(B);
}

/** BFS: caminho completo A→…→B (inclui extremos). */
export function caminhoUfs(ufInicio: string, ufFim: string): string[] {
  const start = normUf(ufInicio);
  const goal = normUf(ufFim);
  if (!start || !goal) return [];
  if (start === goal) return [start];
  if (!UF_BORDERS[start] || !UF_BORDERS[goal]) return [];

  const prev = new Map<string, string | null>();
  const q: string[] = [start];
  prev.set(start, null);
  while (q.length) {
    const cur = q.shift()!;
    if (cur === goal) break;
    for (const nxt of UF_BORDERS[cur] ?? []) {
      if (prev.has(nxt)) continue;
      prev.set(nxt, cur);
      q.push(nxt);
    }
  }
  if (!prev.has(goal)) return [];
  const path: string[] = [];
  let c: string | null = goal;
  while (c) {
    path.push(c);
    c = prev.get(c) ?? null;
  }
  path.reverse();
  return path;
}

/** UFs intermediárias (sem início/fim) — payload MDF-e percursos. */
export function percursoIntermediario(ufInicio: string, ufFim: string): string[] {
  const path = caminhoUfs(ufInicio, ufFim);
  if (path.length <= 2) return []; // mesma UF ou fronteira direta
  return path.slice(1, -1);
}

/**
 * Valida sequência de UFs (cada par consecutivo faz fronteira).
 * `full` = [UFIni, ...percurso, UFFim].
 */
export function percursoValido(full: string[]): boolean {
  if (full.length < 2) return false;
  for (let i = 0; i < full.length - 1; i++) {
    if (!ufsFazemFronteira(full[i], full[i + 1])) return false;
  }
  return true;
}

/**
 * Resolve UFPer para MDF-e.
 * @param hintUfs UFs ordenadas do WebRouter (pedágios / roteiro), podem incluir início/fim
 */
export function resolveMdfePercursoUfs(
  ufInicio: string,
  ufFim: string,
  hintUfs: string[] = []
): { percurso: string[]; source: 'adjacent' | 'webrouter' | 'bfs'; emptyReason?: string } {
  const ini = normUf(ufInicio);
  const fim = normUf(ufFim);
  if (!ini || !fim) {
    return { percurso: [], source: 'bfs', emptyReason: 'uf_inicio/uf_fim ausente' };
  }
  if (ini === fim || ufsFazemFronteira(ini, fim)) {
    return { percurso: [], source: 'adjacent', emptyReason: 'fronteira_ou_mesma_uf' };
  }

  // Hint WebRouter: limpa, remove extremos, valida caminho completo
  const cleaned = hintUfs.map(normUf).filter((u) => u.length === 2);
  const withoutEnds = cleaned.filter((u, i, arr) => {
    if (u === ini && i === 0) return false;
    if (u === fim && i === arr.length - 1) return false;
    return u !== ini && u !== fim;
  });
  // Dedup consecutive
  const dedup: string[] = [];
  for (const u of withoutEnds) {
    if (dedup[dedup.length - 1] !== u) dedup.push(u);
  }
  const fullHint = [ini, ...dedup, fim];
  if (dedup.length > 0 && percursoValido(fullHint)) {
    return { percurso: dedup, source: 'webrouter' };
  }

  const bfs = percursoIntermediario(ini, fim);
  return {
    percurso: bfs,
    source: 'bfs',
    emptyReason: bfs.length === 0 ? 'sem_caminho_divisas' : undefined,
  };
}
