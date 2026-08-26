import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CnhCategory {
  code: string;
  description: string;
}

export const CNH_CATEGORY_FALLBACK: CnhCategory[] = [
  { code: 'A', description: 'Motocicletas, motonetas, ciclomotores e similares' },
  { code: 'B', description: 'Automóveis, camionetes e utilitários de até 3.500 kg' },
  { code: 'AB', description: 'Combinação das categorias A e B' },
  { code: 'C', description: 'Veículos de carga com PBT acima de 3.500 kg' },
  { code: 'D', description: 'Veículos de passageiros com mais de 8 lugares' },
  { code: 'E', description: 'Veículos com combinação de unidades (carreta/bitrem)' },
];

export function useCnhCategories() {
  return useQuery<CnhCategory[]>({
    queryKey: ['cnh-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cnh_categories')
        .select('code, description')
        .eq('active', true)
        .order('code');
      if (error || !data?.length) return CNH_CATEGORY_FALLBACK;
      return data;
    },
    staleTime: Infinity,
  });
}
