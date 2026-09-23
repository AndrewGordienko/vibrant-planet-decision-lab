# Which treatment would you fund next?

**[Open the live interactive demo](https://andrewgordienko.github.io/vibrant-planet-decision-lab/)**

An interactive research note and self-contained interview prototype for a possible Vibrant Planet / Pyrologix uncertainty-propagation project. It starts **after** the fire model: fixed unit-level hazard inputs flow through uncertain treatment performance, ecological response, and delivery realization into a budget-constrained treatment portfolio. The main output is a decision: which units to select, how often that decision changes, and which downstream uncertainty causes the changes.

The supplied seven-unit case is **synthetic**. It is designed to expose a near-boundary planning decision, not to represent any real geography or Vibrant Planet output. Imported unit values stay in the browser; no data is uploaded to a server. The article compares the two portfolio decisions and lets a reader rerun the analysis with new values.

## Run

```bash
cd vibrant-planet-demo
npm ci
npm run dev
```

Open the localhost URL printed by Vite. The project uses React, TypeScript, and Vite. There is no backend or API key.

```bash
npm test       # decision-engine and CSV-validation tests
npm run lint  # source and test lint
npm run build # TypeScript and production bundle
```

## Five-minute manager walkthrough

1. Read the thesis and $4.2m planning question at the top of the article.
2. Compare the two funded portfolios. North Ridge and Cedar Gap are shared; West Bench and Pine Flats are the contested choice.
3. Continue to the range chart and one-factor experiment. The ecological-response band is the dominant decision driver in the sample.
4. Select the downside plan. Its 10th-percentile score improves while its mean score drops.
5. Change the embedded budget, outcome weights, and uncertainty bands. Download the analysis CSV, or load the unit CSV template with changed values.
6. Open **Method** to discuss the model boundary and the data needed for a real pilot.

## Decision model

For unit _i_ in scenario _s_:

```text
score(i,s) = fixed_hazard(i)
             × treatment_effectiveness(i,s)
             × delivery_realization(i,s)
             × [w_community × community(i)
                + ecological_response(i,s) ×
                  (w_water × water(i) + w_habitat × habitat(i))]
```

Scores are dimensionless decision units. Costs are in millions of dollars. The three outcome weights add to one. Treatment effect, ecological response, and delivery realization are sampled with bounded uniform draws and a fixed seed. The treatment draw has a small unit-specific component; ecology has unit-specific sensitivity; the shared draws make scenarios partially dependent across units. These are **illustrative uncertainty distributions**, not calibrated posteriors.

The optimizer enumerates every feasible subset of the seven candidate units. This is an exact solution for the scoped sample, including the budget constraint. The **expected-value plan** maximizes mean score over 360 scenarios. The **conservative plan** maximizes the 10th-percentile score. For each scenario, the optimizer also solves the best portfolio if that scenario were known. This produces:

- **Plan stability:** share of scenarios in which the displayed plan is the scenario optimum.
- **Decision regret:** scenario-optimal score minus displayed-plan score, averaged across scenarios. This is an oracle gap / perfect-information upper bound, not a forecast of achievable improvement.
- **Scenario inclusion:** share of scenario-optimal portfolios containing a unit.
- **One-factor flips:** share of draws that change the expected-value plan when only one downstream factor is varied. This is a screening measure, not a variance-decomposition attribution; factors can interact.

The model, parser, and tests are in [`src/model.ts`](src/model.ts), [`src/data.ts`](src/data.ts), and [`tests/analysis.test.ts`](tests/analysis.test.ts).

## Bring a unit table

Click **Load unit CSV**, or download a template from the end of the article or the **Method** page. The pilot accepts exactly seven rows. Required columns:

| Column                          | Meaning                            | Valid range          |
| ------------------------------- | ---------------------------------- | -------------------- |
| `id`, `name`, `area`            | Unit identifiers and labels        | nonempty, IDs unique |
| `acres`                         | Treatment area                     | 1–1,000,000          |
| `cost`                          | Cost in $m                         | 0.01–1,000           |
| `hazard`                        | Fixed hazard score                 | 0–1                  |
| `community`, `water`, `habitat` | Normalized outcome exposure scores | 0–100                |
| `efficacy`                      | Baseline treatment effectiveness   | 0–1                  |
| `readiness`                     | Baseline delivery realization      | 0–1                  |
| `sensitivity`                   | Ecological-response multiplier     | 0–3                  |

The parser handles quoted CSV fields, validates column presence and numeric ranges, and reports errors in the UI. The analysis CSV records the chosen units, inclusion frequencies, settings, and summary metrics.

## What a real pilot would require

1. Agree on a small set of actual treatment units, modeled no-action and post-action outcomes, and the decision maker's values and operational constraints.
2. Replace synthetic uncertainty bands with empirical or elicited joint distributions. Preserve correlations across nearby units and across linked stages; test calibration against observed treatment outcomes where possible.
3. Add spatial spillovers and non-additive treatment effects. The current sum of unit benefits is intentionally a bounded first model, not a substitute for fire resimulation.
4. Validate whether recommended portfolios remain feasible under workforce, permitting, sequencing, and acreage constraints. Confirm that changes in score correspond to decisions a planner would actually make.
5. Define the question for a grant work package as a decision audit: which uncertain handoffs change a shortlist, what is the possible regret, and where would new evidence have the most decision value?

This prototype does **not** reproduce or replace Pyrologix's fire models, Vibrant Planet's ForSys planning workflow, or any operational risk assessment. It does not claim that the illustrative results generalize to a real landscape.

## Public research basis

- [Vibrant Planet platform overview](https://vibrantplanet.com/platform): Pyrologix-powered hazard/risk modeling, ForSys sequencing, budget and workforce constraints, and changing priorities.
- [Management Outcomes documentation](https://go.vibrantplanet.net/learn/management-outcomes): no-action, post-action, and change views for modeled wildfire hazard.
- [Vibrant Planet research index](https://vibrantplanet.com/research): includes wildfire risk, decision-support, and uncertainty publications.
