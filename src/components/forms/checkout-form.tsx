"use client";

import { useActionState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AlertCircleIcon } from "lucide-react";

import { createCheckoutSessionAction } from "@/actions/checkout.actions";
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
import { checkoutSchema, type CheckoutInput } from "@/schemas/checkout.schema";
import type { PlanSlug } from "@/lib/plans";
import type { ActionState } from "@/types/supabase";

interface CheckoutFormProps {
  plan: PlanSlug;
}

export function CheckoutForm({ plan }: CheckoutFormProps) {
  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { plan, fullName: "", email: "", businessName: "" },
  });
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState<
    ActionState | null,
    FormData
  >(createCheckoutSessionAction, null);

  function onSubmit(values: CheckoutInput) {
    try {
      const fd = new FormData();
      Object.entries(values).forEach(([k, v]) => fd.append(k, String(v)));
      startTransition(() => formAction(fd));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
        <input type="hidden" name="plan" value={plan} />
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tu nombre</FormLabel>
              <FormControl>
                <Input
                  autoComplete="name"
                  placeholder="Carla Estética"
                  className="h-11"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="businessName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del negocio</FormLabel>
              <FormControl>
                <Input
                  autoComplete="organization"
                  placeholder="Estética Lumière"
                  className="h-11"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="hola@miclinica.com"
                  className="h-11"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {state?.message && !state.success ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-left"
          >
            <AlertCircleIcon
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden
            />
            <p className="text-xs text-destructive">{state.message}</p>
          </div>
        ) : null}
        <Button type="submit" size="lg" className="h-11" disabled={pending}>
          {pending ? "Redirigiendo a Stripe…" : "Continuar al pago"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Te llevamos a Stripe para completar tu suscripción de forma segura.
          Después de pagar te enviamos un email para activar tu cuenta.
        </p>
      </form>
    </Form>
  );
}
