"use client";

import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface PendingTask {
  id: string;
  label: string;
  /** Initial checked state — local state takes over once the user clicks. */
  done?: boolean;
}

interface PendingTasksProps {
  initialTasks: readonly PendingTask[];
}

/**
 * Local-state task list. Persisting to the backend will replace `useState`
 * with an action + optimistic update; the row component stays the same.
 *
 * Lifted state lives at the list level (not per-row) so the future
 * "complete all" / bulk-action affordance can read every task without
 * each row owning its own piece of state — applies the
 * `state-lift-state` rule.
 */
export function PendingTasks({ initialTasks }: PendingTasksProps) {
  const [tasks, setTasks] = useState<readonly PendingTask[]>(initialTasks);

  function toggle(id: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {tasks.map((task) => {
        const checkboxId = `task-${task.id}`;
        return (
          <li key={task.id} className="flex items-start gap-3">
            <Checkbox
              id={checkboxId}
              checked={task.done}
              onCheckedChange={() => toggle(task.id)}
              className="mt-0.5"
            />
            <label
              htmlFor={checkboxId}
              className={cn(
                "cursor-pointer select-none text-sm leading-tight",
                task.done && "text-muted-foreground line-through",
              )}
            >
              {task.label}
            </label>
          </li>
        );
      })}
    </ul>
  );
}
