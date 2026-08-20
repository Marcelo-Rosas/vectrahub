export type PlayFitBranch = {
  id: string;
  label: string;
  originCep: string;
  originCity: string;
  originUf: string;
};

export const PLAYFIT_SKU_M2 = 'PLAYFIT-M2';

export const PLAYFIT_TENANT_CONFIG = {
  cubageFactor: 300,
  branches: [
    {
      id: 'fortaleza',
      label: 'Filial Fortaleza (Eusébio)',
      originCep: '61770580',
      originCity: 'Eusébio',
      originUf: 'CE',
    },
    {
      id: 'recife',
      label: 'Filial Recife',
      originCep: '50010000',
      originCity: 'Recife',
      originUf: 'PE',
    },
    {
      id: 'salvador',
      label: 'Filial Salvador (Lauro de Freitas)',
      originCep: '42711610',
      originCity: 'Lauro de Freitas',
      originUf: 'BA',
    },
    {
      id: 'fabrica',
      label: 'Fábrica / matriz',
      originCep: '88317100',
      originCity: 'Itajaí',
      originUf: 'SC',
    },
  ] satisfies PlayFitBranch[],
} as const;

export function getPlayFitBranch(id: string): PlayFitBranch | undefined {
  return PLAYFIT_TENANT_CONFIG.branches.find((b) => b.id === id);
}
