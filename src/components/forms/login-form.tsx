"use client";

import { useActionState, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { signInAction, signInWithMagicLinkAction } from "@/actions/auth.actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Inicia sesión</CardTitle>
          <CardDescription>
            Accede con tu correo y contraseña, o pide un enlace mágico.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as typeof tab)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password">Contraseña</TabsTrigger>
              <TabsTrigger value="magic">Magic Link</TabsTrigger>
            </TabsList>
            <TabsContent value="password" className="mt-4">
              <PasswordForm />
            </TabsContent>
            <TabsContent value="magic" className="mt-4">
              <MagicLinkForm />
            </TabsContent>
          </Tabs>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link
              href={ROUTES.register}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Crear cuenta
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function PasswordForm() {
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
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
              <FormLabel>Contraseña</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {state?.message && !state.success ? (
          <p className="text-sm text-destructive">{state.message}</p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Entrando…" : "Iniciar sesión"}
        </Button>
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
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
        <Button type="submit" disabled={pending}>
          {pending ? "Enviando…" : "Enviar enlace"}
        </Button>
      </form>
    </Form>
  );
}
