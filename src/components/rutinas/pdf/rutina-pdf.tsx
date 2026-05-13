import "server-only";

import {
  Circle,
  Document,
  Image,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";

import { productoActionLabel } from "@/schemas/productos.schema";
import { type RutinaMomento } from "@/schemas/rutinas.schema";
import type { RutinaWithSteps } from "@/services/rutinas.service";

interface RutinaPDFProps {
  rutina: RutinaWithSteps;
  /** When the rutina is an assignment, the cliente's display name is shown
   *  in the brand strip — mirrors the reference design. Templates pass
   *  `null` and the strip falls back to the routine name. */
  clientName: string | null;
}

// ─── Palette ───────────────────────────────────────────────────────────────
// Matches the in-app momento pills + brand colors. Hardcoded HEX because
// React-PDF has no CSS variables; the source of truth for our palette
// remains `src/app/globals.css` — keep these in sync if it drifts.

const palette = {
  page: "#FAF6F1",
  card: "#FFFFFF",
  border: "#EEE7DD",
  text: "#2F2F2F",
  textMuted: "#6B6B6B",
  textFaint: "#A0A0A0",
  copper: "#BB7154",
  copperSoft: "#FBEFE7",
  honey: "#D2A96A",
  honeySoft: "#F8EFD7",
  am: {
    bg: "#FDF6E7",
    iconBg: "#FBE6B5",
    accent: "#C47A2B",
    text: "#7C5E1F",
    cardTint: "#FBEFD8",
  },
  pm: {
    bg: "#F0ECFB",
    iconBg: "#DCD0F1",
    accent: "#6B4FA0",
    text: "#5B3F92",
    cardTint: "#E7DFF6",
  },
} as const;

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    backgroundColor: palette.page,
    paddingTop: 26,
    paddingHorizontal: 26,
    paddingBottom: 26,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: palette.text,
    lineHeight: 1.4,
  },
  // ─── Brand strip ──────────────────────────────────────────────────
  brandStrip: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  brandStack: {
    flexDirection: "column",
    lineHeight: 1,
  },
  brandRutina: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    color: palette.text,
    lineHeight: 1,
  },
  brandSkincare: {
    fontSize: 22,
    fontFamily: "Helvetica-BoldOblique",
    letterSpacing: 1.4,
    color: palette.copper,
    lineHeight: 1,
    marginTop: 2,
  },
  clientPillWrap: {
    marginLeft: 16,
  },
  clientPill: {
    backgroundColor: palette.copper,
    color: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 18,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.5,
  },
  brandSpacer: { flex: 1 },
  brandMeta: {
    fontSize: 9,
    color: palette.textFaint,
    letterSpacing: 0.4,
  },
  // ─── Section (AM/PM) ──────────────────────────────────────────────
  section: {
    marginBottom: 14,
    borderRadius: 12,
    padding: 14,
  },
  sectionAm: { backgroundColor: palette.am.bg },
  sectionPm: { backgroundColor: palette.pm.bg },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sectionIconAm: { backgroundColor: palette.am.iconBg },
  sectionIconPm: { backgroundColor: palette.pm.iconBg },
  sectionTitleStack: { flexDirection: "column" },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
  },
  sectionTagline: {
    fontSize: 9.5,
    color: palette.textMuted,
    marginTop: 2,
  },
  // ─── Grid of cards ────────────────────────────────────────────────
  cardsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 10,
    padding: 12,
    minHeight: 150,
    flexDirection: "row",
    gap: 10,
  },
  cardThird: { width: "32.6%" },
  cardHalf: { width: "49%" },
  cardWide: { width: "100%" },
  cardPhotoBox: {
    width: 60,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 6,
  },
  cardPhoto: {
    width: 60,
    height: 90,
    objectFit: "contain",
  },
  cardPhotoPlaceholder: {
    width: 60,
    height: 90,
    borderRadius: 6,
    backgroundColor: "#F3EEE7",
    alignItems: "center",
    justifyContent: "center",
  },
  cardPhotoPlaceholderText: {
    fontSize: 8,
    color: palette.textFaint,
  },
  cardBody: {
    flex: 1,
    flexDirection: "column",
  },
  stepBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  stepNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumAm: { backgroundColor: palette.am.accent },
  stepNumPm: { backgroundColor: palette.pm.accent },
  stepNumText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  stepLabel: {
    fontSize: 10,
    color: palette.textMuted,
    fontFamily: "Helvetica-Oblique",
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.2,
    marginTop: 2,
  },
  productName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: palette.text,
    marginTop: 3,
    letterSpacing: 0.3,
  },
  productMeta: {
    fontSize: 8.5,
    color: palette.textMuted,
    marginTop: 1,
    letterSpacing: 0.2,
  },
  description: {
    fontSize: 8.5,
    color: palette.text,
    marginTop: 5,
    lineHeight: 1.45,
  },
  tipPill: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 7.5,
    color: palette.am.text,
    backgroundColor: palette.honeySoft,
  },
  // ─── Footer strip per section ──────────────────────────────────────
  sectionFooter: {
    flexDirection: "row",
    marginTop: 10,
    gap: 10,
  },
  footerPill: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 8.5,
    color: palette.textMuted,
    textAlign: "center",
  },
  // ─── Notes block ──────────────────────────────────────────────────
  notesBlock: {
    backgroundColor: "#E7ECEA",
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  notesHeading: {
    fontSize: 9,
    color: "#4F605C",
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
    letterSpacing: 0.8,
  },
  notesBody: { fontSize: 9, color: palette.text, lineHeight: 1.45 },
  // ─── Page footer ───────────────────────────────────────────────────
  pageFooter: {
    marginTop: "auto",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pageFooterText: { fontSize: 8, color: palette.textFaint },
});

// ─── SVG icons (Helvetica has no sun/moon glyphs) ──────────────────────────

function SunIconSvg({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="4.5" fill={color} />
      {/* 8 rays */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = 12 + Math.cos(rad) * 7.5;
        const y1 = 12 + Math.sin(rad) * 7.5;
        const x2 = 12 + Math.cos(rad) * 10.5;
        const y2 = 12 + Math.sin(rad) * 10.5;
        return (
          <Path
            key={angle}
            d={`M ${x1} ${y1} L ${x2} ${y2}`}
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}

function MoonIconSvg({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M 20 14.5 A 9 9 0 1 1 9.5 4 A 7 7 0 0 0 20 14.5 Z"
        fill={color}
      />
    </Svg>
  );
}

// Compose "NAME · BRAND" but skip the second half when the strings collide
// (common when a user typed the brand into the name field).
function productHeadline(name: string, brand: string | null): string {
  const cleanName = name.trim().toUpperCase();
  const cleanBrand = brand?.trim().toUpperCase() ?? "";
  if (!cleanBrand || cleanBrand === cleanName) return cleanName;
  return `${cleanName} · ${cleanBrand}`;
}

// ─── Step filtering by momento ─────────────────────────────────────────────

type StepWithProducto = RutinaWithSteps["steps"][number];

function stepsForMomento(
  rutina: RutinaWithSteps,
  momento: "am" | "pm",
): StepWithProducto[] {
  if (rutina.momento === "am" && momento === "pm") return [];
  if (rutina.momento === "pm" && momento === "am") return [];
  return rutina.steps.filter((s) => {
    const tod = s.custom_time_of_day;
    if (!tod) return true;
    if (tod === "both") return true;
    return tod === momento;
  });
}

// ─── Sub-components ────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  momento,
  cardWidthStyle,
}: {
  step: StepWithProducto;
  index: number;
  momento: "am" | "pm";
  cardWidthStyle: typeof styles.cardWide;
}) {
  const m = momento === "am" ? palette.am : palette.pm;
  const stepNumStyle = momento === "am" ? styles.stepNumAm : styles.stepNumPm;
  const photoUrl = step.producto.photoUrl;
  const skinTypes = step.producto.skin_types ?? [];
  const skinTypeLabel =
    skinTypes.length > 0
      ? `PIEL ${skinTypes.map((s) => s.toUpperCase()).join("-")}`
      : null;

  const description =
    step.custom_instruction?.trim() ||
    step.producto.application_instruction?.trim() ||
    "";

  const amount =
    step.custom_amount?.trim() || step.producto.suggested_amount?.trim() || "";
  const frequency =
    step.custom_frequency?.trim() || step.producto.frequency?.trim() || "";

  return (
    <View style={[styles.card, cardWidthStyle]}>
      <View style={styles.cardPhotoBox}>
        {photoUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image style={styles.cardPhoto} src={photoUrl} />
        ) : (
          <View style={styles.cardPhotoPlaceholder}>
            <Text style={styles.cardPhotoPlaceholderText}>Producto</Text>
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.stepBadgeRow}>
          <View style={[styles.stepNum, stepNumStyle]}>
            <Text style={styles.stepNumText}>{index + 1}</Text>
          </View>
          <Text style={styles.stepLabel}>Paso {index + 1}</Text>
        </View>

        <Text style={[styles.actionLabel, { color: m.text }]}>
          {productoActionLabel(step.producto.category)}
        </Text>

        <Text style={styles.productName}>
          {productHeadline(step.producto.name, step.producto.brand)}
        </Text>

        {skinTypeLabel ? (
          <Text style={styles.productMeta}>{skinTypeLabel}</Text>
        ) : null}

        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}

        {amount || frequency ? (
          <Text style={styles.productMeta}>
            {[amount, frequency].filter(Boolean).join(" · ")}
          </Text>
        ) : null}

        {step.notes?.trim() ? (
          <Text style={[styles.tipPill, { color: m.text }]}>
            Tip: {step.notes.trim()}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function MomentoSection({
  rutina,
  momento,
}: {
  rutina: RutinaWithSteps;
  momento: "am" | "pm";
}) {
  const steps = stepsForMomento(rutina, momento);
  if (steps.length === 0) return null;
  const isAm = momento === "am";
  const m = isAm ? palette.am : palette.pm;
  const title = isAm ? "RUTINA AM" : "RUTINA PM";
  const tagline = isAm
    ? "Empieza tu día cuidando tu piel"
    : "El momento perfecto para regenerar tu piel";

  // Pick a card width so the grid feels balanced. 3 per row by default;
  // 2 per row for exactly 2 steps; full-width for a single step.
  const cardWidthStyle =
    steps.length === 1
      ? styles.cardWide
      : steps.length === 2
        ? styles.cardHalf
        : styles.cardThird;

  return (
    <View
      style={[
        styles.section,
        isAm ? styles.sectionAm : styles.sectionPm,
      ]}
    >
      <View style={styles.sectionHeader}>
        <View
          style={[
            styles.sectionIcon,
            isAm ? styles.sectionIconAm : styles.sectionIconPm,
          ]}
        >
          {isAm ? (
            <SunIconSvg color={palette.am.accent} />
          ) : (
            <MoonIconSvg color={palette.pm.accent} />
          )}
        </View>
        <View style={styles.sectionTitleStack}>
          <Text style={[styles.sectionTitle, { color: m.text }]}>{title}</Text>
          <Text style={styles.sectionTagline}>{tagline}</Text>
        </View>
      </View>

      <View style={styles.cardsRow}>
        {steps.map((step, idx) => (
          <StepCard
            key={step.id}
            step={step}
            index={idx}
            momento={momento}
            cardWidthStyle={cardWidthStyle}
          />
        ))}
      </View>

      {rutina.client_message?.trim() ? (
        <View style={styles.sectionFooter}>
          <Text style={styles.footerPill}>{rutina.client_message.trim()}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Main document ─────────────────────────────────────────────────────────

const MOMENTO_LABEL: Record<RutinaMomento, string> = {
  am: "AM",
  pm: "PM",
  both: "AM + PM",
};

export function RutinaPDF({ rutina, clientName }: RutinaPDFProps) {
  const momento = rutina.momento as RutinaMomento;
  const pillLabel = (clientName ?? rutina.name).toUpperCase();
  const showAm = momento === "am" || momento === "both";
  const showPm = momento === "pm" || momento === "both";

  return (
    <Document
      title={rutina.name}
      author="SkinDesk"
      subject={`Rutina · ${rutina.name}`}
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.brandStrip}>
          <View style={styles.brandStack}>
            <Text style={styles.brandRutina}>RUTINA</Text>
            <Text style={styles.brandSkincare}>SKINCARE</Text>
          </View>
          <View style={styles.clientPillWrap}>
            <Text style={styles.clientPill}>{pillLabel}</Text>
          </View>
          <View style={styles.brandSpacer} />
          <Text style={styles.brandMeta}>
            {MOMENTO_LABEL[momento]} · {rutina.steps.length}{" "}
            {rutina.steps.length === 1 ? "paso" : "pasos"}
          </Text>
        </View>

        {showAm ? <MomentoSection rutina={rutina} momento="am" /> : null}
        {showPm ? <MomentoSection rutina={rutina} momento="pm" /> : null}

        {rutina.general_notes?.trim() ? (
          <View style={styles.notesBlock}>
            <Text style={styles.notesHeading}>NOTAS GENERALES</Text>
            <Text style={styles.notesBody}>
              {rutina.general_notes.trim()}
            </Text>
          </View>
        ) : null}

        <View style={styles.pageFooter}>
          <Text style={styles.pageFooterText}>SkinDesk · {rutina.name}</Text>
          <Text style={styles.pageFooterText}>
            Generada{" "}
            {new Intl.DateTimeFormat("es", { dateStyle: "long" }).format(
              new Date(),
            )}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
