import { describe, expect, it } from 'vitest';
import { protocolFromMdfeXml } from '../../../supabase/functions/_shared/mdfe-xml-protocol';

const XML = `<mdfeProc versao="3.00"><MDFe>...</MDFe><protMDFe versao="3.00"><infProt Id="MDFe942260043986639">
<tpAmb>1</tpAmb><verAplic>RS20260715163523</verAplic><chMDFe>42261162188748000117580010000000241759548562</chMDFe>
<dhRecbto>2026-11-10T10:24:13-03:00</dhRecbto><nProt>942260043986639</nProt><digVal>x=</digVal><cStat>100</cStat>
<xMotivo>Autorizado o uso do MDF-e</xMotivo></infProt></protMDFe></mdfeProc>`;

describe('protocolFromMdfeXml', () => {
  it('extrai nProt e dhRecbto (data real de autorização) do protMDFe', () => {
    expect(protocolFromMdfeXml(XML)).toEqual({
      nProt: '942260043986639',
      dhRecbto: '2026-11-10T13:24:13.000Z',
    });
  });

  it('ignora dhRecbto de protocolo não autorizado (cStat ≠ 100)', () => {
    const r = protocolFromMdfeXml(XML.replace('<cStat>100</cStat>', '<cStat>204</cStat>'));
    expect(r.dhRecbto).toBeNull();
  });

  it('XML sem protocolo → nulls', () => {
    expect(protocolFromMdfeXml('<MDFe/>')).toEqual({ nProt: null, dhRecbto: null });
  });
});
