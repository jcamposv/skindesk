import {
  SkeletonHero,
  SkeletonStatStrip,
  SkeletonTable,
} from "@/components/shared/dashboard-skeleton";

export default function SuperAdminLoading() {
  return (
    <div className="grid gap-6">
      <SkeletonHero />
      <SkeletonStatStrip count={4} />
      <SkeletonTable rows={6} columns={5} />
    </div>
  );
}
