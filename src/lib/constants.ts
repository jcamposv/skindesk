export const APP_NAME = "SkinDesk";
export const APP_DESCRIPTION =
  "SkinDesk es una plataforma enfocada en el cuidado de la piel que combina tecnología y dermatología para ofrecer recomendaciones personalizadas, análisis de productos y rutinas adaptadas a cada tipo de piel.";

export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  authCallback: "/auth/callback",
  /** Server-side router that redirects to the role-specific dashboard. */
  dashboard: "/dashboard",
  /** Role-specific landing pages. */
  superAdmin: "/super-admin",
  profesional: "/profesional",
  clienta: "/clienta",
  /** Shared staff settings (super_admin + profesional + asistente). */
  settings: "/settings",
} as const;

export const PUBLIC_ROUTES: readonly string[] = [
  ROUTES.home,
  ROUTES.login,
  ROUTES.register,
  ROUTES.authCallback,
];

import type { AppRole } from "@/types/supabase";

/** Maps a role to its post-login landing page. */
export function dashboardForRole(role: AppRole): string {
  switch (role) {
    case "super_admin":
      return ROUTES.superAdmin;
    case "profesional":
    case "asistente":
      return ROUTES.profesional;
    case "clienta":
      return ROUTES.clienta;
  }
}

export const QUERY_KEYS = {
  user: "user",
  session: "session",
} as const;

export const EMAIL_FROM_DEV = "onboarding@resend.dev";
