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
