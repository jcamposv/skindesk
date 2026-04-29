import type { Database } from "@/types/database.types";

type PublicSchema = Database["public"];

/** Row type of a public table. */
export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Row: infer R } ? R : never;

/** Insert payload of a public table. */
export type InsertTables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Insert: infer I } ? I : never;

/** Update payload of a public table. */
export type UpdateTables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Update: infer U } ? U : never;

/** Server Action standard return shape. */
export type ActionState<T = unknown> = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  data?: T;
};

// ---------------------------------------------------------------------------
// Roles & permissions
// ---------------------------------------------------------------------------

/** Mirror of the Postgres enum `public.app_role`. */
export const APP_ROLES = [
  "super_admin",
  "profesional",
  "asistente",
  "clienta",
] as const;
export type AppRole = (typeof APP_ROLES)[number];

/** Permission keys the asistente JSONB supports. Extend as the domain grows. */
export const ASISTENTE_PERMISSION_KEYS = [
  "agenda",
  "pagos",
  "clientas",
  "catalogo",
] as const;
export type AsistentePermissionKey = (typeof ASISTENTE_PERMISSION_KEYS)[number];
export type AsistentePermissionLevel = "view" | "edit" | null;

/**
 * Shape of `profiles.permissions` for an asistente. Other roles have `{}`.
 * `null` means the permission is not granted; `'view'` allows read; `'edit'`
 * allows read + write.
 */
export type AsistentePermissions = Record<
  AsistentePermissionKey,
  AsistentePermissionLevel
>;

// ---------------------------------------------------------------------------
// Auth methods (email + password and magic link enabled in this scaffold).
// ---------------------------------------------------------------------------

export type AuthMethod = "password" | "magic-link";

export type AuthConfig = {
  enablePassword: boolean;
  enableMagicLink: boolean;
  enableOAuth: boolean;
  oauthProviders: ReadonlyArray<
    "google" | "github" | "discord" | "apple" | "twitter"
  >;
};

export const AUTH_CONFIG: AuthConfig = {
  enablePassword: true,
  enableMagicLink: true,
  enableOAuth: false,
  oauthProviders: [],
};
