"use client";

import * as React from "react";
import { NumericFormat, type NumericFormatProps } from "react-number-format";

import { cn } from "@/lib/utils";

/**
 * Shared base for our masked numeric inputs. We avoid `<input type="number">`
 * because it has terrible UX:
 *   · scroll wheel + arrow keys silently mutate the value
 *   · backspace doesn't clear a leading 0 the way users expect
 *   · the field accepts `e`, `+`, `-` and other "math" chars
 * react-number-format renders a text input under the hood so deletion,
 * selection and paste behave like any other field.
 *
 * Styling mirrors the `<Input>` primitive so these inputs slot into the
 * same form layouts without extra className overrides.
 */
const baseClassName =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm tabular-nums";

interface CountInputProps
  extends Omit<
    NumericFormatProps,
    | "value"
    | "onChange"
    | "onValueChange"
    | "displayType"
    | "thousandSeparator"
    | "decimalSeparator"
    | "decimalScale"
    | "prefix"
    | "allowNegative"
  > {
  /** Numeric value — `null` / `undefined` renders an empty field. */
  value: number | null | undefined;
  /** Fires with the parsed integer (or `null` when cleared). */
  onChange: (next: number | null) => void;
  /** Optional minimum — defaults to 0 to disallow negative counts. */
  min?: number;
  /** Optional maximum (enforced on commit). */
  max?: number;
  className?: string;
}

/**
 * Whole-number input — sessions, units, ages, etc. Allows the user to
 * clear the field without leaving a stray "0" behind, blocks negatives
 * and decimals, and emits `null` when empty so the form schema can
 * distinguish "unset" from "0".
 */
export function NumericInput({
  value,
  onChange,
  min = 0,
  max,
  className,
  ...rest
}: CountInputProps) {
  return (
    <NumericFormat
      value={value ?? ""}
      onValueChange={(values) => {
        const v = values.floatValue;
        if (v === undefined) {
          onChange(null);
          return;
        }
        if (typeof max === "number" && v > max) {
          onChange(max);
          return;
        }
        if (v < min) {
          onChange(min);
          return;
        }
        onChange(v);
      }}
      allowNegative={false}
      decimalScale={0}
      allowLeadingZeros={false}
      thousandSeparator={false}
      inputMode="numeric"
      className={cn(baseClassName, className)}
      {...rest}
    />
  );
}

interface CurrencyInputProps
  extends Omit<
    NumericFormatProps,
    | "value"
    | "onChange"
    | "onValueChange"
    | "displayType"
    | "thousandSeparator"
    | "decimalSeparator"
    | "decimalScale"
    | "prefix"
    | "allowNegative"
    | "fixedDecimalScale"
  > {
  /** Amount in major units (e.g. dollars). `null` renders empty. */
  value: number | null | undefined;
  onChange: (next: number | null) => void;
  /** Symbol shown to the left of the amount — defaults to `$ `. */
  prefix?: string;
  /** Decimal precision — defaults to 2 (cents). Pass 0 to mask integers. */
  decimalScale?: number;
  className?: string;
}

/**
 * Currency-masked input. Renders `$ 1.234,56` while the user types
 * (AR-style thousands `.` + decimals `,`), but emits a plain JS number to
 * the form. Clearing the field emits `null`, never `NaN`.
 *
 * Use this instead of `<input type="number">` for any monetary value.
 */
export function CurrencyInput({
  value,
  onChange,
  prefix = "$ ",
  decimalScale = 2,
  className,
  ...rest
}: CurrencyInputProps) {
  return (
    <NumericFormat
      value={value ?? ""}
      onValueChange={(values) => {
        const v = values.floatValue;
        onChange(v === undefined ? null : v);
      }}
      allowNegative={false}
      decimalScale={decimalScale}
      // AR locale: `.` for thousands, `,` for decimals.
      thousandSeparator="."
      decimalSeparator=","
      // Don't pad to 2 decimals while typing — only on blur via the
      // browser's normal display. Setting `fixedDecimalScale` would force
      // ".00" on every keystroke which fights the user.
      fixedDecimalScale={false}
      prefix={prefix}
      inputMode="decimal"
      className={cn(baseClassName, className)}
      {...rest}
    />
  );
}
