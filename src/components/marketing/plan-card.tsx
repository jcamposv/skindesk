import Link from "next/link";
import { CheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/plans";

interface PlanCardProps {
  plan: Plan;
}

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function PlanCard({ plan }: PlanCardProps) {
  return (
    <Card
      className={cn(
        "flex h-full flex-col",
        plan.highlight && "border-accent ring-2 ring-accent/30",
      )}
    >
      <CardHeader>
        {plan.highlight ? (
          <span className="mb-2 inline-flex w-fit items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
            Más popular
          </span>
        ) : null}
        <CardTitle className="text-2xl">{plan.name}</CardTitle>
        <CardDescription>{plan.tagline}</CardDescription>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-4xl font-semibold tracking-tight">
            {USD.format(plan.monthlyPriceUsd)}
          </span>
          <span className="text-sm text-muted-foreground">/mes</span>
        </div>
        {plan.trialDays > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {plan.trialDays} días de prueba gratis
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-2 text-sm">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <CheckIcon
                className="mt-0.5 size-4 shrink-0 text-accent"
                aria-hidden
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          size="lg"
          className="w-full"
          variant={plan.highlight ? "default" : "outline"}
          render={<Link href={`/checkout?plan=${plan.slug}`} />}
        >
          Comenzar con {plan.name}
        </Button>
      </CardFooter>
    </Card>
  );
}
