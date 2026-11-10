-- Reconstrução dos dados feira.* no Hub novo (projeto antigo lrbtb excluído; histórico era teste).
-- Gerado a partir do DML das migrations feira, em ordem. Idempotente (ON CONFLICT). Não toca auth.users.
-- Ignora DML dentro de corpo de função ($$ ... $$).
BEGIN;

-- >>> 20260818140000_feira_schema.sql
INSERT INTO feira.companies (
  slug, name, origin_city, origin_uf, origin_label, origin_cep, email_domains, event_flag, toll_fallback_percent
)
VALUES (
  'buckler',
  'Buckler Fit',
  'São Bernardo do Campo',
  'SP',
  'São Bernardo do Campo - SP',
  '09840000',
  ARRAY['bucklerfit.com'],
  'IHRSA-BUCKLER',
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


-- >>> 20260818190000_feira_konnen_tenant.sql
INSERT INTO feira.companies (
  slug, name, origin_city, origin_uf, origin_label, origin_cep, email_domains, event_flag, toll_fallback_percent
)
VALUES (
  'konnen',
  'Konnen Fitness',
  'Itajaí',
  'SC',
  'Itajaí - SC',
  '88317100',
  ARRAY['konnenfitness.com.br'],
  'IHRSA-KONNEN',
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

INSERT INTO feira.user_company (user_id, company_id)
SELECT u.id, feira.resolve_company_id_for_email(u.email)
FROM auth.users u
WHERE feira.resolve_company_id_for_email(u.email) IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id;


-- >>> 20260819140000_feira_product_boxes_denorm.sql
UPDATE feira.product_boxes b
SET
  company_id = p.company_id,
  sku = p.sku
FROM feira.products p
WHERE p.id = b.product_id
  AND (b.company_id IS NULL OR b.sku IS NULL);


-- >>> 20260819200000_feira_playfit_tenant.sql
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


-- >>> 20260819210000_feira_playfit_product_catalog.sql
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


-- >>> 20260820140000_feira_rotha_tenant.sql
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


-- >>> 20260820160000_feira_rotha_email_domain.sql
UPDATE feira.companies
SET email_domains = ARRAY['rothafitness.com']
WHERE slug = 'rotha'
  AND email_domains @> ARRAY['rothafitness.com.br']::text[];


-- >>> 20260820170000_feira_company_brands.sql
UPDATE feira.companies
SET brand_domain = email_domains[1]
WHERE brand_domain IS NULL
  AND email_domains IS NOT NULL
  AND cardinality(email_domains) > 0;


-- >>> 20260821230000_feira_rotha_catalog_groups.sql
UPDATE feira.products p
SET
  catalog_group = 'KITS',
  product_kind = 'kit'
FROM feira.companies c
WHERE p.company_id = c.id
  AND c.slug = 'rotha'
  AND p.sku LIKE 'ROTHA-KIT-%';


-- >>> 20260821240000_feira_playfit_email_alias.sql
UPDATE feira.companies
SET email_domains = ARRAY['playfitpisos.com.br', 'playfitpiso.com.br']
WHERE slug = 'playfit';

INSERT INTO feira.user_company (user_id, company_id)
SELECT u.id, c.id
FROM auth.users u
JOIN feira.companies c ON c.slug = 'playfit'
WHERE lower(split_part(coalesce(u.email, ''), '@', 2)) IN (
  'playfitpisos.com.br',
  'playfitpiso.com.br',
  'playfitpisos.com',
  'playfitpiso.com'
)
ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id;

COMMIT;
NOTIFY pgrst, 'reload schema';
