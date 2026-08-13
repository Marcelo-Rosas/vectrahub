-- Gate: carreteiro_real (negociado) nunca < carreteiro_antt (piso).
-- Limpa OS homolog inválida antes do CHECK.

UPDATE public.orders
SET carreteiro_real = NULL,
    updated_at = now()
WHERE carreteiro_real IS NOT NULL
  AND carreteiro_antt IS NOT NULL
  AND carreteiro_real < carreteiro_antt;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_carreteiro_real_gte_antt;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_carreteiro_real_gte_antt
  CHECK (
    carreteiro_real IS NULL
    OR carreteiro_antt IS NULL
    OR carreteiro_antt <= 0
    OR carreteiro_real >= carreteiro_antt
  );

COMMENT ON CONSTRAINT orders_carreteiro_real_gte_antt ON public.orders IS
  'carreteiro_real negociado >= carreteiro_antt (piso). Sem piso (null/0) liberado.';
