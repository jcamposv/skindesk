"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES } from "@/lib/currency";

/**
 * Headless currency picker. The component is purely controlled — no
 * persistence, no toasts, no transitions. Higher-level pieces
 * (CurrencySettingsCard, future onboarding wizard) own those.
 *
 * Keeping this presentational means the same picker can live in:
 * - Configuración (auto-saves to DB)
 * - Onboarding (writes to the wizard state)
 * - Any future modal that needs a one-off currency choice
 * without dragging server-action wiring around.
 */
export function CurrencySelect({
  value,
  onValueChange,
  disabled,
  triggerClassName,
}: {
  value: string;
  onValueChange: (next: string) => void;
  disabled?: boolean;
  triggerClassName?: string;
}) {
  return (
    <Select
      value={value}
      // base-ui's Select can clear to `null`; coerce to "" so the parent
      // only sees `string`. The settings card guards against the empty
      // case (it just won't trigger a save).
      onValueChange={(next) => onValueChange(next ?? "")}
      disabled={disabled}
    >
      <SelectTrigger
        className={triggerClassName ?? "h-10 w-full max-w-md"}
        aria-label="Moneda del negocio"
      >
        <SelectValue placeholder="Seleccioná moneda" />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (
          <SelectItem key={c.currencyCode} value={c.currencyCode}>
            <CurrencyOption
              flag={c.flag}
              countryName={c.countryName}
              currencyName={c.currencyName}
              currencyCode={c.currencyCode}
            />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Row layout shared by the trigger and the dropdown items. The flag is a
 * presentation-only emoji (no a11y role); the country + currency name is
 * the main label, code is a muted tail. Renaming this component would
 * cascade — keep it dumb and reusable.
 */
export function CurrencyOption({
  flag,
  countryName,
  currencyName,
  currencyCode,
}: {
  flag: string;
  countryName: string;
  currencyName: string;
  currencyCode: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-[13px]">
      <span aria-hidden className="text-[16px] leading-none">
        {flag}
      </span>
      <span className="min-w-0 truncate">
        <span className="font-medium text-foreground">{countryName}</span>
        <span className="text-muted-foreground"> — {currencyName}</span>
      </span>
      <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10.5px] font-semibold tracking-wider text-foreground/80">
        {currencyCode}
      </span>
    </span>
  );
}
