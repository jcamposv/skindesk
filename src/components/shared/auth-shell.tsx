import type { ReactNode } from "react";
import Link from "next/link";

import { Logo } from "@/components/shared/logo";
import { ROUTES } from "@/lib/constants";

interface AuthShellProps {
  children: ReactNode;
}

/**
 * Page chrome shared by post-auth/post-checkout surfaces (success, setup,
 * future confirmation pages). Top nav with the brand logo on the left
 * (clickable to home), full-bleed border separators, and a minimalist
 * legal footer with terms + the auto-rolling copyright year.
 *
 * The page provides its own content container — width and alignment are
 * not the shell's concern, so /checkout/success can be `max-w-lg` centered
 * while /auth/setup is `max-w-md` left-aligned without forking the chrome.
 */
export function AuthShell({ children }: AuthShellProps) {
  return (
    <main className="flex min-h-svh flex-col">
      <header className="border-b border-border px-6 py-4 sm:px-10">
        <Link href={ROUTES.home} aria-label="SkinDesk">
          <Logo size="md" />
        </Link>
      </header>

      {children}

      <footer className="border-t border-border px-6 py-6 sm:px-10">
        <div className="mx-auto flex max-w-md flex-col items-center gap-1 text-center text-xs text-muted-foreground">
          <div className="space-x-3">
            <Link
              href="#"
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Términos
            </Link>
            <span aria-hidden>·</span>
            <Link
              href="#"
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Política de privacidad
            </Link>
          </div>
          <p>
            © {new Date().getFullYear()} SkinDesk. Todos los derechos
            reservados.
          </p>
        </div>
      </footer>
    </main>
  );
}
