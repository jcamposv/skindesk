"use client";

import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/use-sign-out";
import { cn } from "@/lib/utils";

interface SignOutButtonProps {
  className?: string;
}

/**
 * Standalone sign-out button used wherever there isn't a dropdown menu in
 * scope (e.g. clienta `/perfil`). The staff sidebar uses `useSignOut`
 * directly inside its DropdownMenuItem.
 */
export function SignOutButton({ className }: SignOutButtonProps) {
  const { signOut, signingOut } = useSignOut();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={signingOut}
      onClick={signOut}
      className={cn("gap-2", className)}
    >
      <LogOutIcon className="size-4" />
      {signingOut ? "Cerrando…" : "Cerrar sesión"}
    </Button>
  );
}
