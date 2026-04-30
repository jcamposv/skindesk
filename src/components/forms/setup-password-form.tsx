"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { updatePasswordAction } from "@/actions/auth.actions";
import { ROUTES } from "@/lib/constants";
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
  updatePasswordSchema,
  type UpdatePasswordInput,
} from "@/schemas/auth.schema";
import type { ActionState } from "@/types/supabase";

export function SetupPasswordForm() {
  const router = useRouter();
  const form = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const [showPassword, setShowPassword] = useState(false);
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState<
    ActionState | null,
    FormData
  >(updatePasswordAction, null);

  // After the action returns success, hand the user off to the role router.
  // Redirect lives on the client because the action is reused by the future
  // settings page where we just want a "Guardado" toast.
  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Contraseña actualizada");
      router.replace(ROUTES.dashboard);
      router.refresh();
    }
  }, [state, router]);

  function onSubmit(values: UpdatePasswordInput) {
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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nueva contraseña</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="h-11 pr-10"
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={
                      showPassword
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmar contraseña</FormLabel>
              <FormControl>
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
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
          {pending ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
    </Form>
  );
}
