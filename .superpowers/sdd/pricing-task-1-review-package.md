REVIEW PACKAGE Task 1\nBASE: working-tree (no commits)\n\n=== STAT ===\n M src/components/pricing/PricingParametersSection.tsx
 M src/components/pricing/PricingRulesTab.tsx
?? scripts/audit-pricing-dup-keys.ts
\n=== DIFF ===\ndiff --git a/src/components/pricing/PricingParametersSection.tsx b/src/components/pricing/PricingParametersSection.tsx
index 7b54774..e695aaf 100644
--- a/src/components/pricing/PricingParametersSection.tsx
+++ b/src/components/pricing/PricingParametersSection.tsx
@@ -30,20 +30,22 @@ import type { PricingParameter } from '@/types/pricing';
 
 interface PricingParametersSectionProps {
   includeKeys?: string[];
+  excludeKeys?: string[];
   title?: string;
 }
 
 export function PricingParametersSection({
   includeKeys,
+  excludeKeys,
   title,
 }: PricingParametersSectionProps = {}) {
   const { data: allParameters, isLoading } = usePricingParameters();
 
-  // Filter parameters by includeKeys if provided
-  const parameters =
-    includeKeys && includeKeys.length > 0
-      ? allParameters?.filter((p) => includeKeys.includes(p.key))
-      : allParameters;
+  const parameters = (allParameters ?? []).filter((p) => {
+    if (includeKeys?.length) return includeKeys.includes(p.key);
+    if (excludeKeys?.length) return !excludeKeys.includes(p.key);
+    return true;
+  });
   const updateMutation = useUpdatePricingParameter();
   const createMutation = useCreatePricingParameter();
   const deleteMutation = useDeletePricingParameter();
diff --git a/src/components/pricing/PricingRulesTab.tsx b/src/components/pricing/PricingRulesTab.tsx
index 5cd5374..dff73e3 100644
--- a/src/components/pricing/PricingRulesTab.tsx
+++ b/src/components/pricing/PricingRulesTab.tsx
@@ -6,7 +6,18 @@ import {
 } from '@/components/ui/accordion';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
-import { Settings2, Truck, Clock, Receipt, Fuel, Route, CreditCard, Percent } from 'lucide-react';
+import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
+import {
+  Settings2,
+  Truck,
+  Clock,
+  Receipt,
+  Fuel,
+  Route,
+  CreditCard,
+  Percent,
+  AlertCircle,
+} from 'lucide-react';
 
 import { PricingRulesManager } from './PricingRulesManager';
 import { PricingParametersSection } from './PricingParametersSection';
@@ -77,9 +88,14 @@ export function PricingRulesTab() {
               </div>
             </AccordionTrigger>
             <AccordionContent>
-              <PricingParametersSection
-                includeKeys={['das_percent', 'markup_percent', 'overhead_percent']}
-              />
+              <Alert>
+                <AlertCircle className="h-4 w-4" />
+                <AlertTitle>Editado na Central de Regras</AlertTitle>
+                <AlertDescription>
+                  DAS, Markup e Overhead agora vivem em Central de Regras (por metodologia). Não edite
+                  mais em pricing_parameters.
+                </AlertDescription>
+              </Alert>
             </AccordionContent>
           </AccordionItem>
 
@@ -95,7 +111,9 @@ export function PricingRulesTab() {
               </div>
             </AccordionTrigger>
             <AccordionContent>
-              <PricingParametersSection />
+              <PricingParametersSection
+                excludeKeys={['das_percent', 'markup_percent', 'overhead_percent']}
+              />
             </AccordionContent>
           </AccordionItem>
 
\n=== NEW FILE scripts/audit-pricing-dup-keys.ts ===\n/**
 * Lista keys presentes em pricing_parameters e pricing_rules_config com valores diferentes.
 * Uso: npx tsx scripts/audit-pricing-dup-keys.ts
 * Requer SUPABASE_URL + SUPABASE_SECRET_KEY (Hub) no env.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SECRET_KEY');
  process.exit(1);
}

const sb = createClient(url, key);
const OVERLAP = ['das_percent', 'markup_percent', 'overhead_percent', 'profit_margin_percent'];

async function main() {
  const [{ data: params }, { data: rules }] = await Promise.all([
    sb.from('pricing_parameters').select('key, value').in('key', OVERLAP),
    sb.from('pricing_rules_config').select('key, value, vehicle_type_id, is_active').in('key', OVERLAP),
  ]);
  console.log('pricing_parameters:', params);
  console.log('pricing_rules_config:', rules);
  for (const k of OVERLAP) {
    const p = params?.find((x) => x.key === k);
    const r = rules?.filter((x) => x.key === k && x.vehicle_type_id == null);
    console.log(`\n${k}: param=${p?.value ?? '—'} rules(global)=`, r?.map((x) => x.value));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
