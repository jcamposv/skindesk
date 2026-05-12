"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CheckCircle2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/numeric-input";
import { cn } from "@/lib/utils";

import {
  paymentRegisterSchema,
  type PaymentRegisterInput,
} from "@/schemas/pagos.schema";
import type { AssignedService } from "@/components/clientes/servicios/types";

import { useMoney } from "@/components/providers/currency-provider";
import {
  METHOD_LABEL,
  type PaymentMethod,
  type PaymentPlanSummary,
} from "./types";

const METHODS: PaymentMethod[] = [
  "efectivo",
  "transferencia",
  "tarjeta",
  "otro",
];

interface RegisterPaymentDialogProps {
  /** When non-null, dialog is open for this service. */
  service: AssignedService | null;
  plan: PaymentPlanSummary | null;
  onClose: () => void;
  onSubmit: (
    servicioId: string,
    input: PaymentRegisterInput,
  ) => void | Promise<void>;
  /** Parent passes the action's pending state — disables the submit
   *  button so the user doesn't double-fire while the server roundtrip
   *  is in flight. */
  saving?: boolean;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function RegisterPaymentDialog({
  service,
  plan,
  onClose,
  onSubmit,
  saving = false,
}: RegisterPaymentDialogProps) {
  const open = service != null && plan != null;
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-1rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/10 outline-none",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
        >
          {open ? (
            <RegisterPaymentBody
              service={service}
              plan={plan}
              onClose={onClose}
              onSubmit={onSubmit}
              saving={saving}
            />
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}

function RegisterPaymentBody({
  service,
  plan,
  onClose,
  onSubmit,
  saving,
}: {
  service: AssignedService;
  plan: PaymentPlanSummary;
  onClose: () => void;
  onSubmit: (
    servicioId: string,
    input: PaymentRegisterInput,
  ) => void | Promise<void>;
  saving: boolean;
}) {
  const { formatExact, symbol, descriptor } = useMoney();
  // Loose generic — zod's `.default()` makes input/output diverge and the
  // resolver type stops aligning. Schema enforces shape at runtime; the
  // values cast in `onValid` brings the well-formed shape back.
  const form = useForm({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(paymentRegisterSchema) as any,
    defaultValues: {
      // Pre-fill with the outstanding balance — most common case is the
      // profesional cobra el saldo restante en una sola entrega.
      amount: plan.balance > 0 ? plan.balance : 0,
      method: "efectivo",
      paidAt: todayISO(),
      concept: "",
      notes: "",
    },
  });

  async function onValid(values: unknown) {
    await Promise.resolve(
      onSubmit(service.id, values as PaymentRegisterInput),
    );
    onClose();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onValid)} className="flex flex-col">
        <header className="flex items-start justify-between gap-3 border-b px-5 pt-4 pb-3">
          <div className="min-w-0">
            <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
              Registrar pago
            </p>
            <DialogPrimitive.Title className="font-heading text-base font-medium tracking-tight">
              {service.name}
            </DialogPrimitive.Title>
            <p className="truncate text-[12px] text-muted-foreground">
              Saldo pendiente:{" "}
              <span className="font-semibold text-foreground">
                {formatExact(plan.balance)}
              </span>{" "}
              · paquete {formatExact(plan.totalAmount)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <XIcon className="size-4" />
          </button>
        </header>

        <div className="grid gap-4 px-5 py-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] font-medium text-muted-foreground">
                  Monto cobrado
                </FormLabel>
                <CurrencyInput
                  value={(field.value as number) ?? null}
                  onChange={(n) => field.onChange(n ?? 0)}
                  prefix={`${symbol} `}
                  locale={descriptor.locale}
                  placeholder={`${symbol} 0${descriptor.locale.startsWith("en") ? ".00" : ",00"}`}
                  className="h-10"
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="method"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] font-medium text-muted-foreground">
                  Método de pago
                </FormLabel>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {METHODS.map((m) => {
                    const isActive = field.value === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => field.onChange(m)}
                        className={cn(
                          "rounded-md border px-2 py-1.5 text-[12px] font-medium transition-colors",
                          isActive
                            ? "border-[#BB7154] bg-[#F6E0D6] text-[#8C4A30]"
                            : "border-border/60 bg-card text-muted-foreground hover:border-[#BB7154]/40",
                        )}
                      >
                        {METHOD_LABEL[m]}
                      </button>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="paidAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-medium text-muted-foreground">
                    Fecha del pago
                  </FormLabel>
                  <Input
                    type="date"
                    value={(field.value as string) ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="h-10"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="concept"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-medium text-muted-foreground">
                    Concepto (opcional)
                  </FormLabel>
                  <Input
                    value={(field.value as string) ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    placeholder="Seña, 1ra cuota, saldo final…"
                    className="h-10"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] font-medium text-muted-foreground">
                  Notas internas (opcional)
                </FormLabel>
                <textarea
                  value={(field.value as string) ?? ""}
                  onChange={(e) => field.onChange(e.target.value)}
                  rows={2}
                  placeholder="Detalle interno, comprobante, referencia…"
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <footer className="flex items-center justify-between gap-2 border-t bg-card/80 px-5 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="gap-1.5"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={saving}
            className="gap-1.5 bg-[#5C6E6C] text-white shadow-sm hover:bg-[#4F605C]"
          >
            <CheckCircle2Icon className="size-3.5" />
            {saving ? "Guardando…" : "Registrar pago"}
          </Button>
        </footer>
      </form>
    </Form>
  );
}
