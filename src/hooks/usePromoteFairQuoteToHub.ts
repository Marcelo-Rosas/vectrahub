import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { asInsert } from '@/lib/supabase-utils';
import {
  buildFairWonHubInsert,
  fairPdfDisclaimer,
  FAIR_HUB_SOURCE_PREFIX,
  type FairHubPromotion,
} from '@/lib/fair-hub-clone';
import { generateQuotePdf } from '@/lib/generateQuotePdf';
import type { FairDashboardQuoteCard, FairDashboardTenant } from '@/lib/fair-dashboard-types';

const PROMO_KEY = 'feira-hub-promotions';

function loadPromotions(): Record<string, FairHubPromotion> {
  try {
    const raw = localStorage.getItem(PROMO_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, FairHubPromotion>;
  } catch {
    return {};
  }
}

function savePromotion(fairId: string, promo: FairHubPromotion) {
  const map = loadPromotions();
  map[fairId] = promo;
  localStorage.setItem(PROMO_KEY, JSON.stringify(map));
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.documentElement.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

async function findExistingHubQuote(fairId: string): Promise<FairHubPromotion | null> {
  const cached = loadPromotions()[fairId];
  if (cached?.quoteId) return cached;

  const { data } = await supabase
    .from('quotes')
    .select('id, quote_code, notes')
    .ilike('notes', `${FAIR_HUB_SOURCE_PREFIX}${fairId}%`)
    .limit(1)
    .maybeSingle();

  if (!data?.id) return null;
  const promo = { quoteId: data.id, quoteCode: data.quote_code };
  savePromotion(fairId, promo);
  return promo;
}

async function emitFairWonPdf(input: {
  card: FairDashboardQuoteCard;
  tenant: FairDashboardTenant;
  quoteId: string;
  quoteCode: string | null;
  origin: string;
}) {
  const { blob, fileName } = await generateQuotePdf({
    quote: {
      id: input.quoteId,
      quote_code: input.quoteCode,
      client_name: input.card.clientName,
      origin: input.origin,
      destination: input.card.destination,
      value: input.card.total,
      cargo_type: 'Equipamentos fitness',
      weight: input.card.weightKg,
      volume: null,
      km_distance: input.card.km,
      estimated_loading_date: null,
      notes: fairPdfDisclaimer(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      shipper_name_fallback: input.tenant.name,
      client: { name: input.card.clientName },
      event_flag: input.card.eventFlag,
      pedagio_estimado: input.card.tollEstimated,
      fair_disclaimer: true,
    },
    mode: 'simplified',
  });
  triggerBlobDownload(blob, fileName);
}

/**
 * Ganho na feira → insert `public.quotes` stage ganho (Dashboard Hub) + PDF COT.
 * Sem `public.clients`. Idempotente por `feira-source:{id}`.
 */
export function usePromoteFairQuoteToHub() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (input: { card: FairDashboardQuoteCard; tenant: FairDashboardTenant }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Faça login para clonar no Hub');

      const existing = await findExistingHubQuote(input.card.id);
      const insert = buildFairWonHubInsert({
        card: input.card,
        tenant: input.tenant,
        createdBy: user.id,
      });

      let quoteId: string;
      let quoteCode: string | null;

      if (existing) {
        quoteId = existing.quoteId;
        quoteCode = existing.quoteCode;
      } else {
        const { data: created, error } = await supabase
          .from('quotes')
          .insert(asInsert(insert))
          .select('id, quote_code')
          .single();
        if (error) throw new Error(error.message);
        if (!created) throw new Error('Falha ao clonar cotação no Hub');
        quoteId = created.id;
        quoteCode = created.quote_code;
        savePromotion(input.card.id, { quoteId, quoteCode });
      }

      await emitFairWonPdf({
        card: input.card,
        tenant: input.tenant,
        quoteId,
        quoteCode,
        origin: insert.origin,
      });

      return { quoteId, quoteCode, reused: Boolean(existing) };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpi'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['recent-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-funnel'] });
      const code = result.quoteCode ?? 'COT';
      toast.success(result.reused ? `Já no Hub: ${code}` : `Clonado no Dashboard Hub: ${code}`, {
        description: 'PDF baixado',
        action: {
          label: 'Abrir Dashboard',
          onClick: () => navigate('/'),
        },
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Falha ao clonar no Hub');
    },
  });
}
