"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  CalendarIcon,
  HeartHandshakeIcon,
  PhoneIcon,
  UserIcon,
} from "lucide-react";

import { createClientaAction } from "@/actions/clientes.actions";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/constants";
import {
  createClientaSchema,
  type CreateClientaInput,
} from "@/schemas/clientes.schema";

/** Stable id so an external submit button (in the Sheet footer) can target
 *  the form via `form="..."`. */
export const CREATE_CLIENTA_FORM_ID = "create-cliente-form";

interface CreateClientaFormProps {
  /** Called after a successful create so the parent can close the Sheet. */
  onSuccess?: () => void;
  /** Lifted submission state so the Sheet footer button can disable itself. */
  onPendingChange?: (pending: boolean) => void;
}

const FORM_DEFAULTS: CreateClientaInput = {
  fullName: "",
  email: "",
  phone: "",
  birthDate: "",
  address: "",
  occupation: "",
  civilStatus: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  referralSource: "",
};

export function CreateClientaForm({
  onSuccess,
  onPendingChange,
}: CreateClientaFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<CreateClientaInput>({
    resolver: zodResolver(createClientaSchema),
    defaultValues: FORM_DEFAULTS,
  });

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  function onSubmit(values: CreateClientaInput) {
    startTransition(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(values)) {
        if (v != null && v !== "") fd.append(k, String(v));
      }
      const result = await createClientaAction(null, fd);

      if (!result.success) {
        toast.error(result.message ?? "No se pudo crear la clienta.");
        if (result.errors) {
          for (const [field, messages] of Object.entries(result.errors)) {
            const msg = messages?.[0];
            if (msg) {
              form.setError(field as keyof CreateClientaInput, {
                type: "server",
                message: msg,
              });
            }
          }
        }
        return;
      }

      toast.success(result.message ?? "Clienta creada.");
      onSuccess?.();
      const id = result.data?.clienteId;
      if (id) router.push(`${ROUTES.clientes}/${id}`);
      else router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form
        id={CREATE_CLIENTA_FORM_ID}
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-6"
      >
        {/* Sección 1 — identidad */}
        <Section
          title="Identidad"
          description="Lo mínimo para crear el portal de tu clienta."
          icon={UserIcon}
        >
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre completo *</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="name"
                    placeholder="María Gómez"
                    className="h-10"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="maria@example.com"
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
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Celular</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      autoComplete="tel"
                      placeholder="+54 11 5555 5555"
                      className="h-10"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <p className="-mt-1 text-xs text-muted-foreground">
            Le enviamos la invitación al email que ingreses.
          </p>
        </Section>

        {/* Sección 2 — datos personales */}
        <Section
          title="Datos personales"
          description="Útiles para personalizar el seguimiento."
          icon={CalendarIcon}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="birthDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de nacimiento</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      className="h-10"
                      {...field}
                      value={field.value ?? ""}
                    />
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
                      value={field.value ?? ""}
                    />
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
                  <Input
                    placeholder="Diseñadora gráfica"
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
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dirección</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="street-address"
                    placeholder="Av. Siempre Viva 742"
                    className="h-10"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        {/* Sección 3 — contacto de emergencia */}
        <Section
          title="Contacto de emergencia"
          description="Por si alguna vez se necesita."
          icon={PhoneIcon}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="emergencyContactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Carla Pérez"
                      className="h-10"
                      {...field}
                      value={field.value ?? ""}
                    />
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
                    <Input
                      type="tel"
                      placeholder="+54 11 4444 4444"
                      className="h-10"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Section>

        {/* Sección 4 — origen */}
        <Section
          title="¿Cómo nos conoció?"
          description="Nos ayuda a entender qué canales funcionan."
          icon={HeartHandshakeIcon}
        >
          <FormField
            control={form.control}
            name="referralSource"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="sr-only">Fuente de referencia</FormLabel>
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
        </Section>

      </form>
    </Form>
  );
}

interface SectionProps {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}

function Section({ title, description, icon: Icon, children }: SectionProps) {
  return (
    <section className="grid gap-3">
      <header className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-3.5" />
        </span>
        <div>
          <h3 className="font-heading text-sm font-medium">{title}</h3>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
