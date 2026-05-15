import {
  SkeletonChart,
  SkeletonContentCard,
  SkeletonStatStrip,
} from "@/components/shared/dashboard-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfesionalDashboardLoading() {
  return (
    <div className="grid gap-8">
      <header aria-hidden="true" className="grid gap-2">
        <Skeleton className="h-7 w-72 sm:h-8 sm:w-96" />
        <Skeleton className="h-4 w-64" />
      </header>
      <SkeletonStatStrip count={4} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SkeletonChart height={260} />
        </div>
        <SkeletonContentCard rows={4} />
        <SkeletonContentCard rows={3} />
        <SkeletonContentCard rows={3} />
        <SkeletonContentCard rows={4} />
      </div>
    </div>
  );
}
