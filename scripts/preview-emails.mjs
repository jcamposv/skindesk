// Run with: npx tsx scripts/preview-emails.mjs
// Stubs `server-only` (Next.js compile-time guard) so the templates can be
// imported from a plain node script.
import Module from "node:module";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";

const requireCJS = createRequire(import.meta.url);
const stubPath = requireCJS.resolve("./.server-only-stub.cjs");
const _resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return stubPath;
  return _resolve.call(this, request, ...rest);
};

const cases = [
  {
    file: "magic-link.html",
    mod: () => import("../src/components/emails/magic-link.ts"),
    args: { magicLink: "https://example.com/magic", appUrl: "https://example.com" },
    fn: "magicLinkHtml",
  },
  {
    file: "password-reset.html",
    mod: () => import("../src/components/emails/password-reset.ts"),
    args: { resetLink: "https://example.com/reset", appUrl: "https://example.com" },
    fn: "passwordResetHtml",
  },
  {
    file: "welcome-profesional.html",
    mod: () => import("../src/components/emails/welcome-profesional.ts"),
    args: {
      fullName: "Carolina",
      planName: "Pro",
      magicLink: "https://example.com/magic",
      appUrl: "https://example.com",
    },
    fn: "welcomeProfesionalHtml",
  },
  {
    file: "payment-failed.html",
    mod: () => import("../src/components/emails/payment-failed.ts"),
    args: {
      planName: "Pro",
      amountDue: "$39.00",
      nextAttempt: "5 de mayo",
      hostedInvoiceUrl: "https://example.com/invoice",
      manageBillingUrl: "https://example.com/settings",
    },
    fn: "paymentFailedHtml",
  },
];

mkdirSync("/tmp/skindesk-emails", { recursive: true });

for (const c of cases) {
  const m = await c.mod();
  const html = m[c.fn](c.args);
  writeFileSync(`/tmp/skindesk-emails/${c.file}`, html);
  console.log(`wrote /tmp/skindesk-emails/${c.file}`);
}
