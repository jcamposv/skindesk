/**
 * Domain types for the Evaluaciones (Valoración Clínica) prototype.
 *
 * These shapes match what the future `evaluaciones` table will store as JSONB
 * per section. Keeping them here as plain TS lets the prototype work without
 * a migration; when we wire Supabase, the row mapper will satisfy the same
 * interfaces.
 */

export type EvaluacionStatus = "borrador" | "completada";

// ─── Mapa facial ─────────────────────────────────────────────────────────────

export const ALTERATION_CODES = [
  { code: "E", label: "Líneas de expresión" },
  { code: "M", label: "Manchas" },
  { code: "P", label: "Efélides / pecas" },
  { code: "A", label: "Arrugas" },
  { code: "L", label: "Pápulas / pústulas / nódulos" },
  { code: "C", label: "Comedones" },
  { code: "D", label: "Discromías" },
  { code: "i", label: "Milliums" },
  { code: "HPI", label: "Hiperpigmentación post-inflamatoria" },
  { code: "LS", label: "Léntigo solar" },
  { code: "R", label: "Rosácea" },
  { code: "T", label: "Telangiectasia" },
  { code: "J", label: "Ojeras" },
  { code: "CN", label: "Cicatriz normotrófica" },
  { code: "CA", label: "Cicatriz atrófica" },
  { code: "CQ", label: "Cicatriz queloide" },
  { code: "CH", label: "Cicatriz hipertrófica" },
  { code: "O", label: "Otros" },
] as const;

export type AlterationCode = (typeof ALTERATION_CODES)[number]["code"];

export interface MapaFacialPin {
  id: string;
  /** viewBox x coord (SVG is 170 wide). */
  x: number;
  /** viewBox y coord (SVG is 220 tall). */
  y: number;
  code: AlterationCode;
  note?: string;
}

// ─── Step 1: Datos extra ─────────────────────────────────────────────────────

export interface DatosData {
  motivoConsulta: string;
  facialPrevio: { tuvo: boolean; ultimaVez?: string };
}

// ─── Step 2: Anamnesis ───────────────────────────────────────────────────────

export interface ProcedimientoPrevio {
  key: string;
  label: string;
  fecha?: string;
}

export const PROCEDIMIENTOS_LABELS: Record<string, string> = {
  perforaciones: "Perforaciones / piercings",
  botox: "Bótox / Ácido hialurónico",
  micropigmentacion: "Micropigmentación",
  camuflaje: "Camuflaje de estrías / cicatriz",
  laser: "Depilación láser",
  mesoterapia: "Mesoterapia",
  microneedling: "Micropuntura / Microneedling",
  implantes: "Implantes",
  cirugias: "Cirugías recientes",
  tatuajes: "Tatuajes",
};

export const PATOLOGIAS = [
  "Cardiovasculares",
  "Hipertensión",
  "Hipotensión",
  "Anticoagulantes",
  "Cansancio crónico",
  "Marcapasos",
  "Gastrointestinales",
  "Hipotiroidismo",
  "Hipertiroidismo",
  "Diabetes",
  "Cáncer",
  "Autoinmunes",
  "Neurológicos",
  "Respiratorios",
  "Renales",
  "Hepatitis",
  "Metabólicos",
  "Hormonales",
  "Cutáneas",
  "Melasma",
  "Dermatitis",
  "Herpes",
  "Psoriasis",
  "Acné activo",
  "Vitiligo",
  "Alopecia",
  "Epilepsia",
  "Endocrinas",
  "Osteoporosis",
  "Hemofilia",
  "VIH / SIDA",
  "ETS",
  "Glaucoma",
  "Conjuntivitis",
  "Cataratas",
  "Ojos secos",
  "Blefaritis",
  "Retinopatías",
  "Angioma",
] as const;

/**
 * Same patologías but grouped by body system for the wizard UI. The flat
 * `PATOLOGIAS` constant stays unchanged so seed/mock data referencing
 * individual strings keeps working.
 */
export const PATOLOGIAS_GROUPS: ReadonlyArray<{
  group: string;
  items: ReadonlyArray<string>;
}> = [
  {
    group: "Cardiovasculares",
    items: [
      "Cardiovasculares",
      "Hipertensión",
      "Hipotensión",
      "Anticoagulantes",
      "Marcapasos",
      "Hemofilia",
    ],
  },
  {
    group: "Endocrinas y metabólicas",
    items: [
      "Diabetes",
      "Hipotiroidismo",
      "Hipertiroidismo",
      "Endocrinas",
      "Hormonales",
      "Metabólicos",
      "Osteoporosis",
    ],
  },
  {
    group: "Dermatológicas",
    items: [
      "Cutáneas",
      "Melasma",
      "Dermatitis",
      "Herpes",
      "Psoriasis",
      "Acné activo",
      "Vitiligo",
      "Alopecia",
      "Angioma",
    ],
  },
  {
    group: "Gastrointestinales / hepáticas",
    items: ["Gastrointestinales", "Hepatitis", "Renales"],
  },
  {
    group: "Oculares",
    items: [
      "Glaucoma",
      "Conjuntivitis",
      "Cataratas",
      "Ojos secos",
      "Blefaritis",
      "Retinopatías",
    ],
  },
  {
    group: "Neuro y respiratorias",
    items: ["Neurológicos", "Respiratorios", "Epilepsia", "Cansancio crónico"],
  },
  {
    group: "Otras",
    items: ["Cáncer", "Autoinmunes", "VIH / SIDA", "ETS"],
  },
];

export const ALERGIAS_TIPOS = [
  "Alimentos",
  "Animales",
  "Productos",
  "Plantas",
  "Medicamentos",
  "Sustancias",
  "Anestesia",
  "Otros",
] as const;

export const CONDICIONES_APARATOLOGIA = [
  "Marcapasos",
  "Placas / tornillos",
  "Implantes faciales/corporales",
  "Dispositivos electrónicos",
  "Ortodoncia",
] as const;

export const PROFESIONALES_SALUD = [
  "Dermatólogo",
  "Ginecólogo",
  "Psicólogo/Psiquiatra",
  "Endocrinólogo",
  "Médico estético",
  "Cirujano plástico",
  "Cosmetóloga",
  "Fisioterapeuta",
  "Nutriólogo",
  "Otro",
] as const;

export interface AnamnesisData {
  procedimientos: ProcedimientoPrevio[];
  patologias: string[];
  patologiasOtras: string;
  alergias: { tiene: boolean; tipos: string[]; detalle: string };
  condicionesAparatologia: string[];
  condicionesDetalle: string;
  medicamento6m: { tiene: boolean; cual: string };
  medicamentoContinuo: { tiene: boolean; cual: string };
  medicamentoTopico: { tiene: boolean; cual: string };
  profesionalesSalud: string[];
  observacionClinica: string;
  ansiosa: { es: boolean; detalle: string };
  estresFacil: boolean;
  estresNivel: number;
}

// ─── Step 3: Estilo de vida + hábitos de piel ───────────────────────────────

export const ALIMENTACION_OPCIONES = [
  {
    value: "muy_saludable",
    label: "Muy saludable",
    description: "Predomina lo natural, rara vez procesada",
    /** Token resolved by the UI to a colored dot (clinical SaaS pattern). */
    tone: "sage" as const,
  },
  {
    value: "saludable",
    label: "Saludable",
    description: "Balance entre fresco y procesado",
    tone: "sage" as const,
  },
  {
    value: "regular",
    label: "Regular",
    description: "Igual cantidad de ambos",
    tone: "honey" as const,
  },
  {
    value: "mala",
    label: "Mala",
    description: "Predomina la comida procesada",
    tone: "rose" as const,
  },
] as const;

export const SUPLEMENTOS = [
  "Proteína suero de leche",
  "Proteína vegana",
  "Multivitamínicos",
  "Otros",
  "Ninguno",
] as const;

export const ANTICONCEPTIVOS = [
  "Ninguno",
  "Pastillas",
  "DIU hormonal",
  "DIU de cobre",
  "Implante subdérmico",
  "Inyección hormonal",
  "Preservativo",
  "Ligadura de trompas",
  "Otro",
] as const;

export interface MujerData {
  aplicable: boolean;
  edadInicioMenstruacion: string;
  periodos: "regulares" | "irregulares" | "";
  colicos: "no" | "pocos" | "muchos" | "";
  embarazos: number;
  embarazadaActualmente: { si: boolean; meses: string };
  lactancia: { si: boolean; meses: string };
  anticonceptivo: string;
  ae6m: { si: boolean; cuando: string };
}

export interface HabitosData {
  alimentacion: string;
  digestion: "buena" | "regular" | "mala" | "";
  litrosAgua: number | null;
  actividadFisica: { hace: boolean; cual: string; frecuencia: string };
  suplementos: string[];
  suplementosDetalle: string;
  fuma: { si: boolean; frecuencia: string };
  alcohol: { si: boolean; frecuencia: string };
  drogas: { si: boolean; cuales: string };
  lacteos: { si: boolean; frecuencia: string };
  mujer: MujerData;
  exposicionSolar: "nunca" | "poca" | "moderada" | "excesiva" | "";
  usaSpf: boolean;
  retoquesSpf: string;
  lavadosDia: string;
  maquillaje: "si" | "no" | "ocasional" | "";
  maquillajeTipo: string;
  herramientasMaquillaje: string[];
  lavaBrochasMes: string;
  queloide: "si" | "no" | "no_se" | "";
  moretones: "si" | "no" | "no_recuerdo" | "";
  cicatrizacion: "buena" | "cicatrices" | "manchas" | "no_se" | "";
  reaccionProducto: { tuvo: "si" | "no" | "no_recuerdo" | ""; detalle: string };
  rutinaAm: string;
  rutinaPm: string;
}

// ─── Step 4: Diagnóstico de piel ─────────────────────────────────────────────

export const BIOTIPOS = ["Normal", "Mixta", "Grasa", "Seca / alípica"] as const;

export const FITZPATRICK = [
  { num: 1, color: "#F5DEB3", desc: "Muy claro, siempre quema" },
  { num: 2, color: "#E8C49A", desc: "Claro, generalmente quema" },
  { num: 3, color: "#D4956A", desc: "Moreno claro, a veces quema" },
  { num: 4, color: "#A0634A", desc: "Moreno, rara vez quema" },
  { num: 5, color: "#70402A", desc: "Oscuro, casi nunca quema" },
  { num: 6, color: "#3A2010", desc: "Muy oscuro, nunca quema" },
] as const;

export const GLOGAU = [
  { grado: 1, edad: "20–30", nivel: "Leve", desc: "Sin arrugas. Inicio de fotoenvejecimiento." },
  { grado: 2, edad: "30–45", nivel: "Moderado", desc: "Arrugas de expresión. Manchas leves." },
  { grado: 3, edad: "45–60", nivel: "Avanzado", desc: "Arrugas en reposo. Manchas evidentes." },
  { grado: 4, edad: "+60", nivel: "Grave", desc: "Arrugas marcadas. Queratosis actínica." },
] as const;

export const SENSACIONES_PIEL = [
  "Grasa",
  "Seca",
  "Sensible",
  "Acartonada / tirante",
  "Descamación",
  "Irritada",
  "Poro muy abierto",
  "Puntos negros",
  "Mucha textura",
  "Granitos ocasionales",
  "Granitos frecuentes",
  "Pigmentada",
  "Pecas (efélides)",
  "Hinchada / retención",
  "Zonas grasas y secas",
] as const;

export const ALT_VASCULARES = [
  "Dermatitis",
  "Cuperosis",
  "Rosácea",
  "Petequias",
  "Telangiectasias",
] as const;

export const OJERAS_TIPOS = [
  "Vascular",
  "Pigmentación",
  "Estructurales",
  "Bolsas",
  "Mixtas",
] as const;

export const ALT_PIGMENTO = [
  "Acromía",
  "Hipocromía",
  "Efélides",
  "HPI",
  "Cloasma",
  "Hipercromía",
  "Vitiligo",
  "Melasma",
  "Léntigo solar",
  "EPI",
] as const;

export const ALT_EPIDERMIS = [
  "Deshidratación",
  "Sensibilidad",
  "Hiperqueratinización",
  "Descamación",
  "Seca / tirantez",
  "Asfíctica",
] as const;

export const ALT_FOLICULO = [
  "Alopecia",
  "Hirsutismo",
  "Foliculitis",
  "Psoriasis",
  "Tricostasis",
  "Acné",
  "Queratosis",
  "Milliums",
] as const;

export const ACNE_LESIONES = [
  "Comedón cerrado",
  "Comedón abierto",
  "Pústula",
  "Pápula",
  "Nódulo",
  "Quiste",
] as const;

export const CICATRICES = [
  { tipo: "Icepick", desc: "Cicatriz estrecha y profunda" },
  { tipo: "Rolling", desc: "Ondulaciones suaves, aspecto de ola" },
  { tipo: "Boxcar", desc: "Bordes definidos, fondo plano" },
  { tipo: "Hipertrófica / Queloide", desc: "Cicatriz elevada sobre la piel" },
] as const;

export interface DiagnosticoData {
  biotipo: string;
  fitzpatrick: number | null;
  glogau: number | null;
  sensaciones: string[];
  mapaFacial: MapaFacialPin[];
  altVasculares: { presenta: boolean; tipos: string[] };
  ojeras: { presenta: boolean; tipos: string[] };
  altPigmento: string[];
  altEpidermis: string[];
  altFoliculo: string[];
  acne: { activo: boolean; grado: number | null; lesiones: string[] };
  cicatrices: string[];
  observaciones: string;
}

// ─── Step 5: Plan + firma + consentimiento ──────────────────────────────────

export const TRATAMIENTOS_RECOMENDADOS = [
  "Limpieza profunda",
  "Radiofrecuencia",
  "LED fototerapia",
  "Peeling enzimático",
  "Micropuntura",
  "Oxigenoterapia",
  "Ultrasonido",
  "Micropigmentación",
  "Depilación láser",
] as const;

export const NUMERO_SESIONES = [
  "4 sesiones",
  "6 sesiones",
  "8 sesiones",
  "10 sesiones",
  "12 sesiones",
  "Indefinido · mantenimiento",
] as const;

export const FRECUENCIAS = [
  "1 vez por semana",
  "Cada 15 días",
  "1 vez al mes",
  "Cada 6 semanas",
] as const;

/**
 * One scheduled session inside a treatment plan. The plan editor lets the
 * profesional spell out what gets done on each visit + when; the progress
 * view in Objetivos tab renders the same array as a cronograma with
 * completed/pending status.
 */
export interface PlanSesion {
  /** Stable id, generated client-side via crypto.randomUUID(). */
  id: string;
  /** Protocol / display name e.g. "Limpieza profunda + RF". */
  nombre: string;
  /** ISO date string (YYYY-MM-DD). Null while the row is still being
   *  scheduled by the profesional. */
  fecha: string | null;
  /** Short note about what will happen in this session. */
  descripcion: string;
  /** True once the cosmetóloga marks the session as done. */
  completada: boolean;
}

export interface PlanData {
  /** Plan headline e.g. "Plan facial antiedad". Added with the v2 dynamic
   *  editor — backward-compatible default is "" for legacy plans. */
  nombrePlan?: string;
  objetivoPrincipal: string;
  tratamientos: string[];
  /** Derived from `sesiones.length` for v2 plans, but kept as a free-form
   *  string for legacy plans that pre-date the dynamic editor. */
  numeroSesiones: string;
  frecuencia: string;
  notasClinicas: string;
  /** v2 sessions cronograma. Empty array for legacy plans. */
  sesiones?: PlanSesion[];
}

// ─── Top-level evaluación ────────────────────────────────────────────────────

export interface Evaluacion {
  id: string;
  clienteId: string;
  /** Joined from clientes→profiles at read time. */
  clienteNombre: string;
  /** Joined from profiles via `created_by` at read time — no DB drift. */
  profesionalNombre: string;
  /** ISO date (YYYY-MM-DD). */
  fecha: string;
  status: EvaluacionStatus;
  /** Step the wizard last persisted to (0–5). Used to "Continuar borrador". */
  ultimoStep: number;
  /** Optimistic-concurrency version. Bumped server-side on every UPDATE. */
  version: number;

  datos: DatosData;
  anamnesis: AnamnesisData;
  habitos: HabitosData;
  diagnostico: DiagnosticoData;
  plan: PlanData;

  consentimientoAceptado: boolean;
  firmaDataUrl?: string;
  firmanteNombre?: string;
  /** ISO timestamp. */
  firmaSignedAt?: string;

  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
}

// ─── Empty / default builder ─────────────────────────────────────────────────

export function emptyEvaluacion(
  clienteId: string,
  clienteNombre: string,
  profesionalNombre: string,
): Omit<Evaluacion, "id"> {
  const now = new Date().toISOString();
  return {
    clienteId,
    clienteNombre,
    profesionalNombre,
    fecha: now.slice(0, 10),
    status: "borrador",
    ultimoStep: 0,
    datos: {
      motivoConsulta: "",
      facialPrevio: { tuvo: false },
    },
    anamnesis: {
      procedimientos: [],
      patologias: [],
      patologiasOtras: "",
      alergias: { tiene: false, tipos: [], detalle: "" },
      condicionesAparatologia: [],
      condicionesDetalle: "",
      medicamento6m: { tiene: false, cual: "" },
      medicamentoContinuo: { tiene: false, cual: "" },
      medicamentoTopico: { tiene: false, cual: "" },
      profesionalesSalud: [],
      observacionClinica: "",
      ansiosa: { es: false, detalle: "" },
      estresFacil: false,
      estresNivel: 5,
    },
    habitos: {
      alimentacion: "",
      digestion: "",
      litrosAgua: null,
      actividadFisica: { hace: false, cual: "", frecuencia: "" },
      suplementos: [],
      suplementosDetalle: "",
      fuma: { si: false, frecuencia: "" },
      alcohol: { si: false, frecuencia: "" },
      drogas: { si: false, cuales: "" },
      lacteos: { si: false, frecuencia: "" },
      mujer: {
        aplicable: true,
        edadInicioMenstruacion: "",
        periodos: "",
        colicos: "",
        embarazos: 0,
        embarazadaActualmente: { si: false, meses: "" },
        lactancia: { si: false, meses: "" },
        anticonceptivo: "",
        ae6m: { si: false, cuando: "" },
      },
      exposicionSolar: "",
      usaSpf: false,
      retoquesSpf: "",
      lavadosDia: "",
      maquillaje: "",
      maquillajeTipo: "",
      herramientasMaquillaje: [],
      lavaBrochasMes: "",
      queloide: "",
      moretones: "",
      cicatrizacion: "",
      reaccionProducto: { tuvo: "", detalle: "" },
      rutinaAm: "",
      rutinaPm: "",
    },
    diagnostico: {
      biotipo: "",
      fitzpatrick: null,
      glogau: null,
      sensaciones: [],
      mapaFacial: [],
      altVasculares: { presenta: false, tipos: [] },
      ojeras: { presenta: false, tipos: [] },
      altPigmento: [],
      altEpidermis: [],
      altFoliculo: [],
      acne: { activo: false, grado: null, lesiones: [] },
      cicatrices: [],
      observaciones: "",
    },
    plan: {
      nombrePlan: "",
      objetivoPrincipal: "",
      tratamientos: [],
      numeroSesiones: "",
      frecuencia: "",
      notasClinicas: "",
      sesiones: [],
    },
    consentimientoAceptado: false,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}
