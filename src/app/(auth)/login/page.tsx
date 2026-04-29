import type { Metadata } from "next";

import { LoginForm } from "@/components/forms/login-form";
import { Logo } from "@/components/shared/logo";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Logo size="lg" />
        <LoginForm />
      </div>
    </div>
  );
}
