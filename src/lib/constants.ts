export const APP_NAME = "SkinDesk";
export const APP_DESCRIPTION =
  "SkinDesk es una plataforma enfocada en el cuidado de la piel que combina tecnología y dermatología para ofrecer recomendaciones personalizadas, análisis de productos y rutinas adaptadas a cada tipo de piel.";

export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  authCallback: "/auth/callback",
  dashboard: "/dashboard",
  settings: "/settings",
} as const;

export const PUBLIC_ROUTES: readonly string[] = [
  ROUTES.home,
  ROUTES.login,
  ROUTES.register,
  ROUTES.authCallback,
];

export const QUERY_KEYS = {
  user: "user",
  session: "session",
} as const;

export const EMAIL_FROM_DEV = "onboarding@resend.dev";
