import {
  SkeletonHero,
  SkeletonStatStrip,
  SkeletonTable,
} from "@/components/shared/dashboard-skeleton";

export default function ClientesLoading() {
  return (
    <div className="grid gap-6">
      <SkeletonHero withButton />
      <SkeletonStatStrip count={5} highlightFirst />
      <SkeletonTable rows={8} columns={6} />
    </div>
  );
}
