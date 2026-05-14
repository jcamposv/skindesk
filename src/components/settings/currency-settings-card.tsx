"use client";

import { useState, useTransition } from "react";
import { Globe2Icon } from "lucide-react";
import { toast } from "sonner";

import { updateTenantCurrencyAction } from "@/actions/settings.actions";
import {
  CurrencyOption,
  CurrencySelect,
} from "@/components/settings/currency-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney, getCurrency } from "@/lib/currency";

/** Sample amount for the live preview — large enough to exercise the
 *  thousand separator, with cents so users see the decimal style. */
const PREVIEW_AMOUNT = 1234.56;

/**
 * Tenant currency picker. Auto-saves on change — there's only one field
 * and it has no validation beyond the enum check, so an explicit submit
 * button would be friction. Optimistic state keeps the UI snappy while
 * the server action round-trips; a failed save rolls back.
 *
 * The card composes from existing primitives (Card / CurrencySelect /
 * CurrencyOption). Keeping the network glue here means the picker stays
 * presentational and reusable inside onboarding or modals.
 */
export function CurrencySettingsCard({
  initialCurrency,
  canEdit,
}: {
  initialCurrency: string;
  /** False for asistente / super_admin without a tenant. They still see
   *  the current value but the picker is disabled. */
  canEdit: boolean;
}) {
  const [currency, setCurrency] = useState(initialCurrency);
  const [isPending, startTransition] = useTransition();
  const descriptor = getCurrency(currency);

  function handleChange(next: string) {
    if (!next || next === currency) return;
    const previous = currency;
    setCurrency(next); // optimistic
    startTransition(async () => {
      const result = await updateTenantCurrencyAction(next);
      if (!result.success) {
        toast.error(result.message ?? "No se pudo actualizar la moneda.");
        setCurrency(previous);
        return;
      }
      const desc = getCurrency(result.data?.currency ?? next);
      toast.success(`Moneda actualizada · ${desc.currencyName}`, {
        description: `Todos los montos del negocio se muestran en ${desc.currencyCode}.`,
      });
    });
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe2Icon className="size-4 text-muted-foreground" />
          Moneda del negocio
        </CardTitle>
        <CardDescription>
          Define cómo se muestran los montos en todo SkinDesk: dashboard,
          plan de pagos, perfil de la clienta y el módulo de Pagos. No
          convierte importes: solo cambia el formato.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">
            Actual
          </span>
          <CurrencyOption
            flag={descriptor.flag}
            countryName={descriptor.countryName}
            currencyName={descriptor.currencyName}
            currencyCode={descriptor.currencyCode}
          />
        </div>

        <CurrencySelect
          value={currency}
          onValueChange={handleChange}
          disabled={!canEdit || isPending}
        />

        {/* Live preview: renders the picked currency immediately so the
            user can confirm separator + symbol style before navigating
            away. Reads the optimistic state, not the persisted value. */}
        <div className="flex items-center justify-between rounded-lg border border-dashed bg-muted/20 px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">
            Ejemplo
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatMoney(PREVIEW_AMOUNT, currency, {
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        {!canEdit ? (
          <p className="text-xs text-muted-foreground">
            Solo la profesional dueña del negocio puede cambiar esta
            configuración.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            El cambio se guarda automáticamente y se aplica a toda la
            organización.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
