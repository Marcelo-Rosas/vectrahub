import { describe, expect, it } from 'vitest';
import {
  fitImageContain,
  generatePodPdf,
  POD_IMAGE_MAX_HEIGHT_MM,
  planPodImage,
  podDeliveryLabel,
  withSingleShipperDocs,
  type PodPdfPayload,
} from '@/lib/generatePodPdf';

const TINY_JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWusLDY2Nzg5OkJERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaWm5hcXGRkaKio6SlpqeoqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oACAEBAAA/AN//2Q==';

function basePayload(over: Partial<PodPdfPayload> = {}): PodPdfPayload {
  return {
    os_number: 'OS-2026-08-0005',
    client_name: 'ACADEMIA DUMBBELLS LTDA',
    origin: 'Itajaí - SC',
    destination: 'Fortaleza - CE',
    shipper_name: 'KONNEN FITNESS',
    shipper_2_name: 'BUCKLER FIT',
    driver_name: 'Motorista Teste',
    vehicle_plate: 'EFO7869',
    cargo_value_cents: 34090290,
    value_cents: 2600000,
    pickup_date: '2026-08-10',
    eta: '2026-08-18',
    pod_image_data_url: TINY_JPEG,
    pod_uploaded_at: '2026-08-18T12:00:00.000Z',
    logoBase64Override: null,
    ...over,
  };
}

async function pdfText(blob: Blob): Promise<string> {
  const buf = Buffer.from(await blob.arrayBuffer());
  return buf.toString('latin1');
}

describe('fitImageContain', () => {
  it('paisagem 1600×355 (canhoto OS-0012) cabe sem esticar', () => {
    const fitted = fitImageContain(1600, 355, 186, POD_IMAGE_MAX_HEIGHT_MM);
    expect(fitted.width).toBeCloseTo(186, 5);
    expect(fitted.height).toBeCloseTo(186 * (355 / 1600), 5);
    expect(fitted.height).toBeLessThan(POD_IMAGE_MAX_HEIGHT_MM);
    expect(fitted.width / fitted.height).toBeCloseTo(1600 / 355, 5);
  });

  it('retrato alto respeita o teto de 62 mm (não toma a página)', () => {
    const fitted = fitImageContain(355, 1600, 186, POD_IMAGE_MAX_HEIGHT_MM);
    expect(fitted.height).toBeCloseTo(POD_IMAGE_MAX_HEIGHT_MM, 5);
    expect(fitted.height).toBeLessThanOrEqual(62);
    expect(fitted.width).toBeCloseTo(POD_IMAGE_MAX_HEIGHT_MM * (355 / 1600), 5);
    expect(fitted.width).toBeLessThan(186);
  });

  it('quadrado usa o lado menor da caixa', () => {
    const fitted = fitImageContain(1000, 1000, 186, POD_IMAGE_MAX_HEIGHT_MM);
    expect(fitted.width).toBeCloseTo(POD_IMAGE_MAX_HEIGHT_MM, 5);
    expect(fitted.height).toBeCloseTo(POD_IMAGE_MAX_HEIGHT_MM, 5);
  });

  it('dimensão inválida não estoura a caixa', () => {
    const fitted = fitImageContain(0, 0, 186, POD_IMAGE_MAX_HEIGHT_MM);
    expect(fitted.width).toBeLessThanOrEqual(186);
    expect(fitted.height).toBeLessThanOrEqual(POD_IMAGE_MAX_HEIGHT_MM);
  });
});

describe('generatePodPdf', () => {
  it('VG com dois embarcadores gera dois PDFs isolados', async () => {
    const files = await generatePodPdf(
      basePayload({
        trip_number: 'VG-2026-08-0002',
        shippers: [
          {
            name: 'KONNEN FITNESS',
            origin: 'Itajaí - SC',
            nfe_numbers: ['10348'],
            cte_numbers: ['19'],
          },
          {
            name: 'BUCKLER FIT',
            origin: 'São Bernardo do Campo - SP',
            nfe_numbers: ['348'],
            cte_numbers: ['20'],
          },
        ],
      })
    );

    expect(files.map((f) => f.fileName)).toEqual([
      'POD-VG-2026-08-0002-KONNEN_FITNESS.pdf',
      'POD-VG-2026-08-0002-BUCKLER_FIT.pdf',
    ]);

    const konnen = await pdfText(files[0]!.blob);
    const buckler = await pdfText(files[1]!.blob);

    expect(konnen).toContain('(KONNEN FITNESS)');
    expect(konnen).toContain('(10348)');
    expect(konnen).toContain('Itaja');
    expect(konnen).not.toContain('(BUCKLER FIT)');
    expect(konnen).not.toContain('(348)');

    expect(buckler).toContain('(BUCKLER FIT)');
    expect(buckler).toContain('(348)');
    expect(buckler).toContain('Bernardo');
    expect(buckler).not.toContain('(KONNEN FITNESS)');
    expect(buckler).not.toContain('(10348)');
  });

  it('OS fora de VG gera um único PDF (mesmo com embarcador 2)', async () => {
    const files = await generatePodPdf(
      basePayload({
        os_number: 'OS-2026-08-0009',
        trip_number: null,
      })
    );

    expect(files).toHaveLength(1);
    expect(files[0]!.fileName).toBe('comprovante-entrega-OS-2026-08-0009.pdf');
    const text = await pdfText(files[0]!.blob);
    expect(text).toContain('KONNEN FITNESS');
    expect(text).toContain('BUCKLER FIT');
  });

  it('VG com um embarcador gera um PDF no nome legado', async () => {
    const files = await generatePodPdf(
      basePayload({
        os_number: 'OS-2026-08-0004',
        trip_number: 'VG-2026-08-0002',
        shipper_name: 'ROTHA FITNESS LTDA',
        shipper_2_name: null,
        client_name: 'NEW MAX PACAJUS ACADEMIAS LTDA',
        origin: 'Taboão da Serra - SP',
        destination: 'Pacajus - CE',
        shippers: [
          {
            name: 'ROTHA FITNESS LTDA',
            origin: 'Taboão da Serra - SP',
            nfe_numbers: ['4660'],
            cte_numbers: ['17'],
          },
        ],
      })
    );

    expect(files).toHaveLength(1);
    expect(files[0]!.fileName).toBe('comprovante-entrega-OS-2026-08-0004.pdf');
    const text = await pdfText(files[0]!.blob);
    expect(text).toContain('ROTHA FITNESS LTDA');
    expect(text).not.toContain('KONNEN');
    expect(text).not.toContain('BUCKLER');
  });
});

describe('planPodImage — página única', () => {
  it('canhoto em faixa (paisagem) usa a largura útil toda', () => {
    const p = planPodImage(1600, 355, 140);
    expect(p.width).toBeCloseTo(186, 5);
    expect(p.height).toBeLessThan(140);
  });

  it('DANFE em retrato (900×1600) usa toda a altura livre, sem teto de 62mm', () => {
    const p = planPodImage(900, 1600, 140);
    expect(p.height).toBeCloseTo(140, 5);
    expect(p.height).toBeGreaterThan(POD_IMAGE_MAX_HEIGHT_MM);
    expect(p.width).toBeCloseTo(140 * (900 / 1600), 5);
  });
});

describe('generatePodPdf — página única', () => {
  it('OS com foto do POD gera PDF de 1 página', async () => {
    const [file] = await generatePodPdf(basePayload({ shipper_2_name: null }));
    const text = await pdfText(file!.blob);
    expect(text.match(/\/Type\s*\/Page[^s]/g)?.length).toBe(1);
  });
});

describe('podDeliveryLabel', () => {
  it('usa o registro do canhoto (horário de Brasília), não a previsão (eta)', () => {
    const label = podDeliveryLabel({
      eta: null,
      pod_uploaded_at: '2026-11-10T18:58:58.814Z',
    });
    expect(label).toBe('10/11/2026 15:58 (registro do canhoto)');
  });

  it('sem registro → —', () => {
    expect(podDeliveryLabel({ eta: '2026-11-12T06:47:00Z', pod_uploaded_at: '' })).toBe('—');
  });
});

describe('withSingleShipperDocs', () => {
  it('OS com 1 embarcador herda CT-e/NF-e da fatia', () => {
    const out = withSingleShipperDocs(basePayload({ shipper_2_name: null }), [
      { name: 'SIMIONI', origin: 'Paulo Lopes - SC', nfe_numbers: ['1824'], cte_numbers: ['50'] },
    ]);
    expect(out.nfe_number).toBe('1824');
    expect(out.cte_number).toBe('50');
  });

  it('não sobrescreve número já informado', () => {
    const out = withSingleShipperDocs(basePayload({ cte_number: '99' }), [
      { name: 'X', origin: null, nfe_numbers: ['1'], cte_numbers: ['50'] },
    ]);
    expect(out.cte_number).toBe('99');
  });
});
