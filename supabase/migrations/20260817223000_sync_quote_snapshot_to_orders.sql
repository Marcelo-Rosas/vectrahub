-- COT → OS: snapshot comercial (carga, rota, cliente, frete).
-- Não toca motorista, placa, stage, VPO, pricing_breakdown.

CREATE OR REPLACE FUNCTION public.sync_quote_snapshot_to_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders o
  SET
    cargo_value = NEW.cargo_value,
    cargo_type = NEW.cargo_type,
    weight = NEW.weight,
    volume = NEW.volume,
    origin = NEW.origin,
    destination = NEW.destination,
    origin_cep = NEW.origin_cep,
    destination_cep = NEW.destination_cep,
    client_id = NEW.client_id,
    client_name = NEW.client_name,
    shipper_id = NEW.shipper_id,
    shipper_name = NEW.shipper_name,
    additional_shippers = NEW.additional_shippers,
    value = NEW.value,
    km_distance = NEW.km_distance,
    toll_value = NEW.toll_value,
    freight_type = NEW.freight_type,
    freight_modality = NEW.freight_modality,
    vehicle_type_id = NEW.vehicle_type_id,
    price_table_id = NEW.price_table_id,
    payment_term_id = NEW.payment_term_id,
    payment_method = NEW.payment_method,
    waiting_time_cost = NEW.waiting_time_cost,
    updated_at = now()
  WHERE o.quote_id = NEW.id
    AND (
      o.cargo_value IS DISTINCT FROM NEW.cargo_value
      OR o.cargo_type IS DISTINCT FROM NEW.cargo_type
      OR o.weight IS DISTINCT FROM NEW.weight
      OR o.volume IS DISTINCT FROM NEW.volume
      OR o.origin IS DISTINCT FROM NEW.origin
      OR o.destination IS DISTINCT FROM NEW.destination
      OR o.origin_cep IS DISTINCT FROM NEW.origin_cep
      OR o.destination_cep IS DISTINCT FROM NEW.destination_cep
      OR o.client_id IS DISTINCT FROM NEW.client_id
      OR o.client_name IS DISTINCT FROM NEW.client_name
      OR o.shipper_id IS DISTINCT FROM NEW.shipper_id
      OR o.shipper_name IS DISTINCT FROM NEW.shipper_name
      OR o.additional_shippers IS DISTINCT FROM NEW.additional_shippers
      OR o.value IS DISTINCT FROM NEW.value
      OR o.km_distance IS DISTINCT FROM NEW.km_distance
      OR o.toll_value IS DISTINCT FROM NEW.toll_value
      OR o.freight_type IS DISTINCT FROM NEW.freight_type
      OR o.freight_modality IS DISTINCT FROM NEW.freight_modality
      OR o.vehicle_type_id IS DISTINCT FROM NEW.vehicle_type_id
      OR o.price_table_id IS DISTINCT FROM NEW.price_table_id
      OR o.payment_term_id IS DISTINCT FROM NEW.payment_term_id
      OR o.payment_method IS DISTINCT FROM NEW.payment_method
      OR o.waiting_time_cost IS DISTINCT FROM NEW.waiting_time_cost
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_quote_snapshot_to_orders ON public.quotes;

CREATE TRIGGER trg_sync_quote_snapshot_to_orders
AFTER UPDATE ON public.quotes
FOR EACH ROW
WHEN (
  OLD.cargo_value IS DISTINCT FROM NEW.cargo_value
  OR OLD.cargo_type IS DISTINCT FROM NEW.cargo_type
  OR OLD.weight IS DISTINCT FROM NEW.weight
  OR OLD.volume IS DISTINCT FROM NEW.volume
  OR OLD.origin IS DISTINCT FROM NEW.origin
  OR OLD.destination IS DISTINCT FROM NEW.destination
  OR OLD.origin_cep IS DISTINCT FROM NEW.origin_cep
  OR OLD.destination_cep IS DISTINCT FROM NEW.destination_cep
  OR OLD.client_id IS DISTINCT FROM NEW.client_id
  OR OLD.client_name IS DISTINCT FROM NEW.client_name
  OR OLD.shipper_id IS DISTINCT FROM NEW.shipper_id
  OR OLD.shipper_name IS DISTINCT FROM NEW.shipper_name
  OR OLD.additional_shippers IS DISTINCT FROM NEW.additional_shippers
  OR OLD.value IS DISTINCT FROM NEW.value
  OR OLD.km_distance IS DISTINCT FROM NEW.km_distance
  OR OLD.toll_value IS DISTINCT FROM NEW.toll_value
  OR OLD.freight_type IS DISTINCT FROM NEW.freight_type
  OR OLD.freight_modality IS DISTINCT FROM NEW.freight_modality
  OR OLD.vehicle_type_id IS DISTINCT FROM NEW.vehicle_type_id
  OR OLD.price_table_id IS DISTINCT FROM NEW.price_table_id
  OR OLD.payment_term_id IS DISTINCT FROM NEW.payment_term_id
  OR OLD.payment_method IS DISTINCT FROM NEW.payment_method
  OR OLD.waiting_time_cost IS DISTINCT FROM NEW.waiting_time_cost
)
EXECUTE FUNCTION public.sync_quote_snapshot_to_orders();

REVOKE ALL ON FUNCTION public.sync_quote_snapshot_to_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_quote_snapshot_to_orders() TO postgres;
