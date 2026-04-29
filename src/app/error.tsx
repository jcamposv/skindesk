"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="max-w-md text-center">
        <AlertCircle
          className="mx-auto mb-4 size-10 text-destructive"
          aria-hidden
        />
        <h2 className="mb-2 text-xl font-semibold">Algo salió mal</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          {error.message || "Ocurrió un error inesperado."}
        </p>
        <Button onClick={reset}>Reintentar</Button>
      </div>
    </div>
  );
}
