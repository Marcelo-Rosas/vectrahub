/**
 * Spike: parse ANTT Dados Abertos transportadores_rntrc CSV
 * Can we resolve TAC-equiparado (ETC ≤3) by RNTRC?
 */
const fs = require('fs');
const readline = require('readline');

const path =
  process.argv[2] ||
  'c:/Users/marce/vectra-hub/docs/ANTT/spike-dados-abertos/transportadores_rntrc_06_2026.csv';

function splitCsv(line) {
  // semicolon, optional double quotes
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === ';' && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

async function main() {
  const rl = readline.createInterface({
    input: fs.createReadStream(path, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  });

  let cols = null;
  let rows = 0;
  const counts = { Sim: 0, Nao: 0, otherEq: 0, ETC: 0, TAC: 0, CTC: 0, ATIVO: 0 };
  const vectraHits = [];
  const samplesEquip = [];
  const byRntrc = new Map(); // optional probe

  for await (const line of rl) {
    if (!cols) {
      cols = splitCsv(line).map((h) => h.trim().toLowerCase());
      console.log('columns:', cols.join(' | '));
      continue;
    }
    rows++;
    const f = splitCsv(line);
    const get = (name) => {
      const i = cols.indexOf(name);
      return i >= 0 ? (f[i] || '').trim() : '';
    };

    const rntrc = get('numero_rntrc').replace(/\D/g, '');
    const cat = get('categoria_transportador');
    const eq = get('equiparado');
    const sit = get('situacao_rntrc');
    const cnpj = get('cpfcnpjtransportador').replace(/\D/g, '');
    const nome = get('nome_transportador');

    if (sit.toUpperCase() === 'ATIVO') counts.ATIVO++;
    if (cat === 'ETC') counts.ETC++;
    else if (cat === 'TAC') counts.TAC++;
    else if (cat === 'CTC') counts.CTC++;

    const eqNorm = eq.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    if (eqNorm === 'sim') counts.Sim++;
    else if (eqNorm === 'nao') counts.Nao++;
    else counts.otherEq++;

    if (rntrc === '059734055' || cnpj.includes('62188748') || /vectra/i.test(nome)) {
      vectraHits.push({ nome, rntrc, cnpj, cat, eq, sit });
    }

    if (eqNorm === 'sim' && cat === 'ETC' && samplesEquip.length < 3) {
      samplesEquip.push({ nome: nome.slice(0, 60), rntrc, cnpj, cat, eq, sit });
    }

    // index only if looking up later — skip storing all (memory)
    if (rntrc === '050085788' || rntrc === '055515644') {
      byRntrc.set(rntrc, { nome, cat, eq, sit, cnpj });
    }
  }

  console.log('\nrows:', rows);
  console.log('counts:', counts);
  console.log('\nvectraHits:', vectraHits);
  console.log('\nsamples ETC equiparado=Sim:', samplesEquip);
  console.log('\nprobe rows from header sample:', Object.fromEntries(byRntrc));

  // Verdict
  console.log('\n=== VERDICT ===');
  console.log(
    'transportadores CSV HAS numero_rntrc + equiparado (SIM=ETC ate 3 veiculos automotores).'
  );
  console.log(
    'veiculos CSV is AGGREGATE only (categoria x UF x ano) — CANNOT count tracao per RNTRC.'
  );
  console.log(
    'Preferred path: lookup equiparado by RNTRC/CNPJ from transportadores dump (monthly), not count plates.'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
