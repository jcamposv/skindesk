import type {
  PRODUCTO_ABSORPTION_TIMES,
  PRODUCTO_FREQUENCIES,
} from "@/schemas/productos.schema";
import type { Database } from "@/types/database.types";

export type ProductoRow = Database["public"]["Tables"]["productos"]["Row"];

type AbsorptionTime = (typeof PRODUCTO_ABSORPTION_TIMES)[number] | "";
type Frequency = (typeof PRODUCTO_FREQUENCIES)[number] | "";

/** Lite product shape passed to the builder catalog. Photo URL is signed
 *  server-side; the rest comes from the productos catalog row. */
export interface BuilderProducto {
  id: string;
  name: string;
  brand: string | null;
  category: ProductoRow["category"];
  photoUrl: string | null;
  mainIngredients: string[];
  applicationInstruction: string | null;
  suggestedAmount: string | null;
  absorptionTime: string | null;
  frequency: string | null;
  timeOfDay: ProductoRow["time_of_day"];
}

/** Draft step kept in local state. `id` is "" for newly added steps (the
 *  server action assigns DB ids on save). `producto` is the catalog
 *  snapshot — keeps the preview / phone live without re-fetching.
 *
 *  Enum fields are narrowed to `<value> | ""` so they line up with the Zod
 *  schema and consumers don't need `as` casts when calling `setValue`. */
export interface BuilderStep {
  /** "" for new, uuid for existing. */
  id: string;
  producto: BuilderProducto;
  customInstruction: string;
  customAmount: string;
  customAbsorptionTime: AbsorptionTime;
  customFrequency: Frequency;
  customTimeOfDay: "" | "am" | "pm" | "both";
  notes: string;
}

export interface BuilderInitial {
  rutinaId: string | null;
  name: string;
  kind: "template" | "assignment";
  momento: "am" | "pm" | "both";
  skinType: string;
  skinCondition: string;
  mainObjective: string;
  generalNotes: string;
  tags: string[];
  clienteId: string;
  fromTemplateId: string;
  clientMessage: string;
  steps: BuilderStep[];
}
