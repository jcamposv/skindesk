"use client";

import dynamic from "next/dynamic";

import { SkeletonCalendar } from "@/components/shared/dashboard-skeleton";

import type { AgendaCalendarProps } from "./agenda-calendar";

/**
 * Lazy entry point for the agenda calendar. The full `AgendaCalendar`
 * bundle pulls in `react-big-calendar` + `date-fns/locale/es` + the
 * calendar's own CSS — easily the heaviest client island in the staff
 * dashboard. We dynamic-import it client-side (`ssr: false`) so the
 * agenda route's first paint costs only the page shell + this wrapper.
 *
 * `ssr: false` is required: react-big-calendar reads DOM APIs on mount
 * and crashes the RSC stream when rendered on the server. The route
 * still has its own `loading.tsx` (Phase 1) for the very first
 * navigation — `<SkeletonCalendar>` here only shows for the brief
 * gap between hydration and the chunk arriving.
 */
const AgendaCalendarImpl = dynamic(
  () =>
    import("./agenda-calendar").then((m) => ({
      default: m.AgendaCalendar,
    })),
  {
    ssr: false,
    loading: () => <SkeletonCalendar />,
  },
);

export function AgendaCalendarLazy(props: AgendaCalendarProps) {
  return <AgendaCalendarImpl {...props} />;
}
