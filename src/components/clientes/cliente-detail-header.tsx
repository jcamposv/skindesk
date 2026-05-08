import Link from "next/link";
import {
  ArrowLeftIcon,
  CalendarPlusIcon,
  MailIcon,
  MoreVerticalIcon,
  PhoneIcon,
  SparklesIcon,
} from "lucide-react";

import { ClienteAvatar } from "@/components/clientes/cliente-avatar";
import { ClienteStatusBadge } from "@/components/clientes/cliente-status-badge";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import type { ClienteDetail } from "@/services/clientes.service";

interface ClienteDetailHeaderProps {
  cliente: ClienteDetail;
}

function ageFromBirth(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

export function ClienteDetailHeader({ cliente }: ClienteDetailHeaderProps) {
  const name = cliente.profile.full_name ?? "Sin nombre";
  const age = ageFromBirth(cliente.birth_date);
  const services = Array.isArray(cliente.services_active)
    ? (cliente.services_active.filter(
        (v) => typeof v === "string",
      ) as string[])
    : [];

  return (
    <div className="grid gap-4">
      {/* Back link */}
      <div className="flex items-center justify-between">
        <Link
          href={ROUTES.clientes}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Volver a clientas
        </Link>
        <Button variant="ghost" size="icon-sm" aria-label="Más acciones">
          <MoreVerticalIcon />
        </Button>
      </div>

      {/* Identity card */}
      <header className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-8 sm:p-6">
          <ClienteAvatar
            name={name}
            imageUrl={cliente.profile.avatar_url}
            size="xl"
            className="ring-4 ring-[#F4F1EC]"
          />

          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading break-words text-2xl font-medium tracking-tight sm:text-3xl">
                {name}
              </h1>
              <ClienteStatusBadge status={cliente.status} />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {age != null ? (
                <span className="inline-flex items-center gap-1.5">
                  <SparklesIcon className="size-3.5 text-[#BB7154]" />
                  {age} años
                </span>
              ) : null}
              <a
                href={`mailto:${cliente.profile.email}`}
                className="inline-flex min-w-0 max-w-full items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <MailIcon className="size-3.5 shrink-0" />
                <span className="truncate">{cliente.profile.email}</span>
              </a>
              {cliente.profile.phone ? (
                <a
                  href={`tel:${cliente.profile.phone}`}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  <PhoneIcon className="size-3.5 shrink-0" />
                  {cliente.profile.phone}
                </a>
              ) : null}
            </div>

            {services.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Servicios activos
                </span>
                {services.slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center rounded-full bg-[#F1ECE3] px-2.5 py-1 text-xs font-medium text-[#5C6E6C]"
                  >
                    {s}
                  </span>
                ))}
                {services.length > 4 ? (
                  <span className="inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    +{services.length - 4}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-stretch">
            <Button size="lg" className="gap-1.5" disabled>
              <CalendarPlusIcon className="size-4" />
              Nueva cita
            </Button>
            <p className="hidden text-center text-[11px] text-muted-foreground sm:block">
              Próximamente
            </p>
          </div>
        </div>

        {/* Quick notes strip */}
        {cliente.notes ? (
          <div className="border-t bg-[#FBF9F4] px-5 py-3 text-sm text-foreground/80 sm:px-6">
            <span className="mr-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Notas rápidas
            </span>
            <span className="line-clamp-2">{cliente.notes}</span>
          </div>
        ) : null}
      </header>
    </div>
  );
}
