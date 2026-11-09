import { describe, expect, it } from 'vitest';
import {
  assignCanhotosToShippers,
  buildPodShipperSlices,
  isVgPodReference,
  parsePodAdditionalShippers,
  parsePodDocumentMeta,
  partyNamesMatch,
  podPdfCode,
  podPdfFileName,
  shouldSplitPodByShipper,
  shipperOwnsCnpj,
  singlePodPdfFileName,
} from '@/lib/pod-pdf-shippers';

/** Chaves reais da OS-2026-08-0005 / COT-2026-08-0008 (VG-2026-08-0002). */
const KONNEN_NFE = '42260709447411000102550010000103481599905245';
const BUCKLER_NFE = '11260850982431000411550010000003481896633402';

describe('isVgPodReference', () => {
  it('reconhece viagem VG-YYYY-MM-NNNN', () => {
    expect(isVgPodReference('VG-2026-08-0002')).toBe(true);
    expect(isVgPodReference('vg-2026-08-0002')).toBe(true);
  });

  it('rejeita OS e COT', () => {
    expect(isVgPodReference('OS-2026-08-0005')).toBe(false);
    expect(isVgPodReference('COT-2026-08-0008')).toBe(false);
    expect(isVgPodReference(null, 'OS-2026-08-0004')).toBe(false);
  });
});

describe('shouldSplitPodByShipper', () => {
  const two = [
    { name: 'KONNEN FITNESS', origin: 'Itajaí - SC', nfe_numbers: [], cte_numbers: [] },
    { name: 'BUCKLER FIT', origin: 'São Bernardo do Campo - SP', nfe_numbers: [], cte_numbers: [] },
  ];

  it('VG com 2 embarcadores → split', () => {
    expect(
      shouldSplitPodByShipper({
        os_number: 'OS-2026-08-0005',
        trip_number: 'VG-2026-08-0002',
        shippers: two,
      })
    ).toBe(true);
  });

  it('OS fora de VG com 2 embarcadores → 1 PDF', () => {
    expect(
      shouldSplitPodByShipper({
        os_number: 'OS-2026-08-0009',
        trip_number: null,
        shippers: two,
      })
    ).toBe(false);
  });

  it('VG com 1 embarcador → 1 PDF', () => {
    expect(
      shouldSplitPodByShipper({
        os_number: 'OS-2026-08-0004',
        trip_number: 'VG-2026-08-0002',
        shippers: [two[0]!],
      })
    ).toBe(false);
  });
});

describe('podPdfFileName', () => {
  it('identifica embarcador no arquivo VG', () => {
    expect(podPdfFileName('VG-2026-08-0002', 'KONNEN FITNESS')).toBe(
      'POD-VG-2026-08-0002-KONNEN_FITNESS.pdf'
    );
    expect(podPdfFileName('VG-2026-08-0002', 'BUCKLER FIT')).toBe(
      'POD-VG-2026-08-0002-BUCKLER_FIT.pdf'
    );
  });

  it('OS avulsa mantém o nome legado', () => {
    expect(singlePodPdfFileName('OS-2026-08-0004')).toBe('comprovante-entrega-OS-2026-08-0004.pdf');
  });

  it('usa o número da VG no código do arquivo', () => {
    expect(podPdfCode('OS-2026-08-0005', 'VG-2026-08-0002')).toBe('VG-2026-08-0002');
    expect(podPdfCode('OS-2026-08-0004', null)).toBe('OS-2026-08-0004');
  });
});

describe('buildPodShipperSlices', () => {
  it('separa NF e CT-e da OS-0005 por embarcador (Konnen vs Buckler)', () => {
    const slices = buildPodShipperSlices({
      primaryName: 'KONNEN FITNESS',
      primaryOrigin: 'Itajaí - SC',
      primaryCnpj: '09447411000102',
      additional: [
        {
          name: 'BUCKLER FIT',
          origin: 'São Bernardo do Campo - SP',
          cnpj: '50982431000330',
        },
      ],
      nfes: [{ key: KONNEN_NFE }, { key: BUCKLER_NFE }],
      ctes: [
        {
          numero: 19,
          status: 'authorized',
          remetente_name: 'KONNEN FITNESS',
          remetente_cnpj: '09447411000102',
        },
        {
          numero: 20,
          status: 'authorized',
          remetente_name: 'BUCKLER FIT',
          remetente_cnpj: '50982431000330',
        },
        {
          numero: 16,
          status: 'cancelled',
          remetente_name: 'BUCKLER FIT',
          remetente_cnpj: '50982431000330',
        },
      ],
    });

    expect(slices).toHaveLength(2);
    const konnen = slices.find((s) => s.name === 'KONNEN FITNESS');
    const buckler = slices.find((s) => s.name === 'BUCKLER FIT');
    expect(konnen?.origin).toBe('Itajaí - SC');
    expect(konnen?.nfe_numbers).toEqual(['10348']);
    expect(konnen?.cte_numbers).toEqual(['19']);
    expect(buckler?.origin).toBe('São Bernardo do Campo - SP');
    expect(buckler?.nfe_numbers).toEqual(['348']);
    expect(buckler?.cte_numbers).toEqual(['20']);
  });

  it('casa filiais pelo CNPJ raiz (Buckler 0003 vs NF 0004)', () => {
    expect(shipperOwnsCnpj('50982431000330', '50982431000411')).toBe(true);
    expect(partyNamesMatch('KONNEN FITNESS', 'Konnen Fitness')).toBe(true);
  });
});

describe('assignCanhotosToShippers', () => {
  it('liga cada canhoto ao embarcador por shipper_id', () => {
    const slices = assignCanhotosToShippers(
      [
        {
          name: 'KONNEN FITNESS',
          origin: 'Itajaí - SC',
          nfe_numbers: [],
          cte_numbers: [],
          shipper_id: 'k1',
        },
        {
          name: 'BUCKLER FIT',
          origin: 'SBC - SP',
          nfe_numbers: [],
          cte_numbers: [],
          shipper_id: 'b1',
        },
      ],
      [
        { dataUrl: 'data:buckler', shipper_id: 'b1', shipper_name: 'BUCKLER FIT' },
        { dataUrl: 'data:konnen', shipper_id: 'k1', shipper_name: 'KONNEN FITNESS' },
      ]
    );
    expect(slices[0]?.pod_image_data_url).toBe('data:konnen');
    expect(slices[1]?.pod_image_data_url).toBe('data:buckler');
  });

  it('sem metadado, usa a ordem de upload (1º principal, 2º adicional)', () => {
    const slices = assignCanhotosToShippers(
      [
        { name: 'KONNEN FITNESS', origin: null, nfe_numbers: [], cte_numbers: [] },
        { name: 'BUCKLER FIT', origin: null, nfe_numbers: [], cte_numbers: [] },
      ],
      [
        { dataUrl: 'data:a', file_name: 'canhoto-1.jpg' },
        { dataUrl: 'data:b', file_name: 'canhoto-2.jpg' },
      ]
    );
    expect(slices[0]?.pod_image_data_url).toBe('data:a');
    expect(slices[1]?.pod_image_data_url).toBe('data:b');
  });

  it('lê shipper_name do validation_metadata', () => {
    expect(parsePodDocumentMeta({ shipper_id: 'x', shipper_name: 'BUCKLER FIT' })).toEqual({
      shipper_id: 'x',
      shipper_name: 'BUCKLER FIT',
    });
  });
});

describe('parsePodAdditionalShippers', () => {
  it('lê city_uf como origem', () => {
    expect(
      parsePodAdditionalShippers([
        {
          name: 'BUCKLER FIT',
          city_uf: 'São Bernardo do Campo - SP',
          shipper_id: '253aad1b-b941-4db9-a7ed-05c43ac29352',
        },
      ])
    ).toEqual([
      {
        name: 'BUCKLER FIT',
        shipper_id: '253aad1b-b941-4db9-a7ed-05c43ac29352',
        origin: 'São Bernardo do Campo - SP',
        cnpj: null,
        weight_kg: null,
      },
    ]);
  });
});
