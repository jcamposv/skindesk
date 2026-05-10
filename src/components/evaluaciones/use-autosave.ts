"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved";

interface AutosaveOptions<T extends FieldValues> {
  form: UseFormReturn<T>;
  /** Truthy value enables autosave; pass null/undefined/false while the
   *  record is still loading or there's nothing to save against. */
  enabled?: boolean | string | null | undefined;
  /** Called with the latest form values; should persist somewhere durable. */
  onSave: (values: T) => void | Promise<void>;
  /** Debounce ms for change-driven saves. Default 800. */
  debounceMs?: number;
  /** Background heartbeat ms. Default 30000 (30s). */
  heartbeatMs?: number;
}

/**
 * Persists form values automatically:
 *  - On every change, debounce N ms then save.
 *  - Plus a periodic heartbeat as a safety net.
 *
 * Generic over the form value shape so it can drive any RHF form (cliente
 * datos personales, evaluación clínica, etc).
 */
export function useAutosave<T extends FieldValues>({
  form,
  enabled = true,
  onSave,
  debounceMs = 800,
  heartbeatMs = 30000,
}: AutosaveOptions<T>): {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  /** Force-save now (e.g. from a "Guardar ahora" button). */
  saveNow: () => void;
} {
  const isEnabled = Boolean(enabled);
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Stable refs to mutable callbacks so subscriptions don't bounce.
  const onSaveRef = useRef(onSave);
  const formRef = useRef(form);
  const dirtyRef = useRef(false);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const commitSave = useCallback(() => {
    if (!isEnabled) return;
    setStatus("saving");
    try {
      const values = formRef.current.getValues();
      const result = onSaveRef.current(values);
      // Support both sync and async onSave.
      Promise.resolve(result)
        .then(() => {
          dirtyRef.current = false;
          setStatus("saved");
          setLastSavedAt(new Date());
        })
        .catch(() => {
          setStatus("dirty");
        });
    } catch {
      setStatus("dirty");
    }
  }, [isEnabled]);

  // Subscribe to form changes; debounce save. RHF emits watch events for
  // both native input changes AND programmatic `setValue(...)` calls (used
  // heavily by chip toggles in the wizard steps), so we DON'T filter by
  // `info.type` — both should drive autosave.
  //
  // The infinite-loop variant we hit when calling `form.reset(values)` in
  // an `onSave` callback was fixed at the call site instead: nothing in
  // this codebase resets the form after a successful save, so the watch
  // never re-fires from our own bookkeeping.
  useEffect(() => {
    if (!isEnabled) return;
    const subscription = formRef.current.watch(() => {
      dirtyRef.current = true;
      setStatus("dirty");
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(commitSave, debounceMs);
    });
    return () => {
      subscription.unsubscribe();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [isEnabled, debounceMs, commitSave]);

  // Heartbeat: save every Nms if dirty.
  useEffect(() => {
    if (!isEnabled) return;
    heartbeatTimerRef.current = setInterval(() => {
      if (dirtyRef.current) commitSave();
    }, heartbeatMs);
    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [isEnabled, heartbeatMs, commitSave]);

  return { status, lastSavedAt, saveNow: commitSave };
}
