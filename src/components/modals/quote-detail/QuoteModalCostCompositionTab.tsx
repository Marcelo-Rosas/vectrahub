import { TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { StoredPricingBreakdown } from '@/lib/freightCalculator';
import { resolvePisoAnttCarreteiroReais } from '@/lib/carreteiro-cost';
import { estimateInsuranceRiskCosts } from '@/lib/lotacao-freight-base';

interface ConditionalFee {
  id: string;
  name: string;
  code: string;
}

interface QuoteModalCostCompositionTabProps {
  breakdown: StoredPricingBreakdown | null;
  isSimplesNacional: boolean;
  pisoAnttTotal: number;
  custosDescarga: number;
  conditionalFeesData?: ConditionalFee[] | null;
  margemBruta: number;
  overhead: number;
  resultadoLiquido: number;
  /** Lucro embutido no gross-up (CD × target%). */
  lucroAlvo?: number;
  margemPercent: number;
  isBelowTarget: boolean;
  /** Receita líquida já ajustada (ex.: desconto comercial / faturamento negociado) */
  receitaLiquidaDisplay?: number;
  discountDisplay?: number;
  /** Margem alvo % usada no cálculo (ex.: pricing_rules_config.profit_margin_percent) */
  targetMarginPercent?: number;
  canManage: boolean;
  axesCount: number | null;
  kmDistance: number | null;
  anttRateCcd?: number | null;
  anttRateCc?: number | null;
  hasAnttCalc: boolean;
  onSaveAntt?: () => Promise<void>;
  /** Valor da carga (NF) para cálculo do seguro real */
  cargoValue?: number;
  /** Callback to recalculate freight (v4 → v5 upgrade) */
  onRecalculate?: () => void;
  isRecalculating?: boolean;
}

export function QuoteModalCostCompositionTab({
  breakdown,
  isSimplesNacional,
  pisoAnttTotal,
  custosDescarga,
  conditionalFeesData,
  margemBruta,
  overhead,
  resultadoLiquido,
  lucroAlvo,
  margemPercent,
  isBelowTarget,
  receitaLiquidaDisplay,
  discountDisplay,
  targetMarginPercent = 15,
  canManage,
  axesCount,
  kmDistance,
  anttRateCcd,
  anttRateCc,
  hasAnttCalc,
  onSaveAntt,
  cargoValue = 0,
  onRecalculate,
  isRecalculating = false,
}: QuoteModalCostCompositionTabProps) {
  if (!breakdown?.totals) {
    return <p className="text-sm text-muted-foreground">Nenhuma memória de cálculo disponível.</p>;
  }

  const hasFees =
    Object.keys(breakdown.conditionalFeesBreakdown ?? {}).filter(
      (k) => (breakdown.conditionalFeesBreakdown as Record<string, number>)[k] > 0
    ).length > 0 || (breakdown.components?.waitingTimeCost ?? 0) > 0;

  const discountValue = discountDisplay ?? breakdown.totals.discount ?? 0;
  const totalClienteBruto = breakdown.totals.totalCliente ?? breakdown.totals.receitaBruta ?? 0;
  const totalCliente = Math.max(0, totalClienteBruto - discountValue);
  const receitaLiquida =
    receitaLiquidaDisplay ??
    (breakdown.profitability as { receitaLiquida?: number } | undefined)?.receitaLiquida ??
    totalCliente - (breakdown.totals.das ?? 0) - (breakdown.totals.icms ?? 0);
  const regimeFiscal =
    (
      breakdown.profitability as {
        regimeFiscal?: 'simples_nacional' | 'excesso_sublimite' | 'lucro_presumido' | 'normal';
        regime_fiscal?: 'simples_nacional' | 'excesso_sublimite' | 'lucro_presumido' | 'normal';
      }
    )?.regimeFiscal ??
    (
      breakdown.profitability as {
        regime_fiscal?: 'simples_nacional' | 'excesso_sublimite' | 'lucro_presumido' | 'normal';
      }
    )?.regime_fiscal;
  const hasFederalTaxLines =
    (breakdown.totals.pis ?? 0) > 0 ||
    (breakdown.totals.cofins ?? 0) > 0 ||
    (breakdown.totals.irpj ?? 0) > 0 ||
    (breakdown.totals.csll ?? 0) > 0;
  const isLucroPresumido = regimeFiscal === 'lucro_presumido' || hasFederalTaxLines;
  const custoEfetivoMotorista = breakdown.components?.baseFreight ?? 0;
  const custoMotoristaPisoAntt =
    resolvePisoAnttCarreteiroReais(breakdown) ||
    pisoAnttTotal ||
    breakdown.profitability?.custoMotoristaAntt ||
    0;
  const pedagio = breakdown.components?.toll ?? 0;
  const grisValue = breakdown.components?.gris ?? 0;
  const tsoValue = breakdown.components?.tso ?? 0;
  const rctrcValue = breakdown.components?.rctrc ?? 0;
  const tdeValue = breakdown.components?.tde ?? 0;
  const tearValue = breakdown.components?.tear ?? 0;
  const aluguelMaquinasValue = breakdown.components?.aluguelMaquinas ?? 0;
  const adValoremValue = breakdown.components?.adValorem ?? 0;

  const baseFreight = breakdown.components?.baseFreight ?? 0;
  const pedagioMemoria = breakdown.components?.toll ?? 0;
  const subtotalMotorista = baseFreight + pedagioMemoria;
  const anttFloorApplied = breakdown.meta?.anttFloorApplied === true;
  const fretePesoOriginal = breakdown.meta?.fretePesoOriginal ?? 0;

  const composicaoRows: { label: string; value: number; field: string }[] = [];
  if (breakdown.components) {
    if ((breakdown.components.aluguelMaquinas ?? 0) > 0)
      composicaoRows.push({
        label: 'Aluguel de Máquinas',
        value: breakdown.components.aluguelMaquinas ?? 0,
        field: 'aluguel_maquinas',
      });
    if ((breakdown.components.rctrc ?? 0) > 0)
      composicaoRows.push({
        label: `RCTR-C (${breakdown.rates?.costValuePercent?.toFixed(2) ?? 0}%)`,
        value: breakdown.components.rctrc ?? 0,
        field: 'rctrc',
      });
    if ((breakdown.components.gris ?? 0) > 0)
      composicaoRows.push({
        label: `GRIS (${breakdown.rates?.grisPercent?.toFixed(2) ?? 0}%)`,
        value: breakdown.components.gris ?? 0,
        field: 'gris',
      });
    if ((breakdown.components.tso ?? 0) > 0)
      composicaoRows.push({
        label: `TSO (${breakdown.rates?.tsoPercent?.toFixed(2) ?? 0}%)`,
        value: breakdown.components.tso ?? 0,
        field: 'tso',
      });
    if (adValoremValue > 0)
      composicaoRows.push({
        label: `Ad Valorem (${breakdown.rates?.adValoremPercent?.toFixed(3) ?? '0.030'}%)`,
        value: adValoremValue,
        field: 'ad_valorem',
      });
    if ((breakdown.components.tde ?? 0) > 0)
      composicaoRows.push({
        label: 'TDE (NTC)',
        value: breakdown.components.tde ?? 0,
        field: 'tde',
      });
    if ((breakdown.components.tear ?? 0) > 0)
      composicaoRows.push({
        label: 'TEAR (NTC)',
        value: breakdown.components.tear ?? 0,
        field: 'tear',
      });
    // Taxas condicionais = markup (receita) — listadas fora dos CD abaixo.
    // DRE v5: Taxa de Despacho (NTC) eh cobranca embarcador, nao CD.
    if ((breakdown.components.waitingTimeCost ?? 0) > 0)
      composicaoRows.push({
        label: 'Estadia / hora parada',
        value: breakdown.components.waitingTimeCost ?? 0,
        field: 'waiting_time',
      });
  }

  const tacAdjustment = breakdown.totals?.tacAdjustment ?? 0;
  const paymentAdjustment = breakdown.totals?.paymentAdjustment ?? 0;
  const tacPercent = (breakdown.rates as { tacPercent?: number } | undefined)?.tacPercent;
  const paymentPercent = (breakdown.rates as { paymentAdjustmentPercent?: number } | undefined)
    ?.paymentAdjustmentPercent;
  if (tacAdjustment > 0)
    composicaoRows.push({
      label: `TAC${tacPercent != null ? ` (${tacPercent.toFixed(2)}%)` : ''}`,
      value: tacAdjustment,
      field: 'tac',
    });
  if (paymentAdjustment > 0)
    composicaoRows.push({
      label: `Ajuste prazo${paymentPercent != null ? ` (${paymentPercent.toFixed(2)}%)` : ''}`,
      value: paymentAdjustment,
      field: 'payment_adjustment',
    });
  const custosDescargaMemoria = breakdown.profitability?.custosDescarga ?? custosDescarga;
  if (custosDescargaMemoria > 0)
    composicaoRows.push({
      label: 'Carga / descarga',
      value: custosDescargaMemoria,
      field: 'custos_descarga',
    });

  const custoServicosPb = breakdown.profitability?.custoServicos;
  const custosDiretos =
    breakdown.profitability?.custosDiretos ??
    (custoServicosPb != null
      ? baseFreight + custoServicosPb + custosDescargaMemoria
      : baseFreight +
        pedagioMemoria +
        rctrcValue +
        grisValue +
        tsoValue +
        adValoremValue +
        tdeValue +
        tearValue +
        aluguelMaquinasValue +
        tacAdjustment +
        paymentAdjustment +
        (breakdown.components?.waitingTimeCost ?? 0) +
        custosDescargaMemoria);
  const taxasMarkupMemoria = breakdown.components?.conditionalFeesTotal ?? 0;
  const formacaoAllIn = Math.max(0, totalClienteBruto - custosDiretos);
  const receitaLiquidaMemoria =
    breakdown.profitability?.receitaLiquida ??
    totalClienteBruto - (breakdown.totals.totalImpostos ?? 0);

  const breakdownVersion = breakdown.version ?? 'legacy';
  const isV5 = breakdownVersion.startsWith('5.');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={isV5 ? 'default' : 'secondary'} className="text-[10px]">
            {isV5 ? 'v5 risk-aware' : `v4 (${breakdownVersion})`}
          </Badge>
          {breakdown.calculatedAt && (
            <span className="text-[10px] text-muted-foreground">
              {new Date(breakdown.calculatedAt).toLocaleString('pt-BR')}
            </span>
          )}
        </div>
        {!isV5 && onRecalculate && (
          <Button variant="outline" size="sm" onClick={onRecalculate} disabled={isRecalculating}>
            {isRecalculating ? 'Recalculando...' : 'Recalcular (v5)'}
          </Button>
        )}
      </div>
      <Tabs defaultValue="memoria" className="w-full">
        <TabsList
          className={cn('grid w-full', hasFees ? 'grid-cols-4' : 'grid-cols-3', 'overflow-x-auto')}
        >
          <TabsTrigger
            value="memoria"
            id="tab-composicao-memoria"
            data-testid="tab-composicao-memoria"
          >
            Memória
          </TabsTrigger>
          <TabsTrigger value="dre" id="tab-composicao-dre" data-testid="tab-composicao-dre">
            DRE
          </TabsTrigger>
          <TabsTrigger
            value="custos"
            id="tab-composicao-custos"
            data-testid="tab-composicao-custos"
          >
            Custos
          </TabsTrigger>
          {hasFees && (
            <TabsTrigger value="taxas" id="tab-composicao-taxas" data-testid="tab-composicao-taxas">
              Taxas
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="memoria" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="font-semibold">
                    Item
                  </TableHead>
                  <TableHead scope="col" className="text-right font-semibold">
                    Valor
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Grupo: Subtotal Motorista (Base de Negociação) */}
                {anttFloorApplied && fretePesoOriginal > 0 && (
                  <TableRow>
                    <TableCell
                      data-field="frete_peso_tabela"
                      data-testid="row-frete-peso-tabela-label"
                      className="text-muted-foreground line-through"
                    >
                      Frete Peso (tabela)
                    </TableCell>
                    <TableCell
                      data-field="frete_peso_tabela_valor"
                      data-testid="row-frete-peso-tabela-value"
                      className="text-right font-medium tabular-nums text-muted-foreground line-through"
                    >
                      {formatCurrency(fretePesoOriginal)}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell
                    data-field="frete_base"
                    data-testid="row-frete-base-label"
                    className="text-muted-foreground"
                  >
                    Frete Base
                    {anttFloorApplied && (
                      <span className="ml-1 text-xs text-amber-600 font-medium">
                        (Piso ANTT aplicado — MP 1.343/2026)
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    data-field="frete_base_valor"
                    data-testid="row-frete-base-value"
                    className="text-right font-medium tabular-nums"
                  >
                    {formatCurrency(baseFreight)}
                  </TableCell>
                </TableRow>
                {pedagioMemoria > 0 && (
                  <TableRow>
                    <TableCell
                      data-field="pedagio"
                      data-testid="row-pedagio-label"
                      className="text-muted-foreground"
                    >
                      (+) Pedágio
                    </TableCell>
                    <TableCell
                      data-field="pedagio_valor"
                      data-testid="row-pedagio-value"
                      className="text-right font-medium tabular-nums"
                    >
                      {formatCurrency(pedagioMemoria)}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="border-t bg-primary/5">
                  <TableCell
                    data-field="subtotal_motorista"
                    data-testid="row-subtotal-motorista-label"
                    className="font-semibold text-primary"
                  >
                    <span className="block">Subtotal Motorista (Base de Negociação)</span>
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      Frete + pedágio — referência com motorista, não soma ao ALL-IN
                    </span>
                  </TableCell>
                  <TableCell
                    data-field="subtotal_motorista_valor"
                    data-testid="row-subtotal-motorista-value"
                    className="text-right font-bold tabular-nums text-primary"
                  >
                    {formatCurrency(subtotalMotorista)}
                  </TableCell>
                </TableRow>
                {composicaoRows.map((r) => (
                  <TableRow key={r.label}>
                    <TableCell
                      data-field={r.field}
                      data-testid={`row-${r.field}-label`}
                      className="text-muted-foreground"
                    >
                      {r.label}
                    </TableCell>
                    <TableCell
                      data-field={`${r.field}_valor`}
                      data-testid={`row-${r.field}-value`}
                      className="text-right font-medium tabular-nums"
                    >
                      {formatCurrency(r.value)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t bg-muted/30">
                  <TableCell
                    data-field="custos_diretos"
                    data-testid="row-custos-diretos-label"
                    className="font-semibold"
                  >
                    Custos diretos (base do gross-up)
                  </TableCell>
                  <TableCell
                    data-field="custos_diretos_valor"
                    data-testid="row-custos-diretos-value"
                    className="text-right font-semibold tabular-nums"
                  >
                    {formatCurrency(custosDiretos)}
                  </TableCell>
                </TableRow>
                {taxasMarkupMemoria > 0 && (
                  <TableRow>
                    <TableCell
                      data-field="conditional_fees"
                      data-testid="row-conditional_fees-label"
                      className="text-muted-foreground"
                    >
                      <span className="block">Taxas condicionais (markup)</span>
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        Receita — fora do divisor; não é repasse 1:1
                      </span>
                    </TableCell>
                    <TableCell
                      data-field="conditional_fees_valor"
                      data-testid="row-conditional_fees-value"
                      className="text-right font-medium tabular-nums"
                    >
                      {formatCurrency(taxasMarkupMemoria)}
                    </TableCell>
                  </TableRow>
                )}
                {formacaoAllIn > 0.01 && (
                  <TableRow>
                    <TableCell
                      data-field="formacao_all_in"
                      data-testid="row-formacao-all-in-label"
                      className="text-muted-foreground"
                    >
                      <span className="block">(+) Formação ALL-IN</span>
                      <span className="block text-[10px]">
                        Overhead, margem alvo e impostos no divisor — não é segunda vez o frete
                      </span>
                    </TableCell>
                    <TableCell
                      data-field="formacao_all_in_valor"
                      data-testid="row-formacao-all-in-value"
                      className="text-right font-medium tabular-nums"
                    >
                      {formatCurrency(formacaoAllIn)}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="bg-primary/5">
                  <TableCell
                    data-field="faturamento_bruto"
                    data-testid="row-faturamento-bruto-label"
                    className="font-semibold text-primary"
                  >
                    Faturamento bruto (Total Cliente ALL-IN)
                  </TableCell>
                  <TableCell
                    data-field="faturamento_bruto_valor"
                    data-testid="row-faturamento-bruto-value"
                    className="text-right font-bold tabular-nums text-primary"
                  >
                    {formatCurrency(totalClienteBruto)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={2} className="py-1 text-[10px] text-muted-foreground">
                    Destaque tributário (valores já embutidos no ALL-IN por gross-up)
                  </TableCell>
                </TableRow>
                {isLucroPresumido ? (
                  <>
                    <TableRow>
                      <TableCell
                        data-field="pis"
                        data-testid="row-pis-label"
                        className="text-muted-foreground"
                      >
                        PIS ({breakdown.rates?.pisPercent?.toFixed(2) ?? 0}%)
                      </TableCell>
                      <TableCell
                        data-field="pis_valor"
                        data-testid="row-pis-value"
                        className="text-right tabular-nums"
                      >
                        {formatCurrency(breakdown.totals.pis ?? 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell
                        data-field="cofins"
                        data-testid="row-cofins-label"
                        className="text-muted-foreground"
                      >
                        COFINS ({breakdown.rates?.cofinsPercent?.toFixed(2) ?? 0}%)
                      </TableCell>
                      <TableCell
                        data-field="cofins_valor"
                        data-testid="row-cofins-value"
                        className="text-right tabular-nums"
                      >
                        {formatCurrency(breakdown.totals.cofins ?? 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell
                        data-field="irpj"
                        data-testid="row-irpj-label"
                        className="text-muted-foreground"
                      >
                        IRPJ provisao ({breakdown.rates?.irpjPercent?.toFixed(2) ?? 0}%)
                      </TableCell>
                      <TableCell
                        data-field="irpj_valor"
                        data-testid="row-irpj-value"
                        className="text-right tabular-nums"
                      >
                        {formatCurrency(breakdown.totals.irpj ?? 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell
                        data-field="csll"
                        data-testid="row-csll-label"
                        className="text-muted-foreground"
                      >
                        CSLL provisao ({breakdown.rates?.csllPercent?.toFixed(2) ?? 0}%)
                      </TableCell>
                      <TableCell
                        data-field="csll_valor"
                        data-testid="row-csll-value"
                        className="text-right tabular-nums"
                      >
                        {formatCurrency(breakdown.totals.csll ?? 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell
                        data-field="icms"
                        data-testid="row-icms-label"
                        className="text-muted-foreground"
                      >
                        ICMS ({breakdown.rates?.icmsPercent?.toFixed(2) ?? 0}%)
                      </TableCell>
                      <TableCell
                        data-field="icms_valor"
                        data-testid="row-icms-value"
                        className="text-right tabular-nums"
                      >
                        {formatCurrency(breakdown.totals.icms ?? 0)}
                      </TableCell>
                    </TableRow>
                  </>
                ) : (
                  <>
                    <TableRow>
                      <TableCell
                        data-field="provisionamento_das"
                        data-testid="row-provisionamento-das-label"
                        className="text-muted-foreground"
                      >
                        Provisionamento DAS ({breakdown.rates?.dasPercent?.toFixed(2) ?? 0}%)
                      </TableCell>
                      <TableCell
                        data-field="provisionamento_das_valor"
                        data-testid="row-provisionamento-das-value"
                        className="text-right tabular-nums"
                      >
                        {formatCurrency(breakdown.totals.das || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell
                        data-field="icms"
                        data-testid="row-icms-label"
                        className="text-muted-foreground"
                      >
                        ICMS (
                        {isSimplesNacional ? '0' : (breakdown.rates?.icmsPercent?.toFixed(2) ?? 0)}
                        %)
                      </TableCell>
                      <TableCell
                        data-field="icms_valor"
                        data-testid="row-icms-value"
                        className="text-right tabular-nums"
                      >
                        {formatCurrency(isSimplesNacional ? 0 : breakdown.totals.icms || 0)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
                <TableRow>
                  <TableCell
                    data-field="receita_liquida"
                    data-testid="row-receita-liquida-label"
                    className="font-medium"
                  >
                    Receita líquida (após impostos)
                  </TableCell>
                  <TableCell
                    data-field="receita_liquida_valor"
                    data-testid="row-receita-liquida-value"
                    className="text-right font-medium tabular-nums"
                  >
                    {formatCurrency(receitaLiquidaMemoria)}
                  </TableCell>
                </TableRow>
                {discountValue > 0 && (
                  <TableRow className="bg-orange-50/50 dark:bg-orange-900/10">
                    <TableCell
                      data-field="desconto_comercial"
                      data-testid="row-desconto-comercial-label"
                      className="text-orange-700 dark:text-orange-400"
                    >
                      (-) Desconto Comercial
                    </TableCell>
                    <TableCell
                      data-field="desconto_comercial_valor"
                      data-testid="row-desconto-comercial-value"
                      className="text-right font-medium tabular-nums text-orange-700 dark:text-orange-400"
                    >
                      -{formatCurrency(discountValue)}
                    </TableCell>
                  </TableRow>
                )}
                {discountValue > 0 && (
                  <TableRow className="bg-primary/5">
                    <TableCell
                      data-field="total_cliente"
                      data-testid="row-total-cliente-label"
                      className="font-semibold text-primary"
                    >
                      Total Cliente (com desconto)
                    </TableCell>
                    <TableCell
                      data-field="total_cliente_valor"
                      data-testid="row-total-cliente-value"
                      className="text-right font-bold text-primary tabular-nums"
                    >
                      {formatCurrency(totalCliente)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="dre" className="mt-4 space-y-4">
          {regimeFiscal && (
            <Alert
              className={cn(
                'mb-4',
                regimeFiscal === 'excesso_sublimite'
                  ? 'bg-warning/10 border-warning/20'
                  : regimeFiscal === 'normal' && !isLucroPresumido
                    ? 'bg-amber-500/10 border-amber-500/20'
                    : 'bg-primary/10 border-primary/20'
              )}
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Regime Fiscal Aplicado</AlertTitle>
              <AlertDescription>
                {regimeFiscal === 'simples_nacional' &&
                  'Simples Nacional: ICMS incluído na DAS (não soma ao divisor Gross-up).'}
                {regimeFiscal === 'excesso_sublimite' &&
                  'Excesso de Sublimite: ICMS calculado separadamente (Cálculo por Dentro).'}
                {regimeFiscal === 'lucro_presumido' &&
                  'Lucro Presumido: PIS/COFINS destacados na NF. IRPJ/CSLL provisionados. ICMS por UF.'}
                {regimeFiscal === 'normal' &&
                  (isLucroPresumido
                    ? 'Memória com tributos federais (PIS/COFINS/IRPJ/CSLL); recalcule para alinhar o rótulo do regime.'
                    : 'Regime Normal: ICMS separado. Se a Central de Regras está em Lucro Presumido, use Salvar memória para atualizar esta cotação.')}
              </AlertDescription>
            </Alert>
          )}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="font-semibold">
                    Item
                  </TableHead>
                  <TableHead scope="col" className="text-right font-semibold">
                    Valor
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-primary/5">
                  <TableCell className="font-semibold text-primary">
                    (+) Faturamento Bruto (Total Cliente)
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums text-primary">
                    {formatCurrency(totalCliente)}
                  </TableCell>
                </TableRow>
                <TableRow className="bg-muted/10">
                  <TableCell className="font-semibold">(-) Impostos</TableCell>
                  <TableCell />
                </TableRow>
                {isLucroPresumido ? (
                  <>
                    <TableRow>
                      <TableCell className="pl-8 text-muted-foreground">
                        • PIS ({breakdown.rates?.pisPercent?.toFixed(2) ?? 0}%)
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">
                        -{formatCurrency(breakdown.totals.pis ?? 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8 text-muted-foreground">
                        • COFINS ({breakdown.rates?.cofinsPercent?.toFixed(2) ?? 0}%)
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">
                        -{formatCurrency(breakdown.totals.cofins ?? 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8 text-muted-foreground">
                        • ICMS Estadual ({breakdown.rates?.icmsPercent?.toFixed(2) ?? 0}%)
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">
                        -{formatCurrency(breakdown.totals.icms ?? 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8 text-muted-foreground">
                        • IRPJ provisao ({breakdown.rates?.irpjPercent?.toFixed(2) ?? 0}%)
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">
                        -{formatCurrency(breakdown.totals.irpj ?? 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8 text-muted-foreground">
                        • CSLL provisao ({breakdown.rates?.csllPercent?.toFixed(2) ?? 0}%)
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">
                        -{formatCurrency(breakdown.totals.csll ?? 0)}
                      </TableCell>
                    </TableRow>
                  </>
                ) : (
                  <>
                    <TableRow>
                      <TableCell className="pl-8 text-muted-foreground">
                        • DAS {regimeFiscal === 'excesso_sublimite' ? 'Federal ' : ''}(
                        {breakdown.rates?.dasPercent?.toFixed(2) ?? 0}%)
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">
                        -{formatCurrency(breakdown.totals.das ?? 0)}
                      </TableCell>
                    </TableRow>
                    {regimeFiscal !== 'simples_nacional' && (
                      <TableRow>
                        <TableCell className="pl-8 text-muted-foreground">
                          • ICMS Estadual ({breakdown.rates?.icmsPercent?.toFixed(2) ?? 0}%)
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">
                          -{formatCurrency(breakdown.totals.icms ?? 0)}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
                <TableRow className="border-t bg-muted/30">
                  <TableCell className="font-semibold">(=) Receita Líquida</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {formatCurrency(receitaLiquida)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground">
                    (-) Overhead ({breakdown.rates?.overheadPercent?.toFixed(2) ?? 0}%)
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">
                    -{formatCurrency(overhead)}
                  </TableCell>
                </TableRow>
                {/* Repasse de Risco (receita repassada ao cliente) */}
                {(grisValue > 0 || tsoValue > 0 || rctrcValue > 0 || adValoremValue > 0) && (
                  <>
                    <TableRow className="bg-emerald-50/50 dark:bg-emerald-900/10 border-l-4 border-l-emerald-500">
                      <TableCell className="font-semibold">
                        (+) Repasse de Risco (já no faturamento)
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(grisValue + tsoValue + rctrcValue + adValoremValue)}
                      </TableCell>
                    </TableRow>
                    {adValoremValue > 0 && (
                      <TableRow>
                        <TableCell className="pl-8 text-muted-foreground">
                          • Ad Valorem ({breakdown.rates?.adValoremPercent?.toFixed(3) ?? '0.030'}%)
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(adValoremValue)}
                        </TableCell>
                      </TableRow>
                    )}
                    {grisValue > 0 && (
                      <TableRow>
                        <TableCell className="pl-8 text-muted-foreground">
                          • GRIS ({breakdown.rates?.grisPercent?.toFixed(2) ?? 0}%)
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(grisValue)}
                        </TableCell>
                      </TableRow>
                    )}
                    {tsoValue > 0 && (
                      <TableRow>
                        <TableCell className="pl-8 text-muted-foreground">
                          • TSO ({breakdown.rates?.tsoPercent?.toFixed(2) ?? 0}%)
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(tsoValue)}
                        </TableCell>
                      </TableRow>
                    )}
                    {rctrcValue > 0 && (
                      <TableRow>
                        <TableCell className="pl-8 text-muted-foreground">
                          • RCTR-C ({breakdown.rates?.costValuePercent?.toFixed(2) ?? 0}%)
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(rctrcValue)}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
                {/* Custos Diretos */}
                <TableRow className="bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-l-blue-500">
                  <TableCell className="font-semibold">(-) Custos Diretos</TableCell>
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell className="pl-8 text-muted-foreground">
                    • Custo Motorista (Piso ANTT / carreteiro)
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">
                    -{formatCurrency(custoMotoristaPisoAntt)}
                  </TableCell>
                </TableRow>
                {custoEfetivoMotorista > custoMotoristaPisoAntt + 0.01 && (
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground text-xs">
                      • Frete peso contratado (NTC, ref. gross-up)
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground text-xs">
                      {formatCurrency(custoEfetivoMotorista)}
                    </TableCell>
                  </TableRow>
                )}
                {pedagio > 0 && (
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground">• Pedágio</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      -{formatCurrency(pedagio)}
                    </TableCell>
                  </TableRow>
                )}
                {tdeValue > 0 && (
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground">• TDE (NTC)</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      -{formatCurrency(tdeValue)}
                    </TableCell>
                  </TableRow>
                )}
                {tearValue > 0 && (
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground">• TEAR (NTC)</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      -{formatCurrency(tearValue)}
                    </TableCell>
                  </TableRow>
                )}
                {aluguelMaquinasValue > 0 && (
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground">
                      • Aluguel de Máquinas
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      -{formatCurrency(aluguelMaquinasValue)}
                    </TableCell>
                  </TableRow>
                )}
                {custosDescarga > 0 && (
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground">• Carga e Descarga</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      -{formatCurrency(custosDescarga)}
                    </TableCell>
                  </TableRow>
                )}
                {/* Custos Reais de Risco (seguro) — prêmio, não repasse */}
                {(() => {
                  const risk =
                    breakdown.riskCosts?.total && breakdown.riskCosts.total > 0
                      ? breakdown.riskCosts
                      : estimateInsuranceRiskCosts(cargoValue);
                  if (risk.total <= 0) return null;
                  return (
                    <>
                      <TableRow className="bg-amber-50/50 dark:bg-amber-900/10 border-l-4 border-l-amber-500">
                        <TableCell className="font-semibold">
                          (-) Custos Reais de Risco (Seguro)
                        </TableCell>
                        <TableCell className="text-right font-bold tabular-nums text-destructive">
                          -{formatCurrency(risk.total)}
                        </TableCell>
                      </TableRow>
                      {risk.items.map((item) => (
                        <TableRow key={item.code}>
                          <TableCell className="pl-8 text-muted-foreground">
                            • {item.name}
                            {cargoValue > 0 ? ` (s/ ${formatCurrency(cargoValue)})` : ''}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-destructive">
                            -{formatCurrency(item.cost)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  );
                })()}
                <TableRow
                  className={cn(
                    'border-t-2',
                    isBelowTarget || resultadoLiquido < 0
                      ? 'bg-destructive/10'
                      : 'bg-green-500/10 dark:bg-green-500/5'
                  )}
                >
                  <TableCell className="text-lg font-bold">(=) Resultado Líquido</TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={isBelowTarget || resultadoLiquido < 0 ? 'destructive' : 'default'}
                      className="text-base px-3 py-1"
                    >
                      {formatCurrency(resultadoLiquido)}
                    </Badge>
                  </TableCell>
                </TableRow>
                {lucroAlvo != null && lucroAlvo > 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground">
                      Lucro alvo (gross-up {targetMarginPercent}% s/ custos diretos)
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(lucroAlvo)}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell className="font-semibold">
                    Margem Operacional (resultado ÷ faturamento)
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={isBelowTarget ? 'destructive' : 'default'}>
                      {margemPercent.toFixed(2)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          {isBelowTarget && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Abaixo do Mínimo Viável</AlertTitle>
              <AlertDescription>
                Margem de {margemPercent.toFixed(1)}% está abaixo do mínimo de {targetMarginPercent}
                %. Considere renegociar valor ou reduzir custos para viabilidade operacional.
              </AlertDescription>
            </Alert>
          )}
          {/* Nota de Auditoria Financeira */}
          <div className="mt-6 p-4 rounded-md bg-muted/50 border border-muted-foreground/10">
            <p className="text-[11px] leading-relaxed text-muted-foreground italic">
              <strong>Nota de Auditoria (DRE v5):</strong> Ad Valorem / GRIS / TSO / RCTR-C cobrados
              são <span className="font-semibold text-foreground">Repasse de Risco</span> (já no
              faturamento; não somam ao piso ANTT / carreteiro).{' '}
              <span className="font-semibold text-foreground">Custos Reais de Risco</span> = prêmio
              estimado (RCTR-C + RC-DC 0,015% cada s/ valor da carga). Resultado líquido = receita
              líquida − overhead − custos diretos − risco real. Lucro alvo = custos diretos ×{' '}
              {targetMarginPercent?.toFixed(0) ?? '—'}% (embutido no preço, separado).
            </p>
          </div>
          {breakdown.meta?.ltlMinWeightApplied && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Trava de 1 Tonelada Aplicada:</strong> Peso real informado foi{' '}
                {breakdown.meta.originalWeightKg} kg, mas o cálculo de custo usou o mínimo de 1.000
                kg para viabilidade operacional do fracionado.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="custos" className="mt-4 space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="font-semibold">
                    Custo
                  </TableHead>
                  <TableHead scope="col" className="text-right font-semibold">
                    Valor
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-muted-foreground">Piso ANTT (carreteiro)</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(pisoAnttTotal)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Carga e Descarga</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(custosDescarga)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          {hasAnttCalc && canManage && onSaveAntt && (
            <div className="p-3 rounded-lg bg-muted/30 border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Piso ANTT • Tabela A • Carga Geral
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {axesCount ?? '-'} eixos • {Number(kmDistance ?? 0).toLocaleString('pt-BR')} km
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Memória: ({Number(kmDistance ?? 0).toLocaleString('pt-BR')} ×{' '}
                {Number(anttRateCcd ?? 0).toFixed(4)}) + {Number(anttRateCc ?? 0).toFixed(2)}
              </p>
              <Button variant="outline" size="sm" onClick={onSaveAntt}>
                Salvar no breakdown
              </Button>
            </div>
          )}
          {!hasAnttCalc && (
            <p className="text-xs text-muted-foreground">
              Cadastre CCD/CC em ANTT Floor Rates e selecione veículo + KM.
            </p>
          )}
        </TabsContent>

        {hasFees && (
          <TabsContent value="taxas" className="mt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col" className="font-semibold">
                      Taxa
                    </TableHead>
                    <TableHead scope="col" className="text-right font-semibold">
                      Valor
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdown.conditionalFeesBreakdown &&
                    Object.entries(breakdown.conditionalFeesBreakdown).map(([feeId, value]) => {
                      const fee = conditionalFeesData?.find((f) => f.id === feeId);
                      if (!value) return null;
                      return (
                        <TableRow key={feeId}>
                          <TableCell className="text-muted-foreground flex items-center gap-1">
                            {fee ? fee.name : 'Taxa adicional'}
                            {fee && (
                              <Badge variant="outline" className="text-[10px] py-0">
                                {fee.code}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(value as number)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {(breakdown.components?.waitingTimeCost ?? 0) > 0 && (
                    <TableRow>
                      <TableCell className="text-muted-foreground">Estadia / Hora Parada</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(breakdown.components!.waitingTimeCost)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {breakdown.profitability && (
        <div
          className={
            isBelowTarget
              ? 'rounded-lg p-4 border bg-destructive/5 border-destructive/20'
              : 'rounded-lg p-4 border bg-success/5 border-success/20'
          }
        >
          <h5 className="font-semibold text-foreground mb-1 flex items-center gap-2 text-sm">
            <TrendingUp className="w-3.5 h-3.5" />
            Indicadores de rentabilidade
          </h5>
          <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
            Lotação: gross-up no piso ANTT (ceil(km)×CCD+CC). Repasse de risco = receita (já no
            FAT), fora do divisor. Resultado contábil deduz custos diretos + prêmio de seguro. Lucro
            alvo ({targetMarginPercent}% s/ CD) é meta embutida no preço — métrica aparte.
          </p>
          <div className="space-y-2 text-sm">
            {discountValue > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>(−) Desconto comercial</span>
                <span className="tabular-nums">−{formatCurrency(discountValue)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Receita líquida</span>
              <span className="font-medium tabular-nums">{formatCurrency(receitaLiquida)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>(−) Overhead ({breakdown.rates?.overheadPercent?.toFixed(0) ?? '—'}%)</span>
              <span className="tabular-nums">−{formatCurrency(overhead)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Margem de contribuição</span>
              <span className="font-medium tabular-nums">{formatCurrency(margemBruta)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground -mt-1">
              RL − overhead − frete peso (piso/golden) − serviços operacionais NTC (sem repasse)
            </p>
            <div className="flex justify-between items-center gap-2 pt-1 border-t border-border/60">
              <span className="font-semibold">Resultado líquido</span>
              <Badge
                variant={resultadoLiquido >= 0 ? 'default' : 'destructive'}
                className={resultadoLiquido >= 0 ? 'bg-success text-success-foreground' : ''}
              >
                {formatCurrency(resultadoLiquido)}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground -mt-1">
              Margem de contribuição − custos reais de risco (prêmio)
            </p>
            {lucroAlvo != null && lucroAlvo > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Lucro alvo (gross-up)</span>
                <span className="tabular-nums">{formatCurrency(lucroAlvo)}</span>
              </div>
            )}
            <div className="flex justify-between items-center gap-2">
              <span className="font-semibold">Margem operacional</span>
              <Badge
                variant={isBelowTarget ? 'destructive' : 'default'}
                className={!isBelowTarget ? 'bg-success text-success-foreground' : ''}
              >
                {margemPercent.toFixed(1)}%
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground -mt-1">
              Resultado líquido ÷ faturamento (após desconto)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
