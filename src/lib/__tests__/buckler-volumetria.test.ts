import { describe, expect, it } from 'vitest';
import { parseVolumetriaAccessoryLine, parseVolumetriaLines } from '@/lib/buckler-volumetria';

describe('buckler-volumetria', () => {
  const nitroSample = `CÓDIGO DESCRIÇÃO QTD PESO P/ EMB. DIMENSÃO QTDE P/ CX CBM VOLUME ENV. CBM ENVI PESO BRUTO TOTAL
NRD-T02-10 Halter Titanium Gold 10KG 4 10 0,40*0,25*0,25 1 0,025 4 0,1 40
NCT01R-10 Barra Montada Titanium Reta 10 kg 2 10 1,10*0,25*0,25 1 0,06875 2 0,1375 20`;

  it('parses NRD/NCT lines from NITROGYM 708 volumetria', () => {
    const lines = parseVolumetriaLines(nitroSample);
    expect(lines).toHaveLength(2);
    const halter = parseVolumetriaAccessoryLine(lines[0]!, 'nitro.pdf');
    expect(halter?.sku).toBe('NRD-T02-10');
    expect(halter?.grossKg).toBe(40);
    expect(halter?.lengthMm).toBe(400);
    const barra = parseVolumetriaAccessoryLine(lines[1]!, 'nitro.pdf');
    expect(barra?.sku).toBe('NCT01R-10');
    expect(barra?.grossKg).toBe(20);
  });

  it('still parses OK* volumetria', () => {
    const line = 'OK2030-1,25 AniIha Uretano 1.25 Kg 6 5 0,20*0,30*0,30 4 0,018 2 0,027 7,5';
    const acc = parseVolumetriaAccessoryLine(line, 'labs.pdf');
    expect(acc?.sku).toBe('OK2030-1,25');
    expect(acc?.grossKg).toBe(7.5);
  });
});
