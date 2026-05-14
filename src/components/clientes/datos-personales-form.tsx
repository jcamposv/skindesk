"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  HeartHandshakeIcon,
  MapPinIcon,
  PhoneIcon,
  StickyNoteIcon,
  UserIcon,
} from "lucide-react";

import { updateClientaAction } from "@/actions/clientes.actions";
import { useAutosave } from "@/components/evaluaciones/use-autosave";
import { AutosaveIndicator } from "@/components/shared/autosave-indicator";
import { SectionCard } from "@/components/shared/section-card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CLIENTE_STATUSES,
  CLIENTE_STATUS_LABELS,
  updateClientaSchema,
  type UpdateClientaInput,
} from "@/schemas/clientes.schema";
import type { ClienteDetail } from "@/services/clientes.service";

interface DatosPersonalesFormProps {
  cliente: ClienteDetail;
}

export function DatosPersonalesForm({ cliente }: DatosPersonalesFormProps) {
  const router = useRouter();

  const form = useForm<UpdateClientaInput>({
    resolver: zodResolver(updateClientaSchema),
    defaultValues: {
      fullName: cliente.profile.full_name ?? "",
      phone: cliente.profile.phone ?? "",
      birthDate: cliente.birth_date ?? "",
      address: cliente.address ?? "",
      occupation: cliente.occupation ?? "",
      civilStatus: cliente.civil_status ?? "",
      emergencyContactName: cliente.emergency_contact_name ?? "",
      emergencyContactPhone: cliente.emergency_contact_phone ?? "",
      referralSource: cliente.referral_source ?? "",
      status: cliente.status,
      notes: cliente.notes ?? "",
    },
  });

  const autosave = useAutosave<UpdateClientaInput>({
    form,
    enabled: cliente.id,
    onSave: async (values) => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(values)) {
        if (v != null) fd.append(k, String(v));
      }
      const result = await updateClientaAction(cliente.id, null, fd);

      if (!result.success) {
        toast.error(result.message ?? "No se pudieron guardar los cambios.");
        if (result.errors) {
          for (const [field, messages] of Object.entries(result.errors)) {
            const msg = messages?.[0];
            if (msg) {
              form.setError(field as keyof UpdateClientaInput, {
                type: "server",
                message: msg,
              });
            }
          }
        }
        // Throw so useAutosave keeps the form in `dirty` state.
        throw new Error("save_failed");
      }

      // We deliberately don't call `form.reset(values)` here — it would
      // dispatch a `reset` event on the watch subscription and trigger
      // another autosave, looping. The autosave hook tracks its own dirty
      // state independent of `formState.isDirty`.
      router.refresh();
    },
  });

  // Block tab close while there are unsaved or in-flight changes.
  useEffect(() => {
    const isPending = autosave.status === "dirty" || autosave.status === "saving";
    if (!isPending) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [autosave.status]);

  return (
    <Form {...form}>
      <form className="grid gap-5">
        {/* Sticky bar mirroring Evaluación: status + manual save fallback. */}
        <div className="sticky top-0 z-20 -mx-4 flex justify-end border-b border-border/60 bg-background/85 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <AutosaveIndicator
            status={autosave.status}
            lastSavedAt={autosave.lastSavedAt}
            onSaveNow={autosave.saveNow}
          />
        </div>

        {/* Identidad */}
        <SectionCard icon={UserIcon} title="Identidad">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre completo</FormLabel>
                <FormControl>
                  <Input className="h-10" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  className="h-10"
                  value={cliente.profile.email}
                  disabled
                />
              </FormControl>
              <p className="text-xs font-medium text-foreground/75">
                Para cambiar el email re-invitamos a la clienta — próximamente.
              </p>
            </FormItem>
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Celular</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      autoComplete="tel"
                      className="h-10"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="birthDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de nacimiento</FormLabel>
                  <FormControl>
                    <Input type="date" className="h-10" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="civilStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado civil</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Soltera / Casada / Otro"
                      className="h-10"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLIENTE_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {CLIENTE_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="occupation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ocupación</FormLabel>
                <FormControl>
                  <Input className="h-10" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </SectionCard>

        {/* Domicilio */}
        <SectionCard icon={MapPinIcon} title="Domicilio">
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dirección</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="street-address"
                    className="h-10"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </SectionCard>

        {/* Emergencia */}
        <SectionCard icon={PhoneIcon} title="Contacto de emergencia">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="emergencyContactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input className="h-10" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emergencyContactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input type="tel" className="h-10" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SectionCard>

        {/* Origen */}
        <SectionCard icon={HeartHandshakeIcon} title="Origen">
          <FormField
            control={form.control}
            name="referralSource"
            render={({ field }) => (
              <FormItem>
                <FormLabel>¿Cómo nos conoció?</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Instagram, recomendación, Google…"
                    className="h-10"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </SectionCard>

        {/* Notas */}
        <SectionCard icon={StickyNoteIcon} title="Notas internas">
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="sr-only">Notas</FormLabel>
                <FormControl>
                  <textarea
                    {...field}
                    rows={4}
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Tono de piel, preferencias, contraindicaciones rápidas…"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </SectionCard>
      </form>
    </Form>
  );
}

