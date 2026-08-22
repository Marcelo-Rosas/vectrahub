/**
 * Grupos funcionais Konnen (docs/audit) — não são chips UI IMPULSE/XMASTER/ROCKIT.
 * Objetivo: nunca retornar OUTROS — 6 grupos cobrem 100% do catálogo.
 */

export type KonnenFunctionalGroup =
  'PIN LOADED' | 'PLATE LOADED' | 'CABLE CROSS' | 'BENCHES & RACKS' | 'ACESSORIOS' | 'CARDIO';

/** @deprecated OUTROS removido — mantido só se algum consumidor legado comparar string. */
export type KonnenFunctionalGroupLegacy = KonnenFunctionalGroup | 'OUTROS';

export function isKonnenWeightStackSku(sku: string): boolean {
  const u = sku.trim().toUpperCase();
  return /^(FEWS|IF93WS|IT95WS)(-|$)/.test(u) || /^(FEWS|IF93WS|IT95WS)/.test(u);
}

/**
 * Classifica SKU Konnen em grupo funcional (docs/audit).
 * Precedência: prefixo máquina → acessório → cardio → nome → fallback ACESSORIOS.
 */
export function konnenFunctionalGroup(sku: string, name = ''): KonnenFunctionalGroup {
  const upperSku = String(sku ?? '')
    .trim()
    .toUpperCase();
  const upperName = String(name ?? '')
    .trim()
    .toUpperCase();

  if (!upperSku) return 'ACESSORIOS';

  // 1. PIN LOADED
  if (/^FE97/.test(upperSku)) return 'PIN LOADED';
  if (/^IF93/.test(upperSku) && !/^IF93WS/.test(upperSku)) return 'PIN LOADED';
  if (/^IT95/.test(upperSku) && !/^IT95WS/.test(upperSku)) return 'PIN LOADED';
  if (/^LCS/.test(upperSku)) return 'PIN LOADED';
  if (/^AM80/.test(upperSku)) return 'PIN LOADED';

  // 2. PLATE LOADED
  if (/^IFP/.test(upperSku)) return 'PLATE LOADED';
  if (/^SL/.test(upperSku)) return 'PLATE LOADED';
  if (/^ECP/.test(upperSku)) return 'PLATE LOADED';
  if (/^IFL/.test(upperSku)) return 'PLATE LOADED';

  // 3. ACESSORIOS (prefixos)
  if (/^RKC/.test(upperSku)) return 'ACESSORIOS';
  if (/^FEWS/.test(upperSku)) return 'ACESSORIOS';
  if (/^IF93WS/.test(upperSku)) return 'ACESSORIOS';
  if (/^IT95WS/.test(upperSku)) return 'ACESSORIOS';
  if (/^XMT|^XMR/.test(upperSku)) return 'ACESSORIOS';
  if (/^OKPRO/.test(upperSku)) return 'ACESSORIOS';

  // 4. CARDIO (prefixos)
  if (/^AC/.test(upperSku)) return 'CARDIO';
  if (/^EC/.test(upperSku)) return 'CARDIO';
  if (/^PS/.test(upperSku)) return 'CARDIO';
  if (/^HSR/.test(upperSku)) return 'CARDIO';
  if (/^HB/.test(upperSku)) return 'CARDIO';
  if (/^HS/.test(upperSku)) return 'CARDIO';
  if (/^V9/.test(upperSku)) return 'CARDIO';
  if (/^XSC/.test(upperSku)) return 'CARDIO';

  // 5. Nome (híbrido — TN/TB/TM/IF* bancos etc.)
  if (/CABLE|CROSSOVER|POLIA|PULLEY|HI-?LO/.test(upperName)) return 'CABLE CROSS';

  if (
    /BENCH|CHAIR|SEAT|SQUAT|RACK|CAGE|POWER\s*RACK|SMITH|BANCO|SUPORTE|ADJUSTABLE/.test(
      upperName
    ) ||
    /^FW/.test(upperSku) ||
    /^TN|^TB/.test(upperSku)
  ) {
    // TN/TB default bancos; nome attachment sobrescreve abaixo se só attachment
    if (!/ATTACHMENT|EXTENSION\s*KIT|HOME\s*GYM/.test(upperName)) {
      if (
        /BENCH|CHAIR|SEAT|SQUAT|RACK|CAGE|SMITH|BANCO|SUPORTE|POWER|ADJUSTABLE/.test(upperName) ||
        /^FW|^TN|^TB/.test(upperSku)
      ) {
        return 'BENCHES & RACKS';
      }
    }
  }

  if (
    /ATTACHMENT|EXTENSION|PANEL|HOME\s*GYM|HOME\s*EQUIPMENT|KIT|BARBELL|ANILHA|HALTER|ACCESSOR|WEIGHT\s*PLATE|DUMBBELL/.test(
      upperName
    )
  ) {
    return 'ACESSORIOS';
  }

  if (
    /CARDIO|STAIR|CLIMB|STEP|TREAD|WALK|ELLIPTIC|BIKE|ROWING|CYCLE|CLIMBER|STEPPER|TREADMILL/.test(
      upperName
    )
  ) {
    return 'CARDIO';
  }

  if (/PLATE\s*LOADED|HACK|LEG\s*PRESS|ARTICULAD/.test(upperName)) {
    return 'PLATE LOADED';
  }

  // TN/TB sem nome útil → bancos; TM → acessórios
  if (/^TN|^TB/.test(upperSku)) return 'BENCHES & RACKS';
  if (/^TM/.test(upperSku)) return 'ACESSORIOS';
  if (/^IF/.test(upperSku)) return 'BENCHES & RACKS';

  // Fallback seguro — sem OUTROS
  return 'ACESSORIOS';
}

export function getFunctionalGroupLabel(group: KonnenFunctionalGroup): string {
  const labels: Record<KonnenFunctionalGroup, string> = {
    'PIN LOADED': 'Máquinas com Bateria de Pesos',
    'PLATE LOADED': 'Máquinas com Anilhas',
    'CABLE CROSS': 'Estações de Polia',
    'BENCHES & RACKS': 'Bancos e Estruturas',
    ACESSORIOS: 'Acessórios e Complementos',
    CARDIO: 'Equipamentos Cardiovasculares',
  };
  return labels[group];
}

export function getAllFunctionalGroups(): KonnenFunctionalGroup[] {
  return ['PIN LOADED', 'PLATE LOADED', 'CABLE CROSS', 'BENCHES & RACKS', 'ACESSORIOS', 'CARDIO'];
}

/** Chip UI = mesmo rótulo Buckler (PIN LOADED, PLATE LOADED, …). */
export function getFunctionalGroupChipLabel(group: KonnenFunctionalGroup): string {
  return group;
}

export function resolveKonnenFunctionalGroup(entry: {
  sku: string;
  name?: string;
  functionalGroup?: string;
}): KonnenFunctionalGroup {
  const raw = entry.functionalGroup?.trim().toUpperCase();
  if (raw && (getAllFunctionalGroups() as string[]).includes(raw)) {
    return raw as KonnenFunctionalGroup;
  }
  return konnenFunctionalGroup(entry.sku, entry.name ?? '');
}
