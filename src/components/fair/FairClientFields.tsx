import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CnpjLookupError, lookupCnpj } from '@/lib/cnpjLookup';
import { fetchCepData } from '@/hooks/useCepLookup';
import {
  composeFairAddress,
  digitsOnly,
  formatFairCep,
  formatFairDocument,
  type FairClientDraft,
  type FairDocKind,
} from '@/lib/fair-client';
import { Checkbox } from '@/components/ui/checkbox';
import { FAIR_UI } from '@/lib/fair-brand-palettes';
import { cn } from '@/lib/utils';

const inputMobile = 'h-12 text-base touch-manipulation md:h-10 md:text-sm';

type Props = {
  value: FairClientDraft;
  onChange: (next: FairClientDraft) => void;
};

export function FairClientFields({ value, onChange }: Props) {
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [deliveryCepLoading, setDeliveryCepLoading] = useState(false);
  const lastCnpj = useRef('');
  const lastCep = useRef('');
  const lastDeliveryCep = useRef('');

  const setKind = (kind: FairDocKind) => {
    onChange({
      ...value,
      kind,
      document: '',
      name: kind === 'cpf' ? value.name : '',
    });
  };

  const patch = (partial: Partial<FairClientDraft>) => onChange({ ...value, ...partial });

  const handleCnpjLookup = async (draft: FairClientDraft) => {
    const digits = digitsOnly(draft.document);
    if (digits.length !== 14 || digits === lastCnpj.current || cnpjLoading) return;
    lastCnpj.current = digits;
    setCnpjLoading(true);
    try {
      const result = await lookupCnpj(draft.document);
      const address = composeFairAddress({
        street: result.address,
        number: result.address_number,
        neighborhood: result.address_neighborhood,
        city: result.city,
        state: result.state,
      });
      onChange({
        ...draft,
        kind: 'cnpj',
        document: formatFairDocument('cnpj', result.cnpj || draft.document),
        name: (result.name ?? result.trade_name ?? draft.name).trim(),
        zipCode: formatFairCep(result.zip_code ?? draft.zipCode),
        address: address || draft.address,
        email: (result.email ?? draft.email).trim(),
        city: result.city ?? draft.city,
        state: result.state ?? draft.state,
      });
      toast.success('Cliente preenchido pelo CNPJ');
    } catch (e) {
      lastCnpj.current = '';
      toast.error(e instanceof CnpjLookupError ? e.message : 'Falha ao consultar CNPJ');
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleCepLookup = async (draft: FairClientDraft) => {
    const digits = digitsOnly(draft.zipCode);
    if (digits.length !== 8 || digits === lastCep.current || cepLoading) return;
    lastCep.current = digits;
    setCepLoading(true);
    try {
      const cep = await fetchCepData(draft.zipCode);
      if (!cep) {
        lastCep.current = '';
        toast.error('CEP não encontrado');
        return;
      }
      const address = composeFairAddress({
        street: cep.logradouro,
        neighborhood: cep.bairro,
        city: cep.localidade,
        state: cep.uf,
      });
      onChange({
        ...draft,
        zipCode: formatFairCep(cep.cep || draft.zipCode),
        address: address || draft.address,
        city: cep.localidade || draft.city,
        state: cep.uf || draft.state,
      });
    } catch {
      lastCep.current = '';
      toast.error('Falha ao buscar CEP');
    } finally {
      setCepLoading(false);
    }
  };

  const handleDeliveryCepLookup = async (draft: FairClientDraft) => {
    const digits = digitsOnly(draft.deliveryZip);
    if (digits.length !== 8 || digits === lastDeliveryCep.current || deliveryCepLoading) return;
    lastDeliveryCep.current = digits;
    setDeliveryCepLoading(true);
    try {
      const cep = await fetchCepData(draft.deliveryZip);
      if (!cep) {
        lastDeliveryCep.current = '';
        toast.error('CEP de entrega não encontrado');
        return;
      }
      onChange({
        ...draft,
        deliveryZip: formatFairCep(cep.cep || draft.deliveryZip),
        deliveryCity: cep.localidade || draft.deliveryCity,
        deliveryState: cep.uf || draft.deliveryState,
      });
    } catch {
      lastDeliveryCep.current = '';
      toast.error('Falha ao buscar CEP de entrega');
    } finally {
      setDeliveryCepLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className={cn(
            'min-h-11 touch-manipulation font-semibold',
            value.kind === 'cnpj' ? FAIR_UI.cta : FAIR_UI.toggleOff
          )}
          onClick={() => setKind('cnpj')}
        >
          CNPJ
        </Button>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'min-h-11 touch-manipulation font-semibold',
            value.kind === 'cpf' ? FAIR_UI.cta : FAIR_UI.toggleOff
          )}
          onClick={() => setKind('cpf')}
        >
          CPF
        </Button>
      </div>

      <div className="space-y-2">
        <Label>{value.kind === 'cnpj' ? 'CNPJ' : 'CPF'}</Label>
        <div className="relative">
          <Input
            className={cn(inputMobile, 'font-mono')}
            inputMode="numeric"
            autoComplete="off"
            placeholder={value.kind === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00'}
            value={value.document}
            onChange={(e) => {
              const document = formatFairDocument(value.kind, e.target.value);
              const next = { ...value, document };
              onChange(next);
              if (value.kind === 'cnpj' && digitsOnly(document).length === 14) {
                void handleCnpjLookup(next);
              }
            }}
            onBlur={() => {
              if (value.kind === 'cnpj') void handleCnpjLookup(value);
            }}
          />
          {cnpjLoading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        {value.kind === 'cnpj' && (
          <p className="text-xs text-muted-foreground">Consulta Receita ao sair do campo</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Nome</Label>
        <Input
          className={inputMobile}
          placeholder={value.kind === 'cnpj' ? 'Razão social (API)' : 'Nome completo'}
          value={value.name}
          onChange={(e) => patch({ name: e.target.value })}
          readOnly={value.kind === 'cnpj' && cnpjLoading}
        />
      </div>

      <div className="space-y-2">
        <Label>CEP</Label>
        <div className="relative">
          <Input
            className={cn(inputMobile, 'font-mono')}
            inputMode="numeric"
            placeholder="00000-000"
            value={value.zipCode}
            onChange={(e) => {
              const zipCode = formatFairCep(e.target.value);
              const next = { ...value, zipCode };
              onChange(next);
              if (digitsOnly(zipCode).length === 8) void handleCepLookup(next);
            }}
            onBlur={() => void handleCepLookup(value)}
          />
          {cepLoading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Endereço</Label>
        <Input
          className={inputMobile}
          placeholder="Rua, número, bairro, cidade"
          value={value.address}
          onChange={(e) => patch({ address: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>E-mail</Label>
        <Input
          className={inputMobile}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="contato@empresa.com"
          value={value.email}
          onChange={(e) => patch({ email: e.target.value })}
        />
      </div>

      <label className="flex min-h-11 items-start gap-3 rounded-xl border px-3 py-3 touch-manipulation">
        <Checkbox
          className="mt-0.5 h-5 w-5"
          checked={value.deliveryDifferent}
          onCheckedChange={(checked) =>
            onChange({
              ...value,
              deliveryDifferent: checked === true,
            })
          }
        />
        <span className="text-sm leading-snug">
          Entrega em cidade diferente do cadastro (Receita/CEP)
        </span>
      </label>

      {value.deliveryDifferent && (
        <div className={cn('space-y-3 rounded-xl border p-3', FAIR_UI.softPanel)}>
          <div className="space-y-2">
            <Label>CEP da entrega</Label>
            <div className="relative">
              <Input
                className={cn(inputMobile, 'font-mono')}
                inputMode="numeric"
                placeholder="00000-000"
                value={value.deliveryZip}
                onChange={(e) => {
                  const deliveryZip = formatFairCep(e.target.value);
                  const next = { ...value, deliveryZip };
                  onChange(next);
                  if (digitsOnly(deliveryZip).length === 8) void handleDeliveryCepLookup(next);
                }}
                onBlur={() => void handleDeliveryCepLookup(value)}
              />
              {deliveryCepLoading && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cidade da entrega</Label>
            <Input
              className={inputMobile}
              placeholder="Cidade"
              value={value.deliveryCity}
              onChange={(e) => patch({ deliveryCity: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>UF</Label>
            <Input
              className={cn(inputMobile, 'uppercase')}
              maxLength={2}
              placeholder="UF"
              value={value.deliveryState}
              onChange={(e) => patch({ deliveryState: e.target.value.toUpperCase().slice(0, 2) })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
