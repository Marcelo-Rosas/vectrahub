import { useEffect, useState } from 'react';
import { Loader2, Mail, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useSendAverbaMsEmail } from '@/hooks/useSendAverbaMsEmail';
import {
  AVERBA_MS_CC_DEFAULT,
  AVERBA_MS_TO_DEFAULT,
  formatEmailList,
  parseEmailList,
} from '@/lib/averba-ms';
import type { CteEmissionRow } from '@/hooks/useCteEmission';

interface SendAverbaMsEmailModalProps {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  quoteCode?: string | null;
  vehiclePlate?: string | null;
  authorized: CteEmissionRow[];
}

export function SendAverbaMsEmailModal({
  open,
  onClose,
  quoteId,
  quoteCode,
  vehiclePlate,
  authorized,
}: SendAverbaMsEmailModalProps) {
  const [to, setTo] = useState(formatEmailList(AVERBA_MS_TO_DEFAULT));
  const [cc, setCc] = useState(formatEmailList(AVERBA_MS_CC_DEFAULT));
  const send = useSendAverbaMsEmail();

  useEffect(() => {
    if (open) {
      setTo(formatEmailList(AVERBA_MS_TO_DEFAULT));
      setCc(formatEmailList(AVERBA_MS_CC_DEFAULT));
    }
  }, [open]);

  async function handleSend() {
    const toList = parseEmailList(to);
    if (toList.length === 0) return;
    await send.mutateAsync({
      quoteId,
      to: toList,
      cc: parseEmailList(cc),
      vehiclePlate: vehiclePlate ?? undefined,
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Enviar averbação MS / Fairfax
          </DialogTitle>
          <DialogDescription>
            Mesmo canal do e-mail de cotação (Resend). Anexa os XMLs autorizados + planilha.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{quoteCode ?? '—'}</span>
            <span className="text-xs text-muted-foreground">
              {authorized.length} CT-e{authorized.length === 1 ? '' : 's'} · placa{' '}
              <span className="font-mono">{vehiclePlate || '—'}</span>
            </span>
          </div>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {authorized.map((e) => {
              const dest = String(
                (e.payload_sent as { nome_destinatario?: string } | null)?.nome_destinatario ?? ''
              );
              return (
                <li key={e.id}>
                  #{e.numero}
                  {dest ? ` · ${dest}` : ''}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="averba-to">Para (um e-mail por linha)</Label>
          <Textarea
            id="averba-to"
            rows={4}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="font-mono text-xs"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="averba-cc">CC</Label>
          <Input
            id="averba-cc"
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            className="font-mono text-xs"
          />
        </div>

        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Averbação automática AT&amp;M só em setembro. Até lá o envio é manual por este e-mail.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={send.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleSend()}
            disabled={send.isPending || parseEmailList(to).length === 0}
          >
            {send.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Mail className="w-4 h-4 mr-2" />
            )}
            Enviar agora
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
