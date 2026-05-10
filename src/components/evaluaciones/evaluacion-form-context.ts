"use client";

import { createContext, useContext } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { Evaluacion } from "@/types/evaluacion";

/**
 * Form values handled by the evaluación. The five top-level sections of
 * `Evaluacion` minus the metadata (id, status, timestamps), since those
 * live on the row, not on the form.
 */
export type EvaluacionFormValues = Pick<
  Evaluacion,
  "datos" | "anamnesis" | "habitos" | "diagnostico" | "plan"
>;

interface EvaluacionFormContextValue {
  form: UseFormReturn<EvaluacionFormValues>;
  /** Cliente bound to this evaluación. Surfaced for read-only displays. */
  cliente: {
    id: string;
    nombre: string;
    email?: string;
    avatarUrl?: string | null;
    birthDate?: string | null;
    lastAppointmentAt?: string | null;
  };
  /** Profesional running the form (logged-in user). */
  profesionalNombre: string;
}

export const EvaluacionFormContext =
  createContext<EvaluacionFormContextValue | null>(null);

export function useEvaluacionForm(): EvaluacionFormContextValue {
  const ctx = useContext(EvaluacionFormContext);
  if (!ctx) {
    throw new Error(
      "useEvaluacionForm must be used inside <EvaluacionTab>",
    );
  }
  return ctx;
}
