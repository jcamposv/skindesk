"use client";

import { useActionState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { resetPasswordAction } from "@/actions/auth.actions";
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
import { cn } from "@/lib/utils";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/schemas/auth.schema";
import type { ActionState } from "@/types/supabase";

export function ForgotPasswordForm() {
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: "" },
  });
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState<
    ActionState | null,
    FormData
  >(resetPasswordAction, null);

  function onSubmit(values: ResetPasswordInput) {
    try {
      const fd = new FormData();
      fd.append("email", values.email);
      startTransition(() => formAction(fd));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
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
                  placeholder="m@example.com"
                  className="h-11"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {state?.message ? (
          <p
            className={cn(
              "text-sm",
              state.success ? "text-primary" : "text-destructive",
            )}
          >
            {state.message}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="h-11" disabled={pending}>
          {pending ? "Enviando…" : "Enviar enlace"}
        </Button>
      </form>
    </Form>
  );
}
