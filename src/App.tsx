import { useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Download,
  Info,
  RotateCcw,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import {
  defaults,
  iterations,
  maskCost,
  maskProjects,
  portfolioMetrics,
  projects,
  simulate,
  type Factor,
  type Project,
  type Settings,
} from "./model";
import { parseProjectCsv, templateCsv } from "./data";
import "./App.css";

const factorName: Record<Factor, string> = {
  treatment: "Treatment effectiveness",
  ecology: "Watershed & habitat response",
  delivery: "Delivery realization",
};
const fmt = (n: number) => n.toFixed(1);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const money = (n: number) => `$${n.toFixed(1)}m`;

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportAnalysis(
  settings: Settings,
  units: Project[],
  run: ReturnType<typeof simulate>,
  imported: boolean,
) {
  const expected = portfolioMetrics(run, run.nominalMask);
  const cautious = portfolioMetrics(run, run.robustMask);
  const rows = [
    [
      "unit",
      "name",
      "cost_m",
      "expected_plan",
      "cautious_plan",
      "scenario_inclusion_pct",
    ],
    ...units.map((unit, i) => [
      unit.id,
      unit.name,
      unit.cost,
      Number(Boolean(run.nominalMask & (1 << i))),
      Number(Boolean(run.robustMask & (1 << i))),
      (run.inclusion[i] * 100).toFixed(1),
    ]),
    [],
    ["input_source", imported ? "imported_csv" : "synthetic_sample"],
    ["budget_m", settings.budget],
    ["community_weight_pct", settings.communityWeight],
    ["watershed_weight_pct", settings.waterWeight],
    [
      "habitat_weight_pct",
      100 - settings.communityWeight - settings.waterWeight,
    ],
    ["expected_mean", expected.mean.toFixed(2)],
    ["expected_p10", expected.p10.toFixed(2)],
    ["cautious_mean", cautious.mean.toFixed(2)],
    ["cautious_p10", cautious.p10.toFixed(2)],
  ];
  download(
    "decision-audit-results.csv",
    rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n"),
  );
}

function Slider({
  label,
  detail,
  value,
  min,
  max,
  step = 1,
  suffix = "%",
  onChange,
}: {
  label: string;
  detail?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="slider-row">
      <div className="slider-top">
        <label>{label}</label>
        <b>{suffix === "$" ? money(value) : `${value}${suffix}`}</b>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={
          {
            "--fill": `${((value - min) / (max - min)) * 100}%`,
          } as CSSProperties
        }
      />
      {detail && <small>{detail}</small>}
    </div>
  );
}

function BenefitRange({
  rows,
}: {
  rows: {
    label: string;
    mean: number;
    p10: number;
    p90: number;
    kind: string;
  }[];
}) {
  const min =
    Math.floor((Math.min(...rows.map((row) => row.p10)) - 8) / 10) * 10;
  const max =
    Math.ceil((Math.max(...rows.map((row) => row.p90)) + 8) / 10) * 10;
  const place = (value: number) => `${((value - min) / (max - min)) * 100}%`;
  return (
    <div
      className="range-chart"
      role="img"
      aria-label="Benefit ranges for both portfolios. Thick line shows the middle 80 percent of outcomes; dot shows the mean."
    >
      <div className="chart-labels">
        <span>PORTFOLIO SCORE IN THE 360 SCENARIOS</span>
        <span>10TH–90TH PERCENTILE</span>
      </div>
      {rows.map((row) => (
        <div className="range-row" key={row.kind}>
          <div className="range-name">
            <span className={`small-dot ${row.kind}`} />
            <strong>{row.label}</strong>
          </div>
          <div className="range-track">
            <div className="grid-line one" />
            <div className="grid-line two" />
            <div className="grid-line three" />
            <div
              className={`range-segment ${row.kind}`}
              style={{
                left: place(row.p10),
                width: `${((row.p90 - row.p10) / (max - min)) * 100}%`,
              }}
            />
            <div
              className={`mean-dot ${row.kind}`}
              style={{ left: place(row.mean) }}
              title={`Mean ${fmt(row.mean)}`}
            />
          </div>
          <b>
            {fmt(row.mean)} <small>mean</small>
          </b>
        </div>
      ))}
      <div className="range-axis">
        <span>{min}</span>
        <span>{Math.round((min + max) / 2)} planning points</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function App() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [units, setUnits] = useState<Project[]>(projects);
  const [fileName, setFileName] = useState("");
  const [dataError, setDataError] = useState("");
  const [page, setPage] = useState<"audit" | "method">("audit");
  const [selectedPlan, setSelectedPlan] = useState<"expected" | "cautious">(
    "expected",
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const run = useMemo(() => simulate(settings, units), [settings, units]);
  const expected = portfolioMetrics(run, run.nominalMask);
  const cautious = portfolioMetrics(run, run.robustMask);
  const expectedUnits = maskProjects(run.nominalMask, units);
  const cautiousUnits = maskProjects(run.robustMask, units);
  const common = expectedUnits.filter((unit) => cautiousUnits.includes(unit));
  const expectedOnly = expectedUnits.filter(
    (unit) => !cautiousUnits.includes(unit),
  );
  const cautiousOnly = cautiousUnits.filter(
    (unit) => !expectedUnits.includes(unit),
  );
  const factors = (Object.keys(run.factorSwitch) as Factor[]).sort(
    (a, b) => run.factorSwitch[b] - run.factorSwitch[a],
  );
  const currentMask =
    selectedPlan === "expected" ? run.nominalMask : run.robustMask;
  const current = selectedPlan === "expected" ? expected : cautious;
  const isSample = fileName === "";
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((old) => ({ ...old, [key]: value }));

  async function loadFile(file?: File) {
    if (!file) return;
    try {
      const next = parseProjectCsv(await file.text());
      setUnits(next);
      setFileName(file.name);
      setDataError("");
      setPage("audit");
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : "Could not read this CSV.",
      );
    }
    if (fileInput.current) fileInput.current.value = "";
  }
  function restore() {
    setSettings(defaults);
    setUnits(projects);
    setFileName("");
    setDataError("");
    setSelectedPlan("expected");
  }
  function isolate(factor: Factor) {
    setSettings((old) => ({
      ...old,
      treatmentSpread:
        factor === "treatment"
          ? old.treatmentSpread || defaults.treatmentSpread
          : 0,
      ecologySpread:
        factor === "ecology" ? old.ecologySpread || defaults.ecologySpread : 0,
      deliverySpread:
        factor === "delivery"
          ? old.deliverySpread || defaults.deliverySpread
          : 0,
    }));
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="header-inner">
          <button
            className="wordmark"
            onClick={() => setPage("audit")}
            aria-label="Decision audit home"
          >
            <span className="mark">
              <i />
              <i />
              <i />
            </span>
            <span>
              decision<span className="wordmark-light">audit</span>
            </span>
          </button>
          <span className="header-context">
            Wildfire treatment planning / independent prototype
          </span>
          <nav>
            <button
              className={page === "audit" ? "active" : ""}
              onClick={() => setPage("audit")}
            >
              Analysis
            </button>
            <button
              className={page === "method" ? "active" : ""}
              onClick={() => setPage("method")}
            >
              Method
            </button>
            <a
              href="https://github.com/AndrewGordienko/vibrant-planet-decision-lab"
              target="_blank"
              rel="noreferrer"
              aria-label="View source on GitHub"
            >
              <span className="source-text">Source ↗</span>
            </a>
          </nav>
        </div>
      </header>
      <input
        className="hidden-file"
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => loadFile(event.target.files?.[0])}
        aria-label="Load treatment units CSV"
      />
      {page === "audit" ? (
        <main className="main-content">
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">
                <span /> AN INTERACTIVE RESEARCH NOTE <i /> ANDREW GORDIENKO
              </div>
              <h1>
                Which treatment
                <br />
                <em>would you fund next?</em>
              </h1>
              <p>
                The thesis: propagate uncertainty all the way to the funded
                project list. Then find which assumption can change that list.
              </p>
              <div className="hero-actions">
                <a href="#decision" className="primary-link">
                  See the decision <ArrowRight size={16} />
                </a>
                <button onClick={() => setPage("method")}>
                  How this works <BookOpen size={15} />
                </button>
              </div>
            </div>
            <div className="brief-card">
              <div className="brief-label">
                <Info size={15} /> THE PLANNING QUESTION
              </div>
              <p>
                Seven candidate treatment units. One budget. After choosing the
                strong candidates, the final slot depends on what a treatment
                actually delivers.
              </p>
              <div className="brief-numbers">
                <div>
                  <strong>{money(settings.budget)}</strong>
                  <span>available</span>
                </div>
                <div>
                  <strong>{units.length}</strong>
                  <span>candidate units</span>
                </div>
                <div>
                  <strong>{iterations}</strong>
                  <span>plausible outcomes</span>
                </div>
              </div>
            </div>
          </section>
          <div className="sample-note">
            <span className="note-pip" />
            <strong>
              {isSample ? "Illustrative case" : `Imported: ${fileName}`}
            </strong>
            <span>
              {isSample
                ? "The units and scores are invented; the decision analysis is executable."
                : "Values stay in your browser. The decisions are recalculated from your seven units."}
            </span>
            {!isSample && <button onClick={restore}>Restore sample</button>}
          </div>
          {dataError && (
            <div className="error-note" role="alert">
              {dataError}
            </div>
          )}
          <section id="decision" className="answer-section">
            <div className="section-head">
              <span className="section-index">01 / THE DECISION</span>
              <h2>Two reasonable plans. Different tradeoffs.</h2>
              <p>
                The same budget can favor average score or protection against a
                poor outcome.
              </p>
            </div>
            <div className="common-line">
              <span>COMMON TO BOTH PLANS</span>
              {common.length ? (
                common.map((unit) => <b key={unit.id}>{unit.name}</b>)
              ) : (
                <b>No common units at these settings</b>
              )}
              <span className="common-explain">
                The remaining choice is where uncertainty matters.
              </span>
            </div>
            <div className="plan-grid">
              <button
                className={`plan-card expected ${selectedPlan === "expected" ? "selected" : ""}`}
                onClick={() => setSelectedPlan("expected")}
              >
                <div className="card-top">
                  <span>PLAN A · HIGHEST AVERAGE</span>
                  <i>{selectedPlan === "expected" ? "VIEWING" : "VIEW PLAN"}</i>
                </div>
                <h3>
                  {expectedOnly.length
                    ? expectedOnly.map((unit) => unit.name).join(" + ")
                    : "Same selected units"}
                </h3>
                <p>
                  {expectedOnly.length
                    ? "The expected-value choice for the contested slot."
                    : "The expected-value plan under these assumptions."}
                </p>
                <div className="plan-stats">
                  <div>
                    <strong>{fmt(expected.mean)}</strong>
                    <span>average score</span>
                  </div>
                  <div>
                    <strong>{fmt(expected.p10)}</strong>
                    <span>lower-tenth score¹</span>
                  </div>
                </div>
                <div className="plan-units">
                  {expectedUnits.map((unit) => (
                    <span key={unit.id}>
                      {unit.id} · {unit.name}
                    </span>
                  ))}
                </div>
              </button>
              <button
                className={`plan-card cautious ${selectedPlan === "cautious" ? "selected" : ""}`}
                onClick={() => setSelectedPlan("cautious")}
              >
                <div className="card-top">
                  <span>PLAN B · PROTECT THE DOWNSIDE</span>
                  <i>{selectedPlan === "cautious" ? "VIEWING" : "VIEW PLAN"}</i>
                </div>
                <h3>
                  {cautiousOnly.length
                    ? cautiousOnly.map((unit) => unit.name).join(" + ")
                    : "Same selected units"}
                </h3>
                <p>
                  {cautiousOnly.length
                    ? "The choice that maximizes the lower tenth of outcomes."
                    : "The downside-protected plan under these assumptions."}
                </p>
                <div className="plan-stats">
                  <div>
                    <strong>{fmt(cautious.mean)}</strong>
                    <span>average score</span>
                  </div>
                  <div>
                    <strong>{fmt(cautious.p10)}</strong>
                    <span>lower-tenth score¹</span>
                  </div>
                </div>
                <div className="plan-units">
                  {cautiousUnits.map((unit) => (
                    <span key={unit.id}>
                      {unit.id} · {unit.name}
                    </span>
                  ))}
                </div>
              </button>
            </div>
            <div className="tradeoff">
              <div className="tradeoff-icon">↔</div>
              {run.nominalMask !== run.robustMask ? (
                <p>
                  Choosing the downside plan gives up{" "}
                  <strong>
                    {fmt(expected.mean - cautious.mean)} average points
                  </strong>{" "}
                  to gain{" "}
                  <strong>{fmt(cautious.p10 - expected.p10)} points</strong> in
                  the lower tenth of outcomes.
                </p>
              ) : (
                <p>
                  Both decision rules select the same projects at these
                  settings. Adjust the assumptions below to find a boundary.
                </p>
              )}
            </div>
          </section>
          <section className="evidence-section">
            <div className="section-head">
              <span className="section-index">02 / THE EVIDENCE</span>
              <h2>See the uncertainty reach the decision.</h2>
              <p>
                The bars show the middle 80% of simulated score. The dots show
                the average.
              </p>
            </div>
            <div className="evidence-grid">
              <div className="evidence-card">
                <BenefitRange
                  rows={[
                    {
                      label: "Highest average",
                      mean: expected.mean,
                      p10: expected.p10,
                      p90: expected.p90,
                      kind: "expected",
                    },
                    {
                      label: "Protect downside",
                      mean: cautious.mean,
                      p10: cautious.p10,
                      p90: cautious.p90,
                      kind: "cautious",
                    },
                  ]}
                />
                <div className="evidence-footer">
                  <strong>{pct(current.stability)}</strong>
                  <span>
                    of outcomes select the plan you are viewing as the best one.
                  </span>
                  <strong>{fmt(current.meanRegret)}</strong>
                  <span>
                    average points it misses by versus a plan chosen with
                    perfect hindsight.
                  </span>
                </div>
              </div>
              <div className="evidence-card driver-card">
                <div className="card-caption">
                  WHAT ACTUALLY CHANGES THE PROJECT LIST?
                </div>
                <p>
                  Vary one uncertain handoff at a time. Each bar shows how often
                  the highest-average plan changes.
                </p>
                {factors.map((factor) => (
                  <div className="factor" key={factor}>
                    <div>
                      <strong>{factorName[factor]}</strong>
                      <b>{pct(run.factorSwitch[factor])}</b>
                    </div>
                    <div className="factor-track">
                      <i style={{ width: pct(run.factorSwitch[factor]) }} />
                    </div>
                    <button onClick={() => isolate(factor)}>
                      Isolate this factor <ArrowRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section id="experiment" className="experiment-section">
            <div className="section-head">
              <span className="section-index">
                03 / TRY A DIFFERENT ASSUMPTION
              </span>
              <h2>Move the inputs. Watch the choice.</h2>
              <p>
                Every control reruns the 360 outcomes and searches all feasible
                portfolios.
              </p>
            </div>
            <div className="experiment-grid">
              <div className="experiment-controls">
                <div className="control-group">
                  <div className="group-title">
                    <SlidersHorizontal size={16} /> Budget and priorities
                  </div>
                  <Slider
                    label="Treatment budget"
                    detail="Available to fund projects"
                    value={settings.budget}
                    min={2.5}
                    max={6.5}
                    step={0.1}
                    suffix="$"
                    onChange={(n) => update("budget", n)}
                  />
                  <Slider
                    label="Community protection"
                    value={settings.communityWeight}
                    min={10}
                    max={80}
                    onChange={(n) =>
                      update(
                        "communityWeight",
                        Math.min(n, 100 - settings.waterWeight),
                      )
                    }
                  />
                  <Slider
                    label="Watershed protection"
                    value={settings.waterWeight}
                    min={10}
                    max={70}
                    onChange={(n) =>
                      update(
                        "waterWeight",
                        Math.min(n, 100 - settings.communityWeight),
                      )
                    }
                  />
                  <div className="remaining">
                    Habitat receives the remaining{" "}
                    <strong>
                      {100 - settings.communityWeight - settings.waterWeight}%
                    </strong>
                    .
                  </div>
                </div>
                <div className="control-group">
                  <div className="group-title">Uncertainty to propagate</div>
                  <Slider
                    label="Treatment effectiveness"
                    detail="Possible variation around expected effect"
                    value={settings.treatmentSpread}
                    min={0}
                    max={60}
                    onChange={(n) => update("treatmentSpread", n)}
                  />
                  <Slider
                    label="Watershed & habitat response"
                    value={settings.ecologySpread}
                    min={0}
                    max={60}
                    onChange={(n) => update("ecologySpread", n)}
                  />
                  <Slider
                    label="Delivery realization"
                    value={settings.deliverySpread}
                    min={0}
                    max={60}
                    onChange={(n) => update("deliverySpread", n)}
                  />
                </div>
                <button className="reset" onClick={restore}>
                  <RotateCcw size={15} /> Reset example
                </button>
              </div>
              <div className="experiment-result">
                <div className="result-top">
                  <span>LIVE RESULT</span>
                  <b>
                    {selectedPlan === "expected"
                      ? "HIGHEST AVERAGE"
                      : "PROTECT DOWNSIDE"}
                  </b>
                </div>
                <h3>
                  {maskProjects(currentMask, units)
                    .map((unit) => unit.name)
                    .join(" + ")}
                </h3>
                <p>
                  {money(maskCost(currentMask, units))} of{" "}
                  {money(settings.budget)} allocated
                </p>
                <div className="result-numbers">
                  <div>
                    <strong>{fmt(current.mean)}</strong>
                    <span>average score</span>
                  </div>
                  <div>
                    <strong>{fmt(current.p10)}</strong>
                    <span>lower-tenth score¹</span>
                  </div>
                  <div>
                    <strong>{pct(current.stability)}</strong>
                    <span>chosen across outcomes</span>
                  </div>
                </div>
                <div className="result-note">
                  ¹ The score exceeded this value in 90% of the simulated
                  outcomes. Scores are dimensionless planning points in this
                  illustrative case.
                </div>
              </div>
            </div>
          </section>
          <section className="units-section">
            <div className="section-head">
              <span className="section-index">04 / THE CANDIDATES</span>
              <h2>Which units compete for funding?</h2>
              <p>
                Scenario inclusion tells you how often a project appears in the
                best plan for a plausible outcome.
              </p>
            </div>
            <div className="unit-table">
              <div className="table-header">
                <span>PROJECT</span>
                <span>COST</span>
                <span>IN EXPECTED PLAN</span>
                <span>IN DOWNSIDE PLAN</span>
                <span>SCENARIO INCLUSION</span>
              </div>
              {[...units]
                .sort(
                  (a, b) =>
                    run.inclusion[units.indexOf(b)] -
                    run.inclusion[units.indexOf(a)],
                )
                .map((unit) => {
                  const i = units.indexOf(unit);
                  return (
                    <div className="table-row" key={unit.id}>
                      <div className="unit-id">
                        <b>{unit.id}</b>
                        <span>
                          <strong>{unit.name}</strong>
                          <small>
                            {unit.area} · {unit.acres.toLocaleString()} acres
                          </small>
                        </span>
                      </div>
                      <span>{money(unit.cost)}</span>
                      <span>
                        {run.nominalMask & (1 << i) ? "Selected" : "—"}
                      </span>
                      <span>
                        {run.robustMask & (1 << i) ? "Selected" : "—"}
                      </span>
                      <div className="table-inclusion">
                        <i>
                          <i style={{ width: pct(run.inclusion[i]) }} />
                        </i>
                        <b>{pct(run.inclusion[i])}</b>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
          <section className="handoff">
            <div>
              <span>TAKE IT FURTHER</span>
              <h2>Use the same audit on an agreed model output.</h2>
              <p>
                Load seven treatment units with modeled hazard, outcome scores,
                costs and treatment assumptions. The browser reruns the decision
                search; the invented sample scores are not required.
              </p>
            </div>
            <div>
              <button onClick={() => fileInput.current?.click()}>
                <Upload size={16} /> Load unit CSV
              </button>
              <button
                onClick={() =>
                  download("treatment-units-template.csv", templateCsv())
                }
              >
                <Download size={16} /> Download template
              </button>
              <button
                onClick={() => exportAnalysis(settings, units, run, !isSample)}
              >
                <Download size={16} /> Export current run
              </button>
            </div>
          </section>
          <footer>
            <span>
              Andrew Gordienko · independent prototype for a Vibrant Planet
              interview discussion
            </span>
            <span>
              <button onClick={() => setPage("method")}>
                Method & limits <ArrowRight size={14} />
              </button>
              <a
                href="https://github.com/AndrewGordienko/vibrant-planet-decision-lab"
                target="_blank"
                rel="noreferrer"
              >
                Source code <ArrowRight size={14} />
              </a>
            </span>
          </footer>
        </main>
      ) : (
        <main className="main-content method-content">
          <button className="back-link" onClick={() => setPage("audit")}>
            <ArrowLeft size={16} /> Back to the decision
          </button>
          <div className="eyebrow">
            <span /> METHOD & LIMITS
          </div>
          <h1>
            What is this audit
            <br />
            <em>actually doing?</em>
          </h1>
          <p className="method-lead">
            It tests whether uncertainty changes a treatment choice, rather than
            reporting uncertainty in the fire model alone.
          </p>
          <div className="method-steps">
            <div>
              <b>01</b>
              <h3>Accept a hazard input</h3>
              <p>
                Each unit has a fixed illustrative hazard score. The exercise
                starts after fire modeling.
              </p>
            </div>
            <div>
              <b>02</b>
              <h3>Propagate downstream uncertainty</h3>
              <p>
                Sample treatment effect, ecological response and delivery
                realization 360 times with a fixed seed.
              </p>
            </div>
            <div>
              <b>03</b>
              <h3>Re-optimize the portfolio</h3>
              <p>
                For every outcome, enumerate all subsets of seven units and keep
                the highest-scoring one under budget.
              </p>
            </div>
            <div>
              <b>04</b>
              <h3>Report decision consequences</h3>
              <p>
                Compare average and lower-tail plans, project inclusion, plan
                stability and perfect-hindsight regret.
              </p>
            </div>
          </div>
          <div className="method-columns">
            <section>
              <span>THE SCORING RULE</span>
              <h2>Transparent by design.</h2>
              <p>
                Unit score = hazard × treatment effectiveness × delivery
                realization × weighted community, water and habitat outcomes.
                The outcome scores are dimensionless. The weights are controlled
                on the analysis page.
              </p>
              <p>
                Expected plan: maximize mean portfolio score. Downside plan:
                maximize the 10th-percentile score. The uncertainty bands are
                bounded uniform draws, not calibrated probabilities.
              </p>
            </section>
            <section>
              <span>THE REAL PROJECT</span>
              <h2>What I would validate next.</h2>
              <p>
                Replace the illustrative values with agreed unit exports and
                empirical uncertainty distributions. Add spatial spillovers,
                dependence across outcomes, permitting and workforce
                constraints. Check whether the shortlist changes at real
                decision boundaries.
              </p>
              <p>
                The first useful work package is an auditable answer to: which
                downstream assumption can change the treatment order, and where
                would better evidence matter?
              </p>
            </section>
          </div>
          <div className="method-sources">
            <strong>Public basis</strong>
            <p>
              Vibrant Planet describes Pyrologix-powered wildfire modeling and
              project sequencing under budget, workforce and acreage
              constraints. This independent prototype does not use their
              internal model or data.
            </p>
            <a
              href="https://vibrantplanet.com/platform"
              target="_blank"
              rel="noreferrer"
            >
              Vibrant Planet platform <ArrowRight size={14} />
            </a>
            <a
              href="https://go.vibrantplanet.net/learn/management-outcomes"
              target="_blank"
              rel="noreferrer"
            >
              Management Outcomes <ArrowRight size={14} />
            </a>
          </div>
          <div className="method-actions">
            <button
              onClick={() =>
                download("treatment-units-template.csv", templateCsv())
              }
            >
              <Download size={16} /> Download data template
            </button>
            <button onClick={() => fileInput.current?.click()}>
              <Upload size={16} /> Load unit CSV
            </button>
          </div>
          <footer>
            <span>Andrew Gordienko · independent prototype</span>
            <button onClick={() => setPage("audit")}>
              Back to the decision <ArrowRight size={14} />
            </button>
          </footer>
        </main>
      )}
    </div>
  );
}

export default App;
