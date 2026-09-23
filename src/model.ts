export type Factor = "treatment" | "ecology" | "delivery";
export type Project = {
  id: string;
  name: string;
  area: string;
  acres: number;
  cost: number;
  hazard: number;
  community: number;
  water: number;
  habitat: number;
  efficacy: number;
  readiness: number;
  sensitivity: number;
};

// Entirely synthetic units and dimensionless scores: no operational dataset is implied.
export const projects: Project[] = [
  {
    id: "A",
    name: "North Ridge",
    area: "North sector",
    acres: 1120,
    cost: 1.4,
    hazard: 0.91,
    community: 89,
    water: 32,
    habitat: 42,
    efficacy: 0.73,
    readiness: 0.9,
    sensitivity: 0.5,
  },
  {
    id: "B",
    name: "Cedar Gap",
    area: "East sector",
    acres: 870,
    cost: 1.1,
    hazard: 0.84,
    community: 72,
    water: 48,
    habitat: 35,
    efficacy: 0.77,
    readiness: 0.86,
    sensitivity: 0.55,
  },
  {
    id: "C",
    name: "South Fork",
    area: "River corridor",
    acres: 1510,
    cost: 1.7,
    hazard: 0.78,
    community: 39,
    water: 95,
    habitat: 71,
    efficacy: 0.67,
    readiness: 0.73,
    sensitivity: 1.35,
  },
  {
    id: "D",
    name: "West Bench",
    area: "West sector",
    acres: 980,
    cost: 1.2,
    hazard: 0.69,
    community: 54,
    water: 58,
    habitat: 64,
    efficacy: 0.81,
    readiness: 0.83,
    sensitivity: 0.9,
  },
  {
    id: "E",
    name: "Mill Creek",
    area: "Lower watershed",
    acres: 1340,
    cost: 1.5,
    hazard: 0.72,
    community: 34,
    water: 91,
    habitat: 87,
    efficacy: 0.69,
    readiness: 0.68,
    sensitivity: 1.45,
  },
  {
    id: "F",
    name: "Pine Flats",
    area: "Community edge",
    acres: 760,
    cost: 0.9,
    hazard: 0.88,
    community: 94,
    water: 22,
    habitat: 28,
    efficacy: 0.64,
    readiness: 0.94,
    sensitivity: 0.3,
  },
  {
    id: "G",
    name: "Upper Basin",
    area: "Headwaters",
    acres: 1080,
    cost: 1.3,
    hazard: 0.65,
    community: 26,
    water: 82,
    habitat: 94,
    efficacy: 0.75,
    readiness: 0.77,
    sensitivity: 1.25,
  },
];

export type Settings = {
  budget: number;
  communityWeight: number;
  waterWeight: number;
  treatmentSpread: number;
  ecologySpread: number;
  deliverySpread: number;
};
export const defaults: Settings = {
  budget: 4.2,
  communityWeight: 35,
  waterWeight: 40,
  treatmentSpread: 25,
  ecologySpread: 45,
  deliverySpread: 20,
};
export const iterations = 360;
const masks = Array.from({ length: 1 << projects.length }, (_, i) => i);
export const maskCost = (mask: number, source: Project[] = projects) =>
  source.reduce((sum, p, i) => sum + (mask & (1 << i) ? p.cost : 0), 0);
export const maskValue = (mask: number, scores: number[]) =>
  scores.reduce((sum, score, i) => sum + (mask & (1 << i) ? score : 0), 0);
export const maskProjects = (mask: number, source: Project[] = projects) =>
  source.filter((_, i) => mask & (1 << i));
const feasible = (budget: number, source: Project[]) =>
  masks.filter((mask) => maskCost(mask, source) <= budget + 1e-8);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const rng = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

function score(
  p: Project,
  s: Settings,
  draw: Record<Factor, number>,
  local: number,
) {
  const community = s.communityWeight / 100,
    water = s.waterWeight / 100,
    habitat = Math.max(0, 1 - community - water);
  const efficacy = clamp(
    p.efficacy *
      (1 +
        ((draw.treatment * s.treatmentSpread) / 100) * (0.72 + local * 0.28)),
    0.12,
    1,
  );
  const ecological = clamp(
    1 + ((draw.ecology * s.ecologySpread) / 100) * p.sensitivity,
    0.3,
    1.7,
  );
  const delivered = clamp(
    p.readiness *
      (1 +
        ((draw.delivery * s.deliverySpread) / 100) * (1.2 - p.readiness) * 1.5),
    0.35,
    1,
  );
  return (
    p.hazard *
    efficacy *
    delivered *
    (community * p.community +
      water * p.water * ecological +
      habitat * p.habitat * ecological)
  );
}
function best(scores: number[], options: number[]) {
  let chosen = 0,
    high = -Infinity;
  for (const mask of options) {
    const value = maskValue(mask, scores);
    if (value > high) {
      high = value;
      chosen = mask;
    }
  }
  return chosen;
}
export type Run = {
  nominalMask: number;
  robustMask: number;
  baselineScores: number[];
  scenarioScores: number[][];
  optimalMasks: number[];
  inclusion: number[];
  factorSwitch: Record<Factor, number>;
  stability: number;
  meanRegret: number;
  p90Regret: number;
};
export function portfolioMetrics(run: Run, mask: number) {
  const outcomes = run.scenarioScores.map((scores) => maskValue(mask, scores));
  const sortedOutcomes = [...outcomes].sort((a, b) => a - b);
  const regrets = run.scenarioScores
    .map(
      (scores, i) =>
        maskValue(run.optimalMasks[i], scores) - maskValue(mask, scores),
    )
    .sort((a, b) => a - b);
  return {
    mean: outcomes.reduce((a, b) => a + b, 0) / outcomes.length,
    p10: sortedOutcomes[Math.floor(0.1 * sortedOutcomes.length)],
    p90: sortedOutcomes[Math.floor(0.9 * sortedOutcomes.length)],
    stability:
      run.optimalMasks.filter((optimal) => optimal === mask).length /
      run.optimalMasks.length,
    meanRegret: regrets.reduce((a, b) => a + b, 0) / regrets.length,
    p90Regret: regrets[Math.floor(0.9 * regrets.length)],
  };
}

export function simulate(
  settings: Settings,
  source: Project[] = projects,
): Run {
  if (source.length !== 7)
    throw new Error(
      "This visual pilot requires exactly seven treatment units.",
    );
  const options = feasible(settings.budget, source),
    zero = { treatment: 0, ecology: 0, delivery: 0 };
  const baselineScores = source.map((p) => score(p, settings, zero, 0));
  const random = rng(2417);
  const scenarioScores: number[][] = [],
    optimalMasks: number[] = [],
    inclusion = source.map(() => 0);
  const draws: { factors: Record<Factor, number>; locals: number[] }[] = [];
  const switches: Record<Factor, number> = {
    treatment: 0,
    ecology: 0,
    delivery: 0,
  };
  for (let drawIndex = 0; drawIndex < iterations; drawIndex++) {
    const draw = {
      treatment: random() * 2 - 1,
      ecology: random() * 2 - 1,
      delivery: random() * 2 - 1,
    };
    const locals = source.map(() => random() * 2 - 1);
    const scores = source.map((p, i) => score(p, settings, draw, locals[i]));
    const optimal = best(scores, options);
    scenarioScores.push(scores);
    optimalMasks.push(optimal);
    draws.push({ factors: draw, locals });
    source.forEach((_, i) => {
      if (optimal & (1 << i)) inclusion[i]++;
    });
  }
  const meanScores = source.map(
    (_, i) =>
      scenarioScores.reduce((sum, scores) => sum + scores[i], 0) / iterations,
  );
  const nominalMask = best(meanScores, options);
  for (const { factors, locals } of draws) {
    for (const factor of Object.keys(switches) as Factor[]) {
      const isolated = { ...zero, [factor]: factors[factor] };
      const isolatedScores = source.map((p, i) =>
        score(p, settings, isolated, locals[i]),
      );
      if (best(isolatedScores, options) !== nominalMask) switches[factor]++;
    }
  }
  const regrets = scenarioScores
    .map(
      (scores, i) =>
        maskValue(optimalMasks[i], scores) - maskValue(nominalMask, scores),
    )
    .sort((a, b) => a - b);
  let robustMask = nominalMask,
    robustObjective = -Infinity;
  for (const mask of options) {
    const values = scenarioScores
      .map((scores) => maskValue(mask, scores))
      .sort((a, b) => a - b);
    const objective = values[Math.floor(0.1 * iterations)];
    if (objective > robustObjective) {
      robustObjective = objective;
      robustMask = mask;
    }
  }
  return {
    nominalMask,
    robustMask,
    baselineScores,
    scenarioScores,
    optimalMasks,
    inclusion: inclusion.map((n) => n / iterations),
    factorSwitch: {
      treatment: switches.treatment / iterations,
      ecology: switches.ecology / iterations,
      delivery: switches.delivery / iterations,
    },
    stability:
      optimalMasks.filter((m) => m === nominalMask).length / iterations,
    meanRegret: regrets.reduce((a, b) => a + b, 0) / iterations,
    p90Regret: regrets[Math.floor(0.9 * iterations)],
  };
}
