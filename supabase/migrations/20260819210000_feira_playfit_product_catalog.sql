-- PlayFit: catálogo por linha (espessura, geometria, peso/placa, cores, montagem PBR).

ALTER TABLE feira.products
  ADD COLUMN IF NOT EXISTS line_code TEXT,
  ADD COLUMN IF NOT EXISTS typical_use TEXT,
  ADD COLUMN IF NOT EXISTS geometry_label TEXT,
  ADD COLUMN IF NOT EXISTS plate_length_mm INTEGER,
  ADD COLUMN IF NOT EXISTS plate_width_mm INTEGER,
  ADD COLUMN IF NOT EXISTS plate_thickness_mm INTEGER,
  ADD COLUMN IF NOT EXISTS m2_per_plate NUMERIC(8, 4),
  ADD COLUMN IF NOT EXISTS weight_kg_per_plate NUMERIC(12, 3),
  ADD COLUMN IF NOT EXISTS colors JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE feira.product_boxes
  ADD COLUMN IF NOT EXISTS plates_per_pallet INTEGER,
  ADD COLUMN IF NOT EXISTS stack_height_mm INTEGER,
  ADD COLUMN IF NOT EXISTS pbr_base_height_mm INTEGER NOT NULL DEFAULT 150;

-- Remove SKU genérico PBR-PALLET (substituído por linhas).
DELETE FROM feira.product_boxes b
USING feira.products p, feira.companies c
WHERE b.product_id = p.id
  AND p.company_id = c.id
  AND c.slug = 'playfit'
  AND p.sku = 'PBR-PALLET';

DELETE FROM feira.products p
USING feira.companies c
WHERE p.company_id = c.id
  AND c.slug = 'playfit'
  AND p.sku = 'PBR-PALLET';

-- Linhas PlayFit (homolog — validar com fabricante).
INSERT INTO feira.products (
  company_id, sku, name, boxes_total, box_types_count,
  weight_kg_per_unit, volume_m3_per_unit,
  line_code, typical_use, geometry_label,
  plate_length_mm, plate_width_mm, plate_thickness_mm,
  m2_per_plate, weight_kg_per_plate, colors
)
SELECT
  c.id,
  v.sku,
  v.name,
  1,
  v.montage_count,
  v.weight_plate,
  v.vol_default,
  v.line_code,
  v.typical_use,
  v.geometry,
  v.len_mm,
  v.wid_mm,
  v.thk_mm,
  v.m2_plate,
  v.weight_plate,
  v.colors::jsonb
FROM feira.companies c
CROSS JOIN (
  VALUES
    (
      'PLAYFIT-13',
      'PlayFit 13 mm',
      '13',
      'Playground interno/externo — linha econômica',
      '0,5 × 0,5 m',
      500, 500, 13,
      0.25::numeric,
      3.5::numeric,
      1.716::numeric,
      '[{"id":"verde-musgo","label":"Verde musgo","hex":"#4A7C59"},{"id":"terracota","label":"Terracota","hex":"#C65D3B"},{"id":"preta","label":"Preta","hex":"#2D2D2D"},{"id":"flocos","label":"Flocos","hex":"#8B7355"}]'::text,
      4
    ),
    (
      'PLAYFIT-16',
      'PlayFit 16 mm',
      '16',
      'Playground UV — placa 1×1 m',
      '1 × 1 m',
      1000, 1000, 16,
      1.0::numeric,
      14.0::numeric,
      1.716::numeric,
      '[{"id":"verde-clara","label":"Verde clara","hex":"#7CB342"},{"id":"terracota","label":"Terracota","hex":"#C65D3B"},{"id":"amarela","label":"Amarela","hex":"#F9A825"},{"id":"preta","label":"Preta","hex":"#2D2D2D"},{"id":"flocos","label":"Flocos","hex":"#8B7355"}]'::text,
      4
    ),
    (
      'PLAYFIT-26',
      'PlayFit 26 mm',
      '26',
      'Playground e academias — maior amortecimento',
      '0,5 × 0,5 m',
      500, 500, 26,
      0.25::numeric,
      6.5::numeric,
      2.052::numeric,
      '[{"id":"verde-grama","label":"Verde grama","hex":"#388E3C"},{"id":"azul","label":"Azul","hex":"#1976D2"},{"id":"cinza","label":"Cinza","hex":"#757575"},{"id":"preta","label":"Preta","hex":"#2D2D2D"}]'::text,
      3
    ),
    (
      'PLAYFIT-40',
      'PlayFit 40 mm',
      '40',
      'Playground ABNT / academias — intertravado',
      '1 × 1 m',
      1000, 1000, 40,
      1.0::numeric,
      40.0::numeric,
      2.040::numeric,
      '[{"id":"verde-clara","label":"Verde clara","hex":"#7CB342"},{"id":"terracota","label":"Terracota","hex":"#C65D3B"},{"id":"amarela","label":"Amarela","hex":"#F9A825"},{"id":"preta","label":"Preta","hex":"#2D2D2D"}]'::text,
      3
    )
) AS v(
  sku, name, line_code, typical_use, geometry,
  len_mm, wid_mm, thk_mm, m2_plate, weight_plate, vol_default, colors, montage_count
)
WHERE c.slug = 'playfit'
ON CONFLICT (company_id, sku) DO UPDATE SET
  name = EXCLUDED.name,
  boxes_total = EXCLUDED.boxes_total,
  box_types_count = EXCLUDED.box_types_count,
  weight_kg_per_unit = EXCLUDED.weight_kg_per_unit,
  volume_m3_per_unit = EXCLUDED.volume_m3_per_unit,
  line_code = EXCLUDED.line_code,
  typical_use = EXCLUDED.typical_use,
  geometry_label = EXCLUDED.geometry_label,
  plate_length_mm = EXCLUDED.plate_length_mm,
  plate_width_mm = EXCLUDED.plate_width_mm,
  plate_thickness_mm = EXCLUDED.plate_thickness_mm,
  m2_per_plate = EXCLUDED.m2_per_plate,
  weight_kg_per_plate = EXCLUDED.weight_kg_per_plate,
  colors = EXCLUDED.colors;

-- Montagem por linha: volume = 1,0×1,2×(placas×espessura + 150 mm base PBR).
INSERT INTO feira.product_boxes (
  product_id, box_type, length_mm, width_mm, height_mm,
  boxes_per_unit, group_weight_kg, volume_m3,
  plates_per_pallet, stack_height_mm, pbr_base_height_mm
)
SELECT
  p.id,
  m.plates::text,
  1000,
  1200,
  m.plates * p.plate_thickness_mm + 150,
  1,
  m.plates * p.weight_kg_per_plate,
  round((1.0 * 1.2 * ((m.plates * p.plate_thickness_mm + 150) / 1000.0))::numeric, 4),
  m.plates,
  m.plates * p.plate_thickness_mm,
  150
FROM feira.products p
JOIN feira.companies c ON c.id = p.company_id
CROSS JOIN LATERAL (
  SELECT unnest(
    CASE p.sku
      WHEN 'PLAYFIT-40' THEN ARRAY[20, 30, 40]
      WHEN 'PLAYFIT-26' THEN ARRAY[50, 60, 70]
      ELSE ARRAY[50, 60, 70, 80]
    END
  ) AS plates
) m
WHERE c.slug = 'playfit'
  AND p.sku LIKE 'PLAYFIT-%'
ON CONFLICT (product_id, box_type) DO UPDATE SET
  height_mm = EXCLUDED.height_mm,
  group_weight_kg = EXCLUDED.group_weight_kg,
  volume_m3 = EXCLUDED.volume_m3,
  plates_per_pallet = EXCLUDED.plates_per_pallet,
  stack_height_mm = EXCLUDED.stack_height_mm,
  pbr_base_height_mm = EXCLUDED.pbr_base_height_mm;

NOTIFY pgrst, 'reload schema';
