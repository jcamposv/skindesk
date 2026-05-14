import { cn } from "@/lib/utils";
import {
  CLIENTE_STATUS_LABELS,
  type ClienteStatus,
} from "@/schemas/clientes.schema";

const STATUS_TONES: Record<ClienteStatus, string> = {
  // Sage soft — neutral but warm, signals "fresh / awaiting"
  nueva: "bg-[#E7ECEA] text-[#4F605C] ring-1 ring-[#5C6E6C]/15",
  // Honey/artemis soft — in-progress vibe
  seguimiento: "bg-[#F8EFD7] text-[#7C5E1F] ring-1 ring-[#D2A96A]/30",
  // Terracota soft — flagship / engaged
  activa: "bg-[#F6E0D6] text-[#8C4A30] ring-1 ring-[#BB7154]/25",
  // Muted — out of rotation
  inactiva: "bg-muted text-muted-foreground ring-1 ring-border",
};

interface ClienteStatusBadgeProps {
  status: ClienteStatus;
  className?: string;
  size?: "sm" | "md";
}

export function ClienteStatusBadge({
  status,
  className,
  size = "md",
}: ClienteStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium tracking-tight whitespace-nowrap",
        STATUS_TONES[status],
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {CLIENTE_STATUS_LABELS[status]}
    </span>
  );
}
