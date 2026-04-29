"use client";

import { useActionState, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { signInAction, signInWithMagicLinkAction } from "@/actions/auth.actions";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  loginSchema,
  magicLinkSchema,
  type LoginInput,
  type MagicLinkInput,
} from "@/schemas/auth.schema";
import type { ActionState } from "@/types/supabase";

type LoginFormProps = React.ComponentProps<"div">;

export function LoginForm({ className, ...props }: LoginFormProps) {
  const [tab, setTab] = useState<"password" | "magic">("password");

  return (
    <div className={cn("flex w-full flex-col gap-6", className)} {...props}>
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="password">Contraseña</TabsTrigger>
          <TabsTrigger value="magic">Magic Link</TabsTrigger>
        </TabsList>
        <TabsContent value="password" className="mt-6">
          <PasswordForm />
        </TabsContent>
        <TabsContent value="magic" className="mt-6">
          <MagicLinkForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PasswordForm() {
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const [showPassword, setShowPassword] = useState(false);
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(
    signInAction,
    null,
  );

  async function onSubmit(values: LoginInput) {
    try {
      const fd = new FormData();
      fd.append("email", values.email);
      fd.append("password", values.password);
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
                  placeholder="m@example.com"
                  autoComplete="email"
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
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Contraseña</FormLabel>
                <Link
                  href="#"
                  className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                  aria-label="Olvidé mi contraseña"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="h-11 pr-10"
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={
                      showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
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
        {state?.message && !state.success ? (
          <p className="text-sm text-destructive">{state.message}</p>
        ) : null}
        <Button type="submit" size="lg" className="h-11" disabled={pending}>
          {pending ? "Entrando…" : "Iniciar sesión"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link
            href={ROUTES.register}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Crear cuenta
          </Link>
        </p>
      </form>
    </Form>
  );
}

function MagicLinkForm() {
  const form = useForm<MagicLinkInput>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: { email: "" },
  });
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(
    signInWithMagicLinkAction,
    null,
  );

  async function onSubmit(values: MagicLinkInput) {
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
                  placeholder="m@example.com"
                  autoComplete="email"
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
          {pending ? "Enviando…" : "Enviar enlace mágico"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Te enviaremos un correo con un enlace para entrar sin contraseña.
        </p>
      </form>
    </Form>
  );
}
