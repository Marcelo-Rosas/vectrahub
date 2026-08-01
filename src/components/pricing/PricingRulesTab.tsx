import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Settings2,
  Truck,
  Clock,
  Receipt,
  Fuel,
  Route,
  CreditCard,
  Percent,
  AlertCircle,
} from 'lucide-react';

import { PricingRulesManager } from './PricingRulesManager';
import { PricingParametersSection } from './PricingParametersSection';
import { VehicleTypesSection } from './VehicleTypesSection';
import { WaitingTimeRulesSection } from './WaitingTimeRulesSection';
import { ConditionalFeesSection } from './ConditionalFeesSection';
import { TacRatesSection } from './TacRatesSection';
import { TollRoutesSection } from './TollRoutesSection';
import { PaymentTermsSection } from './PaymentTermsSection';

import {
  usePricingParameters,
  useWaitingTimeRules,
  useConditionalFees,
  useTacRates,
  useTollRoutes,
  usePaymentTerms,
  usePricingRulesConfig,
} from '@/hooks/usePricingRules';
import { useVehicleTypesAdmin } from '@/hooks/useVehicleTypes';

export function PricingRulesTab() {
  const { data: parameters } = usePricingParameters();
  const { data: pricingRules } = usePricingRulesConfig(false);
  const { data: vehicleTypes } = useVehicleTypesAdmin();
  const { data: waitingRules } = useWaitingTimeRules();
  const { data: conditionalFees } = useConditionalFees(false);
  const { data: tacRates } = useTacRates();
  const { data: tollRoutes } = useTollRoutes();
  const { data: paymentTerms } = usePaymentTerms(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Regras de Precificação</CardTitle>
        <CardDescription>
          Gerencie parâmetros gerais, tipos de veículo, estadia, taxas condicionais, TAC, pedágios e
          prazos de pagamento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {/* Central de Regras de Precificação */}
          <AccordionItem value="pricing-rules-manager">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Percent className="h-5 w-5 text-muted-foreground" />
                <span>Central de Regras (Markup, DAS, ICMS, TDE/TEAR)</span>
                <Badge variant="secondary" className="ml-2">
                  {pricingRules?.length ?? 0} regras
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <PricingRulesManager />
            </AccordionContent>
          </AccordionItem>

          {/* Impostos e Margens */}
          <AccordionItem value="taxes-margins">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Percent className="h-5 w-5 text-muted-foreground" />
                <span>Impostos e Margens</span>
                <Badge variant="secondary" className="ml-2">
                  3 parâmetros
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Editado na Central de Regras</AlertTitle>
                <AlertDescription>
                  DAS, Markup e Overhead agora vivem em Central de Regras (por metodologia). Não
                  edite mais em pricing_parameters.
                </AlertDescription>
              </Alert>
            </AccordionContent>
          </AccordionItem>

          {/* Parâmetros Gerais */}
          <AccordionItem value="parameters">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Settings2 className="h-5 w-5 text-muted-foreground" />
                <span>Parâmetros Gerais</span>
                <Badge variant="secondary" className="ml-2">
                  {parameters?.length || 0}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <PricingParametersSection
                excludeKeys={['das_percent', 'markup_percent', 'overhead_percent']}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Tipos de Veículo */}
          <AccordionItem value="vehicles">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-muted-foreground" />
                <span>Tipos de Veículo</span>
                <Badge variant="secondary" className="ml-2">
                  {vehicleTypes?.filter((v) => v.active).length || 0} ativos
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <VehicleTypesSection />
            </AccordionContent>
          </AccordionItem>

          {/* Estadia / Hora Parada */}
          <AccordionItem value="waiting">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span>Estadia / Hora Parada</span>
                <Badge variant="secondary" className="ml-2">
                  {waitingRules?.length || 0} regras
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <WaitingTimeRulesSection />
            </AccordionContent>
          </AccordionItem>

          {/* Taxas Condicionais */}
          <AccordionItem value="fees">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Receipt className="h-5 w-5 text-muted-foreground" />
                <span>Taxas Condicionais</span>
                <Badge variant="secondary" className="ml-2">
                  {conditionalFees?.filter((f) => f.active).length || 0} ativas
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ConditionalFeesSection />
            </AccordionContent>
          </AccordionItem>

          {/* TAC (Ajuste Diesel) */}
          <AccordionItem value="tac">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Fuel className="h-5 w-5 text-muted-foreground" />
                <span>TAC (Ajuste Diesel)</span>
                <Badge variant="secondary" className="ml-2">
                  {tacRates?.length || 0} registros
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <TacRatesSection />
            </AccordionContent>
          </AccordionItem>

          {/* Pedágio por Rota */}
          <AccordionItem value="tolls">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Route className="h-5 w-5 text-muted-foreground" />
                <span>Pedágio por Rota</span>
                <Badge variant="secondary" className="ml-2">
                  {tollRoutes?.length || 0} rotas
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <TollRoutesSection />
            </AccordionContent>
          </AccordionItem>

          {/* Prazos de Pagamento */}
          <AccordionItem value="payment">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <span>Prazos de Pagamento</span>
                <Badge variant="secondary" className="ml-2">
                  {paymentTerms?.filter((t) => t.active).length || 0} ativos
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <PaymentTermsSection />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
