import {
  SkeletonContentCard,
  SkeletonHero,
} from "@/components/shared/dashboard-skeleton";

export default function SettingsLoading() {
  return (
    <div className="grid gap-4">
      <SkeletonHero />
      <SkeletonContentCard rows={4} withAside />
      <SkeletonContentCard rows={3} />
      <SkeletonContentCard rows={5} />
      <SkeletonContentCard rows={2} />
    </div>
  );
}
