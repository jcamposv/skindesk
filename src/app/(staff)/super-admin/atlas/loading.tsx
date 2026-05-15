import {
  SkeletonHero,
  SkeletonTable,
  SkeletonToolbar,
} from "@/components/shared/dashboard-skeleton";

export default function SuperAdminAtlasLoading() {
  return (
    <div className="grid gap-6">
      <SkeletonHero withButton />
      <SkeletonToolbar />
      <SkeletonTable rows={8} columns={5} />
    </div>
  );
}
