/**
 * Plan service
 *
 * Takes a tree of manifests, the facts context and compiles a plan of actions to be taken.
 */

import { Manifest } from "./Manifest";

export class PlanService {
  // TODO: change from string to the complex type for a plan step.
  plan: Plan | null = null;

  constructor(
    public manifests: Manifest[],
    public context: Record<string, any>,
  ) {}

  compile(): Plan {
    //TODO: implement the logic to compile a plan from the manifests and context.
    return new Plan();
  }
}

class Plan {
  steps: PlanStep[] = [];
}

class PlanStep {}
