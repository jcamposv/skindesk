"use client";

import { Controller, useFormContext, type FieldValues } from "react-hook-form";

import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { StaffMember } from "@/services/staff.service";

import { ProfesionalSelect } from "../profesional-select";
import { FREQUENCY_LABEL, type FrequencyKey } from "../types";

interface Step3GlobalProps {
  staff: StaffMember[];
}

/**
 * The "global" service config row — present in every step 3 form regardless
 * of service type. Holds the metadata that lives on the AssignedService
 * (start date, total sessions, frequency, etc.). State is owned by the
 * wizard's RHF form via `useFormContext`; all fields are root-level on the
 * wizard schema (no path prefix).
 */
export function Step3Global({ staff }: Step3GlobalProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useFormContext<FieldValues & any>();

  return (
    <div className="grid gap-3 rounded-xl border bg-card p-4">
      <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
        Configuración general del servicio
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-medium text-muted-foreground">
                Nombre del servicio
              </FormLabel>
              <Input
                value={(field.value as string) ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                placeholder="ej. Antiedad + LED"
                className="h-9"
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <Controller
          control={form.control}
          name="professionalId"
          render={({ field }) => (
            <ProfesionalSelect
              label="Profesional responsable"
              staff={staff}
              value={{
                professionalId: field.value as string | null,
                professionalLabel:
                  (form.watch("professionalLabel") as string) ?? "",
              }}
              onChange={(next) => {
                field.onChange(next.professionalId);
                form.setValue("professionalLabel", next.professionalLabel, {
                  shouldDirty: true,
                });
              }}
            />
          )}
        />

        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-medium text-muted-foreground">
                Fecha de inicio
              </FormLabel>
              <Input
                type="date"
                value={(field.value as string) ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                className="h-9"
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="nextAppointment"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-medium text-muted-foreground">
                Próxima cita sugerida
              </FormLabel>
              <Input
                type="date"
                value={(field.value as string) ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                className="h-9"
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="totalSessions"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-medium text-muted-foreground">
                Total de sesiones
              </FormLabel>
              <Input
                type="number"
                min={1}
                max={50}
                value={(field.value as number) ?? 1}
                onChange={(e) =>
                  field.onChange(Math.max(1, Number(e.target.value) || 1))
                }
                className="h-9"
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="packageAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-medium text-muted-foreground">
                Monto del paquete (USD)
              </FormLabel>
              <Input
                type="number"
                min={0}
                value={(field.value as number) ?? 0}
                onChange={(e) =>
                  field.onChange(Math.max(0, Number(e.target.value) || 0))
                }
                className="h-9"
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="frequency"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel className="text-[11px] font-medium text-muted-foreground">
                Frecuencia
              </FormLabel>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(FREQUENCY_LABEL) as FrequencyKey[]).map(
                  (freq) => {
                    const isActive = field.value === freq;
                    return (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => field.onChange(freq)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                          isActive
                            ? "border-[#BB7154] bg-[#F6E0D6] text-[#8C4A30]"
                            : "border-border/60 bg-card text-muted-foreground hover:border-[#BB7154]/40",
                        )}
                      >
                        {FREQUENCY_LABEL[freq]}
                      </button>
                    );
                  },
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel className="text-[11px] font-medium text-muted-foreground">
                Notas internas
              </FormLabel>
              <textarea
                value={(field.value as string) ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                rows={2}
                placeholder="Consideraciones, alergias, contraindicaciones…"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
