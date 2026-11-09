-- Feira: tenant Rotha Fitness — kits halter/dumbbell (Produtos AB6047 / AB6051 homolog).

INSERT INTO feira.companies (
  slug, name, origin_city, origin_uf, origin_label, origin_cep,
  email_domains, event_flag, toll_fallback_percent
)
VALUES (
  'rotha',
  'Rotha Fitness',
  'Taboão da Serra',
  'SP',
  'Taboão da Serra - SP',
  '06765350',
  ARRAY['rothafitness.com'],
  'ROTHA',
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

-- Kits = 1 unidade logística (pares agregados). Peso/m³ da planilha Produtos (10).xlsx homolog.
INSERT INTO feira.products (
  company_id, sku, name, boxes_total, box_types_count,
  weight_kg_per_unit, volume_m3_per_unit
)
SELECT
  c.id,
  v.sku,
  v.name,
  1,
  1,
  v.weight_kg,
  v.volume_m3
FROM feira.companies c
CROSS JOIN (
  VALUES
    (
      'ROTHA-KIT-HALTER-1-10',
      'Kit Halter Sextavado Inox 1–10 kg (10 pares)',
      110.0::numeric,
      0.200::numeric
    ),
    (
      'ROTHA-KIT-DB-12-25',
      'Kit Dumbbell Six 12–25 kg (6 pares, passo 2,5 kg)',
      225.0::numeric,
      0.220::numeric
    ),
    (
      'ROTHA-KIT-DB-12-35',
      'Kit Dumbbell Six 12–35 kg (10 pares, passo 2,5 kg)',
      475.0::numeric,
      0.460::numeric
    ),
    (
      'ROTHA-KIT-DB-12-40',
      'Kit Dumbbell Six 12–40 kg (12 pares, passo 2,5 kg)',
      630.0::numeric,
      0.520::numeric
    ),
    (
      'ROTHA-KIT-DB-42-50',
      'Kit Dumbbell Six 42–50 kg (4 pares, passo 2,5 kg)',
      370.0::numeric,
      0.160::numeric
    )
) AS v(sku, name, weight_kg, volume_m3)
WHERE c.slug = 'rotha'
ON CONFLICT (company_id, sku) DO UPDATE SET
  name = EXCLUDED.name,
  weight_kg_per_unit = EXCLUDED.weight_kg_per_unit,
  volume_m3_per_unit = EXCLUDED.volume_m3_per_unit,
  boxes_total = EXCLUDED.boxes_total,
  box_types_count = EXCLUDED.box_types_count;

INSERT INTO feira.product_boxes (
  product_id, box_type, length_mm, width_mm, height_mm,
  boxes_per_unit, group_weight_kg, volume_m3
)
SELECT
  p.id,
  'KIT',
  1200,
  800,
  800,
  1,
  p.weight_kg_per_unit,
  p.volume_m3_per_unit
FROM feira.products p
JOIN feira.companies c ON c.id = p.company_id
WHERE c.slug = 'rotha'
  AND p.sku LIKE 'ROTHA-KIT-%'
ON CONFLICT (product_id, box_type) DO UPDATE SET
  group_weight_kg = EXCLUDED.group_weight_kg,
  volume_m3 = EXCLUDED.volume_m3;

NOTIFY pgrst, 'reload schema';
