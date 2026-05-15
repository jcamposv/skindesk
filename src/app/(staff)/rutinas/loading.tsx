import {
  SkeletonCardGrid,
  SkeletonHero,
  SkeletonStatStrip,
  SkeletonToolbar,
} from "@/components/shared/dashboard-skeleton";

export default function RutinasLoading() {
  return (
    <div className="grid gap-6">
      <SkeletonHero withButton />
      <SkeletonStatStrip count={4} />
      <SkeletonToolbar />
      <SkeletonCardGrid count={8} variant="compact" />
    </div>
  );
}
