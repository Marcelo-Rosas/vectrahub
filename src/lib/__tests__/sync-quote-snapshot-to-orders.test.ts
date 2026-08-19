import { describe, expect, it } from 'vitest';
import {
  buildOrderQuoteSnapshotUpdate,
  quoteSnapshotDiffers,
} from '@/lib/sync-quote-snapshot-to-orders';

const quote = {
  cargo_value: 45000,
  cargo_type: 'Equipamentos fitness',
  weight: 1200,
  volume: 18,
  origin: 'Navegantes/SC',
  destination: 'Curitiba/PR',
  origin_cep: '88330000',
  destination_cep: '80010000',
  client_id: 'cli-1',
  client_name: 'Cliente SA',
  shipper_id: 'shp-1',
  shipper_name: 'Embarcador SA',
  additional_shippers: [{ name: 'Extra' }],
  value: 8900,
  km_distance: 212,
  toll_value: 45.5,
  freight_type: 'FOB',
  freight_modality: 'fracionado',
  vehicle_type_id: 'vt-1',
  price_table_id: 'pt-1',
  payment_term_id: 'pay-1',
  payment_method: 'boleto',
  waiting_time_cost: 0,
};

describe('buildOrderQuoteSnapshotUpdate', () => {
  it('copia valor da carga e demais campos comerciais da COT', () => {
    const update = buildOrderQuoteSnapshotUpdate(quote);
    expect(update.cargo_value).toBe(45000);
    expect(update.weight).toBe(1200);
    expect(update.origin).toBe('Navegantes/SC');
    expect(update.destination).toBe('Curitiba/PR');
    expect(update.value).toBe(8900);
    expect(update.km_distance).toBe(212);
    expect(update.client_name).toBe('Cliente SA');
    expect(update.shipper_name).toBe('Embarcador SA');
  });

  it('não inclui campos operacionais da OS', () => {
    const update = buildOrderQuoteSnapshotUpdate(quote);
    expect(update).not.toHaveProperty('driver_id');
    expect(update).not.toHaveProperty('vehicle_plate');
    expect(update).not.toHaveProperty('stage');
    expect(update).not.toHaveProperty('os_number');
    expect(update).not.toHaveProperty('has_vpo');
    expect(update).not.toHaveProperty('pricing_breakdown');
    expect(update).not.toHaveProperty('carreteiro_real');
  });
});

describe('quoteSnapshotDiffers', () => {
  it('detecta cargo_value divergente', () => {
    expect(quoteSnapshotDiffers(quote, { ...quote, cargo_value: 30000 })).toBe(true);
  });

  it('false quando snapshot igual', () => {
    expect(quoteSnapshotDiffers(quote, quote)).toBe(false);
  });
});
