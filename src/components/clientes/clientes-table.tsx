"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  EyeIcon,
  CalendarPlusIcon,
  MailCheckIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import { resendClientaInviteAction } from "@/actions/clientes.actions";
import { CitaDialog, type CitaDialogState } from "@/components/citas/cita-dialog";
import { useCitaMutations } from "@/components/citas/use-cita-mutations";
import { DataTable } from "@/components/data-table";
import type { FilterConfig, RowAction } from "@/components/data-table";
import { ClienteAvatar } from "@/components/clientes/cliente-avatar";
import { ClienteStatusBadge } from "@/components/clientes/cliente-status-badge";
import { ROUTES } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { CLIENTE_STATUSES } from "@/schemas/clientes.schema";
import type { ClienteListRow } from "@/services/clientes.service";
import type { StaffMember } from "@/services/staff.service";

interface ClientesTableProps {
  rows: ClienteListRow[];
  total: number;
  staff: StaffMember[];
  currentProfesional: { id: string; full_name: string };
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

function ServicesCell({ value }: { value: unknown }) {
  const list = Array.isArray(value)
    ? (value.filter((v) => typeof v === "string") as string[])
    : [];
  if (list.length === 0) {
    return (
      <span className="text-xs italic text-foreground/75">
        Sin servicios activos
      </span>
    );
  }
  const visible = list.slice(0, 2);
  const rest = list.length - visible.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((s) => (
        <span
          key={s}
          className="inline-flex items-center rounded-full bg-[#F1ECE3] px-2 py-0.5 text-xs font-medium text-[#5C6E6C]"
          title={s}
        >
          <span className="max-w-[140px] truncate">{s}</span>
        </span>
      ))}
      {rest > 0 ? (
        <span
          className="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-xs font-semibold text-foreground/80"
          title={list.slice(2).join(", ")}
        >
          +{rest}
        </span>
      ) : null}
    </div>
  );
}

function NameCell({ row }: { row: ClienteListRow }) {
  const name = row.profile.full_name ?? "Sin nombre";
  return (
    <div className="flex items-center gap-3">
      <ClienteAvatar
        name={name}
        imageUrl={row.profile.avatar_url}
        size="lg"
      />
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground">{name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {row.profile.email}
        </div>
      </div>
    </div>
  );
}

const STATUS_FILTERS: FilterConfig = {
  id: "status",
  label: "Estado",
  type: "select",
  options: CLIENTE_STATUSES.map((s) => ({
    label: s.charAt(0).toUpperCase() + s.slice(1),
    value: s,
  })),
};

export function ClientesTable({
  rows,
  total,
  staff,
  currentProfesional,
}: ClientesTableProps) {
  const router = useRouter();
  const [resending, startResend] = useTransition();
  // Cita dialog state lives in the table so the kebab "Nueva cita" action
  // can open it pre-filled with the clicked row's clienta. Reuses the same
  // sheet the agenda + cliente detail use — create semantics stay identical.
  const [citaState, setCitaState] = useState<CitaDialogState | null>(null);
  const [citaForCliente, setCitaForCliente] = useState<{
    id: string;
    fullName: string;
  } | null>(null);
  const closeCita = useCallback(() => {
    setCitaState(null);
    setCitaForCliente(null);
  }, []);
  const { isPending: citaSaving, handleCreate, handleUpdate, handleDelete } =
    useCitaMutations({ onSuccess: closeCita });

  const columns = useMemo<ColumnDef<ClienteListRow, unknown>[]>(
    () => [
      {
        id: "cliente",
        header: "Cliente",
        cell: ({ row }) => <NameCell row={row.original} />,
        meta: { className: "min-w-[260px]" },
      },
      {
        id: "edad",
        header: "Edad",
        cell: ({ row }) => {
          const age = ageFromBirth(row.original.birth_date);
          return (
            <span className="text-sm tabular-nums text-foreground/80">
              {age != null ? `${age} años` : "—"}
            </span>
          );
        },
      },
      {
        id: "estado",
        header: "Estado",
        cell: ({ row }) => <ClienteStatusBadge status={row.original.status} />,
      },
      {
        id: "servicios",
        header: "Servicios activos",
        cell: ({ row }) => (
          <ServicesCell value={row.original.services_active} />
        ),
      },
      {
        id: "ultima_cita",
        header: "Última cita",
        cell: ({ row }) => {
          const v = row.original.last_appointment_at;
          if (!v) {
            return (
              <span className="text-xs italic text-foreground/75">
                Sin cita previa
              </span>
            );
          }
          return (
            <span className="text-sm tabular-nums text-foreground/80">
              {formatDate(v)}
            </span>
          );
        },
      },
      {
        id: "proxima_cita",
        header: "Próxima cita",
        cell: ({ row }) => {
          const v = row.original.next_appointment_at;
          if (!v) {
            return (
              <span className="text-xs italic text-foreground/75">
                Sin próxima cita
              </span>
            );
          }
          return (
            <span className="inline-flex items-center rounded-full bg-[#E7ECEA] px-2.5 py-1 text-xs font-medium tabular-nums text-[#4F605C]">
              {formatDate(v)}
            </span>
          );
        },
      },
    ],
    [],
  );

  const rowActions = useMemo<RowAction<ClienteListRow>[]>(
    () => [
      {
        id: "view",
        label: "Ver ficha",
        icon: EyeIcon,
        onClick: (r) => router.push(`${ROUTES.clientes}/${r.id}`),
      },
      {
        id: "resend-invite",
        label: "Reenviar invitación",
        icon: MailCheckIcon,
        disabled: resending,
        onClick: (r) => {
          // Optimistic toast pattern — show "Enviando…" immediately, then
          // resolve to success/error when the action returns. This avoids the
          // dropdown closing into a silent void on a 1-2s network round-trip.
          const id = toast.loading(
            `Enviando invitación a ${r.profile.email}…`,
          );
          startResend(async () => {
            const result = await resendClientaInviteAction(r.id);
            if (result.success) {
              toast.success(result.message ?? "Invitación reenviada.", {
                id,
              });
            } else {
              toast.error(
                result.message ?? "No se pudo reenviar la invitación.",
                { id },
              );
            }
          });
        },
      },
      {
        id: "appointment",
        label: "Nueva cita",
        icon: CalendarPlusIcon,
        onClick: (r) => {
          // Default to "now + 1h" so the datetime inputs aren't empty.
          // Same defaults as `NuevaCitaButton` on the cliente detail page.
          const start = new Date();
          start.setMinutes(0, 0, 0);
          start.setHours(start.getHours() + 1);
          const end = new Date(start.getTime() + 60 * 60 * 1000);
          setCitaForCliente({
            id: r.id,
            fullName: r.profile.full_name ?? "Clienta",
          });
          setCitaState({
            mode: "create",
            defaults: {
              startAt: start.toISOString(),
              endAt: end.toISOString(),
              clienteId: r.id,
            },
          });
        },
      },
    ],
    [router, resending],
  );

  return (
    <>
      <DataTable<ClienteListRow>
        mode="server"
        columns={columns}
        data={rows}
        totalItems={total}
        defaultPageSize={20}
        pageSizeOptions={[10, 20, 50, 100]}
        searchable
        searchPlaceholder="Buscar por nombre, email o teléfono…"
        filters={[STATUS_FILTERS]}
        rowActions={rowActions}
        onRowClick={(r) => router.push(`${ROUTES.clientes}/${r.id}`)}
        getRowId={(r) => r.id}
        emptyTitle="Todavía no agregaste clientas"
        emptyDescription="Empieza agregando tu primera clienta. Le creamos el portal y le mandamos la invitación por email."
        emptyIcon={UsersIcon}
      />

      {citaState != null && citaForCliente != null ? (
        <CitaDialog
          state={citaState}
          clientes={[citaForCliente]}
          staff={staff}
          currentProfesional={currentProfesional}
          saving={citaSaving}
          onClose={closeCita}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      ) : null}
    </>
  );
}
