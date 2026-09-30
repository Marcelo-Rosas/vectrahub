"""Tokeniza o DOCX oficial MS (Liberação de embarque excepcional) e gera o módulo TS do template.

Uso (raiz do repo):
  python scripts/ms-liberacao/tokenize_docx.py \
    scripts/ms-liberacao/liberacao-excepcional-ms.original.docx \
    supabase/functions/_shared/ms-liberacao-template.ts

Content controls (w:sdt) viram tokens:
  texto     -> {{key}}            (placeholder cinza removido)
  checkbox  -> {{chk:key}} glyph + w14:checked w14:val="{{chkv:key}}"
"Citar:" (Informações adicionais) ganha {{info_adicionais}}.
Chaves espelham MS_TEXT_KEYS / MS_CHECK_GROUPS em supabase/functions/_shared/ms-liberacao-form.ts.
"""
import base64
import io
import re
import sys
import xml.dom.minidom
import zipfile

SRC, DST = sys.argv[1], sys.argv[2]

# Índice do w:sdt (ordem no document.xml) -> chave
TXT = {
    0: 'segurado_nome', 8: 'apolice_numero_1', 9: 'apolice_numero_2', 10: 'lmg', 11: 'sublimite',
    17: 'motivo_esclarecer', 18: 'mercadoria_tipo', 19: 'mercadoria_valor', 20: 'embarcador',
    21: 'destinatario', 22: 'notas_fiscais', 23: 'conhecimento', 24: 'origem', 25: 'destino',
    26: 'mercadoria_usada', 27: 'container', 28: 'percurso_fluvial', 29: 'previsao_inicio',
    37: 'transportadora', 38: 'placa', 49: 'terceiro_viagens_12m', 54: 'rastreador_modelo',
    59: 'escolta_qtd', 60: 'gerenciadora',
}
CHK = {
    1: 'apolice_tn', 2: 'apolice_rctr_vi', 3: 'apolice_rctr_c', 4: 'apolice_rcf_dc',
    5: 'apolice_ti_imp', 6: 'apolice_ti_exp', 7: 'apolice_rcta_c',
    12: 'motivo_limite', 13: 'motivo_excluida', 14: 'motivo_sem_gr', 15: 'motivo_gr_desacordo',
    16: 'motivo_rastreador',
    30: 'modal_rodoviario', 31: 'modal_aereo', 32: 'modal_maritimo', 33: 'modal_rodo_aereo',
    34: 'modal_rodo_fluvial', 35: 'modal_cabotagem', 36: 'modal_ferroviario',
    39: 'veiculo_frotista', 40: 'veiculo_agregado', 41: 'veiculo_terceiro',
    42: 'tipo_caminhao', 43: 'tipo_utilitario', 44: 'tipo_passeio', 45: 'tipo_moto',
    46: 'motorista_frotista', 47: 'motorista_agregado', 48: 'motorista_terceiro',
    50: 'rastreio_gprs', 51: 'rastreio_satelital', 52: 'rastreio_hibrido', 53: 'rastreio_rf',
    55: 'tec2_localizador', 56: 'tec2_isca', 57: 'escolta_sim', 58: 'escolta_nao',
}

with zipfile.ZipFile(SRC) as z:
    files = {n: z.read(n) for n in z.namelist()}

x = files['word/document.xml'].decode('utf8')
sdts = list(re.finditer(r'<w:sdt>(.*?)</w:sdt>', x, re.S))
assert len(sdts) == 61, len(sdts)
assert len(TXT) + len(CHK) == 61

out, last = [], 0
for i, m in enumerate(sdts):
    body = m.group(1)
    head, inner, tail = re.match(r'(.*<w:sdtContent>)(.*)(</w:sdtContent>.*)', body, re.S).groups()
    if 'w14:checkbox' in body:
        key = CHK[i]
        assert inner.count('☐') == 1, (i, inner)
        inner = inner.replace('☐', '{{chk:%s}}' % key)
        head, n = re.subn(r'<w14:checked w14:val="0"/>',
                          '<w14:checked w14:val="{{chkv:%s}}"/>' % key, head)
        assert n == 1, i
    else:
        key = TXT[i]
        head = head.replace('<w:showingPlcHdr/>', '')
        rpr = re.search(r'<w:rPr>(.*?)</w:rPr>', inner, re.S)
        rpr_xml = re.sub(r'<w:rStyle w:val="[^"]*"/>', '', rpr.group(1)) if rpr else ''
        inner = '<w:r><w:rPr>%s</w:rPr><w:t xml:space="preserve">{{%s}}</w:t></w:r>' % (rpr_xml, key)
    out.append(x[last:m.start()])
    out.append('<w:sdt>' + head + inner + tail + '</w:sdt>')
    last = m.end()
out.append(x[last:])
x = ''.join(out)

assert x.count('Citar:') == 1
x = re.sub(
    r'(<w:t(?: [^>]*)?>)([^<]*Citar:)(\s*)(</w:t>)',
    lambda mm: '%s%s {{info_adicionais}}%s' % (
        mm.group(1).replace('<w:t>', '<w:t xml:space="preserve">'), mm.group(2), mm.group(4)),
    x,
)
assert '{{info_adicionais}}' in x
assert 'Clique aqui' not in x

xml.dom.minidom.parseString(x.encode('utf8'))  # bem-formado
files['word/document.xml'] = x.encode('utf8')

buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
    for n, data in files.items():
        z.writestr(n, data)

tokens = sorted(set(re.findall(r'\{\{([^}]+)\}\}', x)))
b64 = base64.b64encode(buf.getvalue()).decode('ascii')
chunks = [b64[i:i + 100] for i in range(0, len(b64), 100)]

with open(DST, 'w', encoding='utf8', newline='\n') as f:
    f.write('// GERADO por scripts/ms-liberacao/tokenize_docx.py — não editar à mão.\n')
    f.write('// Formulário oficial MS Seguros "Liberação de embarque excepcional" com tokens.\n\n')
    f.write('export const MS_TEMPLATE_TOKENS: readonly string[] = [\n')
    for t in tokens:
        f.write("  '%s',\n" % t)
    f.write('];\n\n')
    f.write('export const MS_LIBERACAO_TEMPLATE_DOCX_B64 =\n')
    for c in chunks[:-1]:
        f.write("  '%s' +\n" % c)
    f.write("  '%s';\n" % chunks[-1])

print(len(tokens), 'tokens ->', DST, len(buf.getvalue()), 'bytes')
