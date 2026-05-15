import {
  SkeletonHero,
  SkeletonStatStrip,
  SkeletonTable,
  SkeletonToolbar,
} from "@/components/shared/dashboard-skeleton";

export default function PagosLoading() {
  return (
    <div className="grid gap-6">
      <SkeletonHero withButton />
      <SkeletonStatStrip count={4} />
      <SkeletonToolbar />
      <SkeletonTable rows={8} columns={6} />
    </div>
  );
}
