-- Feira: tenant PlayFit Pisos + catálogo mínimo PBR-PALLET (rota /feira).

INSERT INTO feira.companies (
  slug, name, origin_city, origin_uf, origin_label, origin_cep,
  email_domains, event_flag, toll_fallback_percent
)
VALUES (
  'playfit',
  'PlayFit Pisos',
  'Itajaí',
  'SC',
  'Itajaí - SC',
  '88317100',
  ARRAY['playfitpisos.com.br'],
  'PLAYFIT',
  12
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  origin_city = EXCLUDED.origin_city,
  origin_uf = EXCLUDED.origin_uf,
  origin_label = EXCLUDED.origin_label,
  origin_cep = EXCLUDED.origin_cep,
  email_domains = EXCLUDED.email_domains,
  event_flag = EXCLUDED.event_flag,
  toll_fallback_percent = EXCLUDED.toll_fallback_percent;

INSERT INTO feira.products (
  company_id, sku, name, boxes_total, box_types_count,
  weight_kg_per_unit, volume_m3_per_unit
)
SELECT
  c.id,
  'PBR-PALLET',
  'Pallet PBR',
  1,
  4,
  0,
  1.4
FROM feira.companies c
WHERE c.slug = 'playfit'
ON CONFLICT (company_id, sku) DO UPDATE SET
  name = EXCLUDED.name,
  boxes_total = EXCLUDED.boxes_total,
  box_types_count = EXCLUDED.box_types_count,
  volume_m3_per_unit = EXCLUDED.volume_m3_per_unit;

INSERT INTO feira.product_boxes (
  product_id, box_type, length_mm, width_mm, height_mm,
  boxes_per_unit, group_weight_kg, volume_m3
)
SELECT p.id, v.box_type, 1200, 1000, 150, 1, 0, v.vol
FROM feira.products p
JOIN feira.companies c ON c.id = p.company_id
CROSS JOIN (VALUES ('50', 1.2), ('60', 1.4), ('70', 1.6), ('80', 1.8)) AS v(box_type, vol)
WHERE c.slug = 'playfit' AND p.sku = 'PBR-PALLET'
ON CONFLICT (product_id, box_type) DO UPDATE SET volume_m3 = EXCLUDED.volume_m3;

NOTIFY pgrst, 'reload schema';
