import {
  SkeletonForm,
  SkeletonHero,
} from "@/components/shared/dashboard-skeleton";

export default function SuperAdminAtlasNewLoading() {
  return (
    <div className="grid gap-6">
      <SkeletonHero />
      <SkeletonForm fields={7} />
    </div>
  );
}
