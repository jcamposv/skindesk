import type { ServiceType } from "./types";

export interface CatalogItem {
  key: string;
  name: string;
  description: string;
  defaultSessions: number;
  isPostOp?: boolean;
}

export const CATALOG: Record<ServiceType, CatalogItem[]> = {
  facial: [
    {
      key: "limpieza-profunda",
      name: "Limpieza profunda",
      description: "Higiene facial profesional con extracción y mascarilla.",
      defaultSessions: 4,
    },
    {
      key: "antiedad-lifting",
      name: "Facial antiedad / lifting",
      description: "Reafirmante con RF, electroporación y activos peptídicos.",
      defaultSessions: 8,
    },
    {
      key: "hidratacion-intensiva",
      name: "Hidratación intensiva",
      description: "Hidratación profunda con ácido hialurónico y mascarillas.",
      defaultSessions: 6,
    },
    {
      key: "led-fototerapia",
      name: "LED fototerapia",
      description: "Bioestimulación con luz LED por longitud de onda.",
      defaultSessions: 10,
    },
    {
      key: "anti-acne-seborreico",
      name: "Anti-acné seborreico",
      description: "Control sebáceo, descongestión y bacteriostático.",
      defaultSessions: 8,
    },
    {
      key: "peeling-enzimatico",
      name: "Peeling enzimático",
      description: "Renovación celular suave con enzimas vegetales.",
      defaultSessions: 6,
    },
  ],
  corporal: [
    {
      key: "post-operatorio",
      name: "Post-operatorio / drenaje linfático",
      description: "Acompañamiento post-quirúrgico con drenaje y aparatología.",
      defaultSessions: 10,
      isPostOp: true,
    },
    {
      key: "micropuntura-corporal",
      name: "Micropuntura corporal",
      description: "Inducción de colágeno para estrías y cicatrices.",
      defaultSessions: 6,
    },
    {
      key: "maderoterapia-reductiva",
      name: "Maderoterapia reductiva",
      description: "Modelado y reducción con utensilios de madera.",
      defaultSessions: 12,
    },
    {
      key: "cavitacion-rf",
      name: "Cavitación + RF corporal",
      description: "Reductivo localizado y reafirmante combinado.",
      defaultSessions: 10,
    },
    {
      key: "anticelulitis-presoterapia",
      name: "Anticelulitis / presoterapia",
      description: "Drenaje, descongestión y mejora de celulitis.",
      defaultSessions: 10,
    },
    {
      key: "tratamiento-estrias",
      name: "Tratamiento de estrías",
      description: "Atenuación de estrías rojas y blancas.",
      defaultSessions: 8,
    },
  ],
  laser: [
    { key: "axilas", name: "Axilas", description: "Zona pequeña — 5–7 min por sesión.", defaultSessions: 6 },
    { key: "bikini", name: "Bikini / inglés", description: "Zona pequeña — diseño a elegir.", defaultSessions: 6 },
    { key: "piernas-completas", name: "Piernas completas", description: "Zona grande — 35–45 min por sesión.", defaultSessions: 8 },
    { key: "rostro-menton", name: "Rostro / mentón", description: "Zona facial — equipos específicos.", defaultSessions: 8 },
    { key: "brazos", name: "Brazos / antebrazos", description: "Zona mediana.", defaultSessions: 6 },
    { key: "espalda", name: "Espalda", description: "Zona grande.", defaultSessions: 8 },
    { key: "gluteos", name: "Glúteos", description: "Zona mediana.", defaultSessions: 6 },
  ],
  other: [
    {
      key: "micropigmentacion",
      name: "Micropigmentación",
      description: "Pigmento de larga duración en cejas, labios o eyeliner.",
      defaultSessions: 2,
    },
    {
      key: "micropuntura-personalizada",
      name: "Micropuntura personalizada",
      description: "Protocolo de micropuntura adaptado al objetivo.",
      defaultSessions: 4,
    },
    {
      key: "personalizado",
      name: "Tratamiento personalizado",
      description: "Definí un tratamiento a medida de la clienta.",
      defaultSessions: 4,
    },
  ],
};

// ─── Aparatology catalogs (used as chip choices in session forms) ───────────

export const FACIAL_DEVICES = [
  "Radiofrecuencia",
  "LED fototerapia",
  "Electroporación",
  "Ultrasonido",
  "Vacuoterapia",
  "Alta frecuencia",
  "Microdermoabrasión",
  "HIFU facial",
];

export const CORPORAL_DEVICES = [
  "Presoterapia",
  "Cavitación",
  "Radiofrecuencia corporal",
  "Maderoterapia",
  "Vacumterapia",
  "Ultrasonido",
  "Electroestimulación",
  "HIFU corporal",
];

export const LASER_EQUIPMENT = [
  "Diodo 808nm",
  "Alejandrita 755nm",
  "Nd:YAG 1064nm",
  "Triple wavelength diode",
];

export const FACIAL_ACTIVES = [
  "Vitamina C",
  "Ácido hialurónico",
  "Niacinamida",
  "Retinol",
  "Péptidos",
  "Ácido glicólico",
  "Ácido salicílico",
  "Centella asiática",
];

export const FACIAL_PRODUCTS = [
  "Limpiador suave",
  "Tónico balanceador",
  "Sérum antioxidante",
  "Mascarilla calmante",
  "Hidratante oil-free",
  "Protector solar SPF 50",
];

export const CORPORAL_TECHNIQUES = [
  "Drenaje linfático manual",
  "Modelaje reductivo",
  "Masaje terapéutico",
  "Vendaje frío",
  "Mascarilla corporal",
];

export const SKIN_TYPES = ["Normal", "Seca", "Mixta", "Grasa", "Sensible"];

export const SKIN_CONDITIONS = [
  "Deshidratada",
  "Comedoniana",
  "Reactiva",
  "Pigmentada",
  "Madura",
  "Saludable",
];
