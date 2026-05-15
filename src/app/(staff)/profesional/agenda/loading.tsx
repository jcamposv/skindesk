import {
  SkeletonCalendar,
  SkeletonHero,
} from "@/components/shared/dashboard-skeleton";

export default function AgendaLoading() {
  return (
    <div className="grid gap-6">
      <SkeletonHero withButton />
      <SkeletonCalendar />
    </div>
  );
}
