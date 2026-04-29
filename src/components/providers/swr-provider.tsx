"use client";

import { SWRConfig } from "swr";
import { toast } from "sonner";

interface SWRProviderProps {
  children: React.ReactNode;
}

const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
  const res = await fetch(input, init);
  if (!res.ok) {
    const error = new Error(`Request failed: ${res.status}`);
    throw error;
  }
  return res.json();
};

/** Global SWR config with sane defaults and toast on error. */
export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        dedupingInterval: 5000,
        onError: (err: Error) => {
          toast.error(err.message ?? "Error al cargar datos");
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
