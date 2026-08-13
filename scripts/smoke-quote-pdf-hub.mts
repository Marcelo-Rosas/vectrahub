/**
 * Smoke: PDF cotação — cliente/embarcador 5 campos + roteiro UPPER + total km.
 * Uso: npx tsx scripts/smoke-quote-pdf-hub.mts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateQuotePdf } from '../src/lib/generateQuotePdf.ts';

const quote = {
  id: 'smoke',
  quote_code: 'COT-2026-08-0001',
  client_name: 'INOVE ACADEMIA LTDA',
  client_email_fallback: 'contato@inoveacademia.com.br',
  client: {
    name: 'INOVE ACADEMIA LTDA',
    cnpj: '12345678000199',
    contact_name: 'Maria Silva',
    phone: '91 99999-0000',
    email: 'contato@inoveacademia.com.br',
    city: 'Paragominas',
    state: 'PA',
    address: 'Av. Principal',
    address_number: '100',
    address_neighborhood: 'Centro',
    zip_code: '68628520',
  },
  origin: 'Fortaleza - CE',
  destination: 'Paragominas - PA',
  origin_cep: '60743760',
  destination_cep: '68628520',
  value: 9800,
  cargo_type: 'EQUIPAMENTOS',
  weight: 1000,
  volume: null,
  km_distance: 1515,
  estimated_loading_date: null,
  notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  freight_modality: 'lotacao' as const,
  freight_type: 'CIF',
  shipper_name_fallback: 'BOOST EQUIPAMENT',
  shipper_email_fallback: 'adm@boostequipment.com.br',
  shipper: {
    name: 'BOOST EQUIPAMENT',
    cnpj: '61602891000140',
    contact_name: 'Everton',
    phone: '85 9181-4983',
    email: 'adm@boostequipment.com.br',
    city: 'FORTALEZA',
    state: 'CE',
    address: 'HEROIS DO ACRE',
    address_number: '445',
    address_neighborhood: 'PASSARE',
    zip_code: '60743760',
  },
  route_stops: [
    {
      sequence: 0,
      stop_type: 'stop',
      name: 'Academia Norte Fitness',
      city_uf: 'Teresina - PI',
      cep: '64000000',
      planned_km_from_prev: 620,
    },
    {
      sequence: 1,
      stop_type: 'stop',
      name: 'CD Inove Maranhão',
      city_uf: 'São Luís - MA',
      cep: '65000000',
      planned_km_from_prev: 450,
    },
  ],
};

const { blob, fileName } = await generateQuotePdf({
  quote,
  mode: 'detailed',
});

const buf = Buffer.from(await blob.arrayBuffer());
const out = join('docs', 'homolog', fileName);
writeFileSync(out, buf);

const asLatin = buf.toString('latin1');
const checks = {
  clientLabel: /CLIENTE/.test(asLatin),
  clientName: /INOVE ACADEMIA LTDA/.test(asLatin),
  clientEmailUpper: /CONTATO@INOVEACADEMIA\.COM\.BR/.test(asLatin),
  shipper: /BOOST EQUIPAMENT/.test(asLatin),
  noSocioAdm: !/S.CIO-ADM|SÓCIO-ADM/.test(asLatin),
  noAtividade: !/ATIVIDADE/.test(asLatin),
  stopUpper: /ACADEMIA NORTE FITNESS/.test(asLatin),
  totalKm: /TOTAL KM/.test(asLatin) && /1\.515\s*KM|1515/.test(asLatin),
  captionUpper: /ROTEIRO COM 2 PARADA/.test(asLatin),
  hasJpegStream: buf.includes(Buffer.from([0xff, 0xd8])),
  fileName,
  bytes: buf.length,
  out,
};

console.log(JSON.stringify(checks, null, 2));
const failed = Object.entries(checks).filter(([k, v]) => typeof v === 'boolean' && v === false);
if (failed.length) {
  console.error('FAILED', failed.map(([k]) => k));
  process.exit(1);
}
