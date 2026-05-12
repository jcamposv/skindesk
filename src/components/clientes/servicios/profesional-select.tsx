"use client";

import type { StaffMember } from "@/services/staff.service";
import { cn } from "@/lib/utils";

/**
 * Value shape emitted by `ProfesionalSelect`. Exactly one of the two fields
 * is "active" at a time:
 *   · `professionalId` set + `professionalLabel` empty → known staff member.
 *   · `professionalId` null + `professionalLabel` set → manual / legacy entry.
 */
export interface ProfesionalValue {
  professionalId: string | null;
  professionalLabel: string;
}

interface ProfesionalSelectProps {
  value: ProfesionalValue;
  onChange: (next: ProfesionalValue) => void;
  /** Tenant staff list — profesional + asistentes. */
  staff: StaffMember[];
  /** Label rendered above the select. */
  label?: string;
  className?: string;
}

const ROLE_LABEL: Record<StaffMember["role"], string> = {
  profesional: "Profesional",
  asistente: "Asistente",
};

// Sentinel select value used to surface the "manual / custom name" option
// without colliding with any real UUID. Selecting it leaves the FK null and
// lets the user fill `professionalLabel` via the inline input.
const MANUAL_VALUE = "__manual__";

/**
 * Dropdown of the tenant's staff for the "Profesional responsable" field.
 *
 * When the tenant has no staff with `full_name` set, falls back to a plain
 * text input that writes `professionalLabel` only (FK stays null).
 *
 * If the current `professionalId` doesn't match any current staff (e.g. the
 * staffer was removed), the FK is preserved but rendered as an unknown
 * option so the user can keep or replace it without silently dropping the
 * association.
 */
export function ProfesionalSelect({
  value,
  onChange,
  staff,
  label,
  className,
}: ProfesionalSelectProps) {
  const idIsKnown =
    value.professionalId != null &&
    staff.some((s) => s.id === value.professionalId);
  const hasManualLabel =
    value.professionalId == null && value.professionalLabel.trim() !== "";

  function handleSelectChange(next: string) {
    if (next === "") {
      onChange({ professionalId: null, professionalLabel: "" });
      return;
    }
    if (next === MANUAL_VALUE) {
      // Switch to manual mode — keep any existing label so the input is
      // pre-filled with what was there before (typically empty on the first
      // switch).
      onChange({
        professionalId: null,
        professionalLabel: value.professionalLabel,
      });
      return;
    }
    onChange({ professionalId: next, professionalLabel: "" });
  }

  if (staff.length === 0) {
    return (
      <div className={cn("grid gap-1", className)}>
        {label ? (
          <label className="text-[11px] font-medium text-muted-foreground">
            {label}
          </label>
        ) : null}
        <input
          value={value.professionalLabel}
          onChange={(e) =>
            onChange({
              professionalId: null,
              professionalLabel: e.target.value,
            })
          }
          placeholder="Nombre del profesional"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
    );
  }

  const selectValue = value.professionalId
    ? idIsKnown
      ? value.professionalId
      : value.professionalId // preserve the unknown FK as the selected option
    : hasManualLabel
      ? MANUAL_VALUE
      : "";

  return (
    <div className={cn("grid gap-1", className)}>
      {label ? (
        <label className="text-[11px] font-medium text-muted-foreground">
          {label}
        </label>
      ) : null}
      <select
        value={selectValue}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {selectValue === "" ? (
          <option value="">Seleccionar…</option>
        ) : null}
        {!idIsKnown && value.professionalId ? (
          <option value={value.professionalId}>
            (profesional removido) · {value.professionalLabel || "—"}
          </option>
        ) : null}
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.fullName} · {ROLE_LABEL[s.role]}
          </option>
        ))}
        <option value={MANUAL_VALUE}>Otro / manual…</option>
      </select>
      {value.professionalId == null && selectValue === MANUAL_VALUE ? (
        <input
          value={value.professionalLabel}
          onChange={(e) =>
            onChange({
              professionalId: null,
              professionalLabel: e.target.value,
            })
          }
          placeholder="Nombre del profesional"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      ) : null}
    </div>
  );
}
