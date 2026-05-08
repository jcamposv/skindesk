"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  CheckIcon,
  HeartHandshakeIcon,
  MapPinIcon,
  PhoneIcon,
  StickyNoteIcon,
  UserIcon,
} from "lucide-react";

import { updateClientaAction } from "@/actions/clientes.actions";
import { Button } from "@/components/ui/button";
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
  const [pending, startTransition] = useTransition();

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

  function onSubmit(values: UpdateClientaInput) {
    startTransition(async () => {
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
        return;
      }

      toast.success("Cambios guardados.");
      form.reset(values); // mark form as pristine again
      router.refresh();
    });
  }

  const isDirty = form.formState.isDirty;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
        {/* Identidad */}
        <Card icon={UserIcon} title="Identidad">
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
              <p className="text-[11px] text-muted-foreground">
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
        </Card>

        {/* Domicilio */}
        <Card icon={MapPinIcon} title="Domicilio">
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
        </Card>

        {/* Emergencia */}
        <Card icon={PhoneIcon} title="Contacto de emergencia">
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
        </Card>

        {/* Origen */}
        <Card icon={HeartHandshakeIcon} title="Origen">
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
        </Card>

        {/* Notas */}
        <Card icon={StickyNoteIcon} title="Notas internas">
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
        </Card>

        {/* Sticky save bar */}
        <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 rounded-2xl border bg-card/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <p className="mr-auto text-xs text-muted-foreground">
            {isDirty
              ? "Tenés cambios sin guardar"
              : "Sin cambios pendientes"}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!isDirty || pending}
            onClick={() => form.reset()}
          >
            Descartar
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!isDirty || pending}
            className="gap-1.5"
          >
            <CheckIcon className="size-4" />
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

interface CardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}

function Card({ icon: Icon, title, children }: CardProps) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <header className="mb-5 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-3.5" />
        </span>
        <h3 className="font-heading text-sm font-medium tracking-tight">
          {title}
        </h3>
      </header>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
