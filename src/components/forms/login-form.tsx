"use client";

import { useActionState, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { ArrowLeftIcon, Eye, EyeOff, MailIcon } from "lucide-react";
import { toast } from "sonner";

import {
  signInAction,
  signInWithMagicLinkAction,
} from "@/actions/auth.actions";
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
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  loginCombinedSchema,
  type LoginCombinedInput,
} from "@/schemas/auth.schema";
import type { ActionState } from "@/types/supabase";

type LoginFormProps = React.ComponentProps<"div">;
type Mode = "magic" | "password";

/**
 * Linear/Vercel-style login: one method visible at a time. Default mode is
 * magic link (most SkinDesk users activated that way and don't have a
 * password yet). A toggle switches to password mode for users that did set
 * one. The mode swap is local state — no route change, no flash.
 */
export function LoginForm({ className, ...props }: LoginFormProps) {
  const [mode, setMode] = useState<Mode>("magic");
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginCombinedInput>({
    resolver: zodResolver(loginCombinedSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
  });

  // Each method has its own action + pending state so toggling between
  // modes doesn't drop progress / messages from the other one.
  const [, startMlTransition] = useTransition();
  const [mlState, mlAction, mlPending] = useActionState<
    ActionState | null,
    FormData
  >(signInWithMagicLinkAction, null);

  const [, startPwTransition] = useTransition();
  const [pwState, pwAction, pwPending] = useActionState<
    ActionState | null,
    FormData
  >(signInAction, null);

  function dispatchMagicLink(email: string) {
    const fd = new FormData();
    fd.append("email", email);
    form.clearErrors("password");
    startMlTransition(() => mlAction(fd));
  }

  function dispatchPasswordSignIn(values: LoginCombinedInput) {
    const fd = new FormData();
    fd.append("email", values.email);
    fd.append("password", values.password ?? "");
    startPwTransition(() => pwAction(fd));
  }

  function onSubmit(values: LoginCombinedInput) {
    try {
      if (mode === "magic") {
        dispatchMagicLink(values.email);
        return;
      }
      if (!values.password || values.password.length < 8) {
        form.setError("password", {
          type: "manual",
          message: values.password
            ? "Mínimo 8 caracteres."
            : "Necesitás tu contraseña. Si no tenés una, configurala desde el link de abajo.",
        });
        return;
      }
      dispatchPasswordSignIn(values);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function switchToPassword() {
    setMode("password");
    form.clearErrors();
  }

  function switchToMagic() {
    setMode("magic");
    form.clearErrors();
    form.setValue("password", "");
  }

  const pending = mlPending || pwPending;

  return (
    <div className={cn("flex w-full flex-col gap-5", className)} {...props}>
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

          {mode === "password" ? (
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        className="h-11 pr-10"
                        autoFocus
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
          ) : null}

          {/* Action errors / success — separate per mode so they don't
              bleed across when the user toggles. */}
          {mode === "magic" && mlState?.message ? (
            <p
              className={cn(
                "text-sm",
                mlState.success ? "text-primary" : "text-destructive",
              )}
            >
              {mlState.message}
            </p>
          ) : null}
          {mode === "password" && pwState?.message && !pwState.success ? (
            <p className="text-sm text-destructive">{pwState.message}</p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="h-11 gap-2"
            disabled={pending}
          >
            {mode === "magic" ? (
              <>
                <MailIcon className="size-4" />
                {mlPending ? "Enviando…" : "Recibir enlace por email"}
              </>
            ) : (
              <>{pwPending ? "Entrando…" : "Iniciar sesión"}</>
            )}
          </Button>
        </form>
      </Form>

      {/* Mode toggle — small, low-emphasis link, mirrors Linear's pattern. */}
      <div className="flex flex-col items-center gap-2 text-center text-sm">
        {mode === "magic" ? (
          <button
            type="button"
            onClick={switchToPassword}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Tengo contraseña — usarla en su lugar
          </button>
        ) : (
          <button
            type="button"
            onClick={switchToMagic}
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            <ArrowLeftIcon className="size-3.5" />
            Prefiero recibir un enlace por email
          </button>
        )}

        <Link
          href={ROUTES.forgotPassword}
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Configurá tu contraseña si todavía no tenés una.
        </Link>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tenés cuenta?{" "}
        <Link
          href={ROUTES.home}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Ver planes
        </Link>
      </p>
    </div>
  );
}
