import { useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  Download,
  Layers3,
  Map,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import {
  defaults,
  iterations,
  maskCost,
  maskProjects,
  maskValue,
  portfolioMetrics,
  projects,
  simulate,
  type Factor,
  type Project,
  type Settings,
} from "./model";
import { parseProjectCsv, templateCsv } from "./data";
import "./App.css";

const percent = (n: number) => `${Math.round(n * 100)}%`;
const money = (n: number) => `$${n.toFixed(1)}m`;
const factorLabels: Record<Factor, string> = {
  treatment: "Treatment effect",
  ecology: "Ecological response",
  delivery: "Delivery timing",
};

function exportCsv(
  settings: Settings,
  run: ReturnType<typeof simulate>,
  mask: number,
  units: Project[],
) {
  const selectedMetrics = portfolioMetrics(run, mask);
  const lines = [
    [
      "unit",
      "name",
      "cost_m",
      "selected",
      "scenario_inclusion_pct",
      "nominal_score",
    ],
    ...units.map((p, i) => [
      p.id,
      p.name,
      p.cost.toFixed(1),
      String(Boolean(mask & (1 << i))),
      (run.inclusion[i] * 100).toFixed(1),
      run.baselineScores[i].toFixed(2),
    ]),
    [],
    ["input_source", units === projects ? "synthetic_sample" : "imported_csv"],
    ["budget_m", settings.budget.toFixed(1)],
    ["community_weight_pct", settings.communityWeight],
    ["watershed_weight_pct", settings.waterWeight],
    [
      "habitat_weight_pct",
      100 - settings.communityWeight - settings.waterWeight,
    ],
    ["plan_stability_pct", (selectedMetrics.stability * 100).toFixed(1)],
    ["mean_regret_score", selectedMetrics.meanRegret.toFixed(2)],
  ];
  const csv = lines
    .map((row) =>
      row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
    link = document.createElement("a");
  link.href = url;
  link.download = "vibrant-planet-decision-demo.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: "%" | "$";
  onChange: (n: number) => void;
}) {
  return (
    <div className="control">
      <div className="control-head">
        <label>{label}</label>
        <strong>{unit === "$" ? money(value) : `${value}%`}</strong>
      </div>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={
          {
            "--progress": `${((value - min) / (max - min)) * 100}%`,
          } as CSSProperties
        }
      />
      <span className="hint">{hint}</span>
    </div>
  );
}

function Landscape({
  mask,
  focus,
  onFocus,
  units,
  isSample,
}: {
  mask: number;
  focus: string;
  onFocus: (id: string) => void;
  units: Project[];
  isSample: boolean;
}) {
  return (
    <div className="map-canvas">
      <svg
        viewBox="0 0 540 450"
        role="img"
        aria-label="Illustrative landscape containing seven clickable treatment units"
      >
        <defs>
          <linearGradient id="terrain" x1="0" x2="1" y1="0" y2="1">
            <stop stopColor="#f3f5eb" />
            <stop offset="1" stopColor="#dfe9e0" />
          </linearGradient>
          <pattern
            id="dots"
            width="17"
            height="17"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r=".8" fill="#a8b9a8" opacity=".6" />
          </pattern>
        </defs>
        <rect width="540" height="450" fill="url(#terrain)" />
        <path
          d="M0 20 C100 5 144 59 220 34 S408 -10 540 39 M-40 87 C60 60 110 102 178 74 S370 39 550 81 M-50 143 C74 97 130 151 204 123 S383 85 560 137 M-35 204 C64 165 119 203 198 178 S391 156 563 196 M-28 268 C52 231 132 253 213 227 S390 207 561 260 M-15 329 C86 281 150 320 229 293 S421 278 560 323 M-22 391 C75 355 143 385 244 356 S437 346 565 396"
          fill="none"
          stroke="#bdccbd"
          strokeWidth="1.4"
          opacity=".72"
        />
        <path
          d="M40 0 C64 63 25 139 66 197 S76 316 26 450 M112 -10 C141 66 98 104 124 157 S117 290 74 359 M486 -15 C446 57 482 100 446 158 S490 269 471 334 M518 15 C497 91 529 123 498 198 S520 330 491 413"
          fill="none"
          stroke="#c5d2c2"
          strokeWidth="1"
        />
        <path
          d="M-20 350 C92 337 149 316 220 287 S296 247 338 219 S395 200 560 179"
          fill="none"
          stroke="#fff"
          strokeWidth="18"
          opacity=".55"
        />
        <path
          d="M-20 350 C92 337 149 316 220 287 S296 247 338 219 S395 200 560 179"
          fill="none"
          stroke="#a4c6c8"
          strokeWidth="4"
          opacity=".9"
        />
        <path
          d="M104 64 C143 112 146 169 188 213 S246 310 328 373"
          fill="none"
          stroke="#fff"
          strokeWidth="6"
        />
        <path
          d="M104 64 C143 112 146 169 188 213 S246 310 328 373"
          fill="none"
          stroke="#c2c9b7"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <path
          d="M52 155 C132 96 246 43 368 37 S500 106 528 145 L498 386 C435 444 288 434 196 404 S38 322 29 257 Z"
          fill="url(#dots)"
          opacity=".5"
        />
        {units.map((p, i) => {
          const selected = Boolean(mask & (1 << i)),
            focused = p.id === focus;
          return (
            <g
              key={p.id}
              className="map-unit"
              role="button"
              tabIndex={0}
              aria-label={`${p.name}, ${selected ? "selected" : "candidate"}`}
              onClick={() => onFocus(p.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onFocus(p.id);
                }
              }}
            >
              <path
                d={p.shape}
                className={`unit-shape ${selected ? "selected" : ""} ${focused ? "focused" : ""}`}
              />
              {focused && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="22"
                  fill="none"
                  stroke="#314f43"
                  strokeWidth="1.5"
                />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r="14"
                fill={focused ? "#314f43" : selected ? "#d47b5c" : "#fffdf7"}
                stroke="#fff"
                strokeWidth="2"
              />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                className={`unit-letter ${focused || selected ? "light" : ""}`}
              >
                {p.id}
              </text>
            </g>
          );
        })}
        <g className="map-place">
          <circle cx="448" cy="83" r="5" />
          <text x="458" y="87">
            RIDGE TOWN
          </text>
        </g>
        <g className="map-place">
          <circle cx="70" cy="330" r="5" />
          <text x="81" y="334">
            LOWER VALLEY
          </text>
        </g>
        <text className="river-label" x="366" y="314">
          SOUTH FORK
        </text>
        <g className="north-arrow" transform="translate(493 388)">
          <path d="M0 16 L8 -8 L16 16 L8 10 Z" />
          <text x="8" y="-16" textAnchor="middle">
            N
          </text>
        </g>
      </svg>
      <div className="map-label">
        <span />{" "}
        {isSample ? "SYNTHETIC LANDSCAPE" : "SCHEMATIC MAP · IMPORTED VALUES"}
      </div>
      <div className="map-legend">
        <span>
          <i className="legend selected" /> Selected
        </span>
        <span>
          <i className="legend candidate" /> Candidate
        </span>
        <span>
          <i className="legend river" /> Waterway
        </span>
      </div>
    </div>
  );
}

function Histogram({ values, nominal }: { values: number[]; nominal: number }) {
  const min = Math.floor(Math.min(...values) / 10) * 10,
    max = Math.ceil(Math.max(...values) / 10) * 10,
    bins = Array.from({ length: 24 }, () => 0);
  values.forEach((v) => {
    bins[Math.min(23, Math.floor(((v - min) / (max - min || 1)) * 24))]++;
  });
  const peak = Math.max(...bins),
    position = Math.max(
      0,
      Math.min(100, ((nominal - min) / (max - min || 1)) * 100),
    );
  return (
    <div className="histogram">
      <div className="chart">
        <div className="chart-grid">
          <i />
          <i />
          <i />
        </div>
        <div className="bars">
          {bins.map((n, i) => (
            <i
              key={i}
              style={{ height: `${Math.max(3, (n / peak) * 100)}%` }}
              title={`${n} scenarios`}
            />
          ))}
        </div>
        <div className="nominal-line" style={{ left: `${position}%` }}>
          <span>Nominal</span>
        </div>
      </div>
      <div className="chart-axis">
        <span>{min}</span>
        <span>Portfolio benefit · decision score</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function App() {
  const [settings, setSettings] = useState<Settings>(defaults),
    [mode, setMode] = useState<"expected" | "conservative">("expected"),
    [focus, setFocus] = useState("C"),
    [page, setPage] = useState<"overview" | "method">("overview");
  const [units, setUnits] = useState<Project[]>(projects),
    [dataError, setDataError] = useState(""),
    [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isSample = units === projects;
  async function loadCsv(file: File | undefined) {
    if (!file) return;
    try {
      const next = parseProjectCsv(await file.text());
      setUnits(next);
      setFocus(next[0].id);
      setFileName(file.name);
      setDataError("");
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : "Could not read this CSV.",
      );
    }
    if (inputRef.current) inputRef.current.value = "";
  }
  function resetData() {
    setUnits(projects);
    setFocus("C");
    setFileName("");
    setDataError("");
  }
  function downloadTemplate() {
    const url = URL.createObjectURL(
      new Blob([templateCsv()], { type: "text/csv" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "treatment-units-template.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const run = useMemo(() => simulate(settings, units), [settings, units]),
    mask = mode === "expected" ? run.nominalMask : run.robustMask,
    selected = maskProjects(mask, units);
  const focusIndex = units.findIndex((p) => p.id === focus),
    focused = units[focusIndex];
  const values = run.scenarioScores.map((scores) => maskValue(mask, scores)),
    sorted = [...values].sort((a, b) => a - b);
  const current = portfolioMetrics(run, mask),
    expected = portfolioMetrics(run, run.nominalMask),
    conservative = portfolioMetrics(run, run.robustMask);
  const mean = current.mean;
  const factors = (Object.keys(run.factorSwitch) as Factor[]).sort(
    (a, b) => run.factorSwitch[b] - run.factorSwitch[a],
  );
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((old) => ({ ...old, [key]: value }));

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Layers3 size={20} />
          </div>
          <div>
            <strong>decisionlab</strong>
            <small>ANDREW GORDIENKO</small>
          </div>
        </div>
        <div className="side-section">
          WORKSPACE <ChevronDown size={13} />
        </div>
        <div className="workspace">
          <div className="workspace-icon">
            <Layers3 size={18} />
          </div>
          <div>
            <strong>Wildfire planning</strong>
            <span>Exploratory workspace</span>
          </div>
        </div>
        <div className="side-section nav-title">ANALYSIS</div>
        <button
          className={`nav ${page === "overview" ? "active" : ""}`}
          onClick={() => setPage("overview")}
        >
          <Map size={17} />
          <span>Decision overview</span>
        </button>
        <button
          className={`nav ${page === "method" ? "active" : ""}`}
          onClick={() => setPage("method")}
        >
          <Activity size={17} />
          <span>Method & assumptions</span>
        </button>
        <div className="side-bottom">
          <div className="local">
            <i /> INTERACTIVE DEMO <span /> v0.1
          </div>
          <p>
            A compact prototype for tracing uncertainty from modeled outcomes
            into project selection.
          </p>
        </div>
      </aside>
      <main>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          aria-label="Load treatment units CSV"
          className="file-input"
          onChange={(event) => loadCsv(event.target.files?.[0])}
        />
        <header className="topbar">
          <div>
            Wildfire planning <span>/</span>{" "}
            <strong>
              {page === "overview"
                ? "Decision overview"
                : "Method & assumptions"}
            </strong>
          </div>
          <div className="top-right">
            <span className="sample">
              <i /> {isSample ? "SAMPLE ANALYSIS" : `IMPORTED · ${fileName}`}
            </span>
            <button
              aria-label={
                page === "overview" ? "Open methodology" : "Return to analysis"
              }
              onClick={() =>
                setPage(page === "overview" ? "method" : "overview")
              }
            >
              {page === "overview" ? (
                <CircleHelp size={17} />
              ) : (
                <ArrowLeft size={17} />
              )}
            </button>
            <b className="avatar">AG</b>
          </div>
        </header>
        {page === "overview" ? (
          <div className="content">
            <div className="heading">
              <div>
                <div className="eyebrow">
                  <i /> VIBRANT PLANET · INDEPENDENT PROTOTYPE
                </div>
                <h1>
                  Where does uncertainty
                  <br />
                  <em>change the plan?</em>
                </h1>
                <p>
                  Trace uncertainty beyond the fire model into treatment
                  outcomes and budget-constrained project selection.
                </p>
              </div>
              <div className="heading-actions">
                <button
                  className="export"
                  onClick={() => inputRef.current?.click()}
                >
                  Load unit CSV
                </button>
                <button
                  className="export"
                  onClick={() => exportCsv(settings, run, mask, units)}
                >
                  <Download size={16} /> Export analysis
                </button>
              </div>
            </div>
            {dataError && (
              <div className="data-error" role="alert">
                {dataError}
              </div>
            )}
            {!isSample && (
              <div className="data-notice">
                Loaded {units.length} units from {fileName}. Values stay in this
                browser. The map is a schematic layout, not imported geometry.{" "}
                <button onClick={resetData}>Restore sample</button>
              </div>
            )}
            <div className="metrics">
              <div className="metric">
                <div className="metric-label">
                  PLAN STABILITY <CircleHelp size={14} />
                </div>
                <div className="metric-number">
                  {percent(current.stability)}
                </div>
                <p>of {iterations} scenarios choose the displayed portfolio</p>
                <div className="meter">
                  <i style={{ width: percent(current.stability) }} />
                </div>
              </div>
              <div className="metric">
                <div className="metric-label">
                  DECISION REGRET <CircleHelp size={14} />
                </div>
                <div className="metric-number">
                  {current.meanRegret.toFixed(1)} <small>pts</small>
                </div>
                <p>mean foregone benefit vs. scenario-best plan</p>
                <div className="metric-extra">
                  90th percentile: {current.p90Regret.toFixed(1)} pts
                </div>
              </div>
              <div className="metric">
                <div className="metric-label">
                  BUDGET ALLOCATED <CircleHelp size={14} />
                </div>
                <div className="metric-number">
                  {money(maskCost(mask, units))}{" "}
                  <small>/ {money(settings.budget)}</small>
                </div>
                <p>
                  across {selected.length} of {units.length} candidate units
                </p>
                <div className="meter green">
                  <i
                    style={{
                      width: percent(maskCost(mask, units) / settings.budget),
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="body-grid">
              <div className="main-col">
                <section className="panel map-panel">
                  <div className="panel-title">
                    <div>
                      <span>01 / SPATIAL VIEW</span>
                      <h2>Selected treatment portfolio</h2>
                    </div>
                    <div className="tabs">
                      <button
                        className={mode === "expected" ? "active" : ""}
                        onClick={() => setMode("expected")}
                      >
                        Expected value
                      </button>
                      <button
                        className={mode === "conservative" ? "active" : ""}
                        onClick={() => setMode("conservative")}
                      >
                        Conservative
                      </button>
                    </div>
                  </div>
                  <Landscape
                    mask={mask}
                    focus={focus}
                    onFocus={setFocus}
                    units={units}
                    isSample={isSample}
                  />
                  <div className="map-footer">
                    <b>
                      <Check size={14} />
                      {selected.length} selected
                    </b>
                    <span>{selected.map((p) => p.name).join(" · ")}</span>
                  </div>
                  <div className="plan-compare">
                    <div>
                      <span>EXPECTED VALUE PLAN</span>
                      <strong>
                        {maskProjects(run.nominalMask, units)
                          .map((p) => p.id)
                          .join(" + ")}
                      </strong>
                      <small>
                        Mean {expected.mean.toFixed(1)} · lower decile{" "}
                        {expected.p10.toFixed(1)}
                      </small>
                    </div>
                    <div>
                      <span>CONSERVATIVE PLAN</span>
                      <strong>
                        {maskProjects(run.robustMask, units)
                          .map((p) => p.id)
                          .join(" + ")}
                      </strong>
                      <small>
                        Mean {conservative.mean.toFixed(1)} · lower decile{" "}
                        {conservative.p10.toFixed(1)}
                      </small>
                    </div>
                  </div>
                </section>
                <div className="analysis-grid">
                  <section className="panel distribution-panel">
                    <div className="panel-title compact">
                      <div>
                        <span>02 / OUTCOME RANGE</span>
                        <h2>What this plan delivers</h2>
                      </div>
                      <b className="scenario-tag">360 SCENARIOS</b>
                    </div>
                    <div className="range-value">
                      <strong>{mean.toFixed(0)}</strong>
                      <span>mean decision score</span>
                      <div>
                        {sorted[Math.floor(sorted.length * 0.1)].toFixed(0)} –{" "}
                        {sorted[Math.floor(sorted.length * 0.9)].toFixed(0)}
                        <small>10–90% range</small>
                      </div>
                    </div>
                    <Histogram
                      values={values}
                      nominal={maskValue(mask, run.baselineScores)}
                    />
                  </section>
                  <section className="panel driver-panel">
                    <div className="panel-title compact">
                      <div>
                        <span>03 / DECISION DRIVERS</span>
                        <h2>Which input flips the plan?</h2>
                      </div>
                    </div>
                    <p>
                      Vary one downstream factor at a time, holding fire hazard
                      fixed.
                    </p>
                    <div className="drivers">
                      {factors.map((factor, i) => (
                        <div className="driver" key={factor}>
                          <small>0{i + 1}</small>
                          <div>
                            <strong>{factorLabels[factor]}</strong>
                            <div className="driver-meter">
                              <i
                                style={{
                                  width: percent(run.factorSwitch[factor]),
                                }}
                              />
                            </div>
                          </div>
                          <b>{percent(run.factorSwitch[factor])}</b>
                        </div>
                      ))}
                    </div>
                    <div className="driver-caption">
                      Share of scenarios with a different optimal portfolio
                    </div>
                  </section>
                </div>
              </div>
              <aside className="inspector">
                <section className="panel controls">
                  <div className="controls-heading">
                    <div>
                      <span>SCENARIO SETUP</span>
                      <h2>Planning assumptions</h2>
                    </div>
                    <SlidersHorizontal size={18} />
                  </div>
                  <div className="fixed">
                    <div>
                      <Check size={15} /> Unit hazard scores
                    </div>
                    <b>Fixed input</b>
                  </div>
                  <p className="fixed-note">
                    Start from an agreed hazard model. Explore uncertainty
                    through the rest of the decision chain.
                  </p>
                  <div className="control-section">
                    <div className="section-label">PLANNING CONSTRAINT</div>
                    <Slider
                      label="Treatment budget"
                      hint="Total available for this portfolio"
                      value={settings.budget}
                      min={2.5}
                      max={6.5}
                      step={0.1}
                      unit="$"
                      onChange={(n) => update("budget", n)}
                    />
                  </div>
                  <div className="control-section">
                    <div className="section-label">OUTCOME PRIORITIES</div>
                    <Slider
                      label="Community protection"
                      hint="Weight on exposure reduction"
                      value={settings.communityWeight}
                      min={10}
                      max={80}
                      unit="%"
                      onChange={(n) =>
                        update(
                          "communityWeight",
                          Math.min(n, 100 - settings.waterWeight),
                        )
                      }
                    />
                    <Slider
                      label="Watershed protection"
                      hint="Weight on water outcomes"
                      value={settings.waterWeight}
                      min={10}
                      max={70}
                      unit="%"
                      onChange={(n) =>
                        update(
                          "waterWeight",
                          Math.min(n, 100 - settings.communityWeight),
                        )
                      }
                    />
                    <div className="remainder">
                      Habitat receives the remaining{" "}
                      <strong>
                        {100 - settings.communityWeight - settings.waterWeight}%
                      </strong>
                    </div>
                  </div>
                  <div className="control-section">
                    <div className="section-label">UNCERTAINTY BANDS</div>
                    <Slider
                      label="Treatment effect"
                      hint="Relative variation in effectiveness"
                      value={settings.treatmentSpread}
                      min={0}
                      max={60}
                      unit="%"
                      onChange={(n) => update("treatmentSpread", n)}
                    />
                    <Slider
                      label="Ecological response"
                      hint="Water and habitat outcome variation"
                      value={settings.ecologySpread}
                      min={0}
                      max={60}
                      unit="%"
                      onChange={(n) => update("ecologySpread", n)}
                    />
                    <Slider
                      label="Delivery timing"
                      hint="Realized benefit variation"
                      value={settings.deliverySpread}
                      min={0}
                      max={60}
                      unit="%"
                      onChange={(n) => update("deliverySpread", n)}
                    />
                  </div>
                  <button
                    className="reset"
                    onClick={() => {
                      setSettings(defaults);
                      setMode("expected");
                    }}
                  >
                    <RotateCcw size={14} /> Reset assumptions
                  </button>
                </section>
                <section className="insight">
                  <div>
                    <Sparkles size={18} />
                  </div>
                  <section>
                    <span>WHAT TO INVESTIGATE</span>
                    <p>
                      {run.factorSwitch[factors[0]] > 0
                        ? `${factorLabels[factors[0]]} causes the most portfolio changes in this sample. Validate that handoff before refining the selection.`
                        : "This portfolio stays unchanged across the current one-factor sweeps. Adjust the budget or uncertainty bands to find a decision boundary."}
                    </p>
                    <button onClick={() => setPage("method")}>
                      See method <ArrowRight size={14} />
                    </button>
                  </section>
                </section>
              </aside>
            </div>
            <section className="panel candidates">
              <div className="panel-title">
                <div>
                  <span>04 / CANDIDATE REVIEW</span>
                  <h2>Where the decision is close</h2>
                </div>
                <small>Click a unit to inspect its role in the plan</small>
              </div>
              <div className="table-wrap">
                <div className="table-header">
                  <span>UNIT</span>
                  <span>ROLE</span>
                  <span>SCENARIO INCLUSION</span>
                  <span>COST</span>
                  <span>NOMINAL BENEFIT</span>
                </div>
                {[...units]
                  .sort(
                    (a, b) =>
                      run.inclusion[units.indexOf(b)] -
                      run.inclusion[units.indexOf(a)],
                  )
                  .map((p) => {
                    const i = units.indexOf(p),
                      inPlan = Boolean(mask & (1 << i));
                    return (
                      <button
                        className={`table-row ${focus === p.id ? "focused" : ""}`}
                        key={p.id}
                        onClick={() => {
                          setFocus(p.id);
                          document.querySelector(".map-panel")?.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                        }}
                      >
                        <span className="unit-name">
                          <b>{p.id}</b>
                          <span>
                            <strong>{p.name}</strong>
                            <small>
                              {p.area} · {p.acres.toLocaleString()} ac
                            </small>
                          </span>
                        </span>
                        <span>
                          <i className={inPlan ? "role on" : "role"} />
                          {inPlan ? "In plan" : "Alternative"}
                        </span>
                        <span className="inclusion">
                          <i>
                            <i style={{ width: percent(run.inclusion[i]) }} />
                          </i>
                          <b>{percent(run.inclusion[i])}</b>
                        </span>
                        <span>{money(p.cost)}</span>
                        <span>{run.baselineScores[i].toFixed(1)} pts</span>
                      </button>
                    );
                  })}
              </div>
              <div className="unit-detail">
                <div>
                  <strong>{focused.name}</strong>
                  <span>{focused.area}</span>
                </div>
                <p>
                  Selected in{" "}
                  <strong>{percent(run.inclusion[focusIndex])}</strong> of
                  optimized scenarios. Its role reflects the combined community,
                  water and habitat priorities.
                </p>
              </div>
            </section>
            <footer>
              ANDREW GORDIENKO / DECISION LAB{" "}
              <span>
                Synthetic demonstration ·{" "}
                <a
                  href="https://github.com/AndrewGordienko/vibrant-planet-decision-lab"
                  target="_blank"
                  rel="noreferrer"
                >
                  View source
                </a>
              </span>
            </footer>
          </div>
        ) : (
          <div className="content method">
            <div className="eyebrow">
              <i /> MODEL NOTE · VERSION 0.1
            </div>
            <h1>
              From uncertain outcomes
              <br />
              <em>to a different decision.</em>
            </h1>
            <p className="method-intro">
              This prototype turns the planning question into a bounded
              analysis: if the fire hazard inputs are accepted, which
              uncertainties downstream are large enough to change a
              budget-constrained treatment plan?
            </p>
            <div className="flow">
              <div>
                <span>01</span>
                <strong>Agreed hazard</strong>
                <p>
                  Seven fixed, illustrative hazard scores stand in for a
                  calibrated fire-model output.
                </p>
              </div>
              <ArrowRight />
              <div>
                <span>02</span>
                <strong>Outcome propagation</strong>
                <p>
                  Sample treatment effect, ecological response, and delivery
                  timing.
                </p>
              </div>
              <ArrowRight />
              <div>
                <span>03</span>
                <strong>Decision search</strong>
                <p>
                  Enumerate every project subset under the same budget. Select
                  the highest-scoring portfolio in each sample.
                </p>
              </div>
              <ArrowRight />
              <div>
                <span>04</span>
                <strong>Decision sensitivity</strong>
                <p>
                  Report plan stability, foregone benefit, inclusion frequency,
                  and one-factor portfolio flips.
                </p>
              </div>
            </div>
            <div className="method-cards">
              <section className="panel">
                <span>WHAT THE NUMBERS MEAN</span>
                <h2>Decision model</h2>
                <p>
                  Each unit’s benefit is fixed hazard × sampled treatment
                  effectiveness × sampled delivery realization × a weighted sum
                  of community, water, and habitat scores. All scores are
                  dimensionless decision units. Bounded uniform draws and a
                  fixed seed make comparisons reproducible.
                </p>
                <p>
                  The conservative option maximizes the 10th-percentile
                  portfolio score across the same scenario set. That improves
                  the lower-tail result in the sample at a cost to average
                  benefit.
                </p>
              </section>
              <section className="panel">
                <span>WHAT A REAL PROJECT NEEDS</span>
                <h2>Replace the handoffs</h2>
                <p>
                  Use actual treatment units, fire-model outputs,
                  treatment-response estimates, agreed values and weights,
                  operational constraints, and empirical uncertainty
                  distributions. Validate dependence between uncertainties,
                  spatial spillovers, and plan feasibility.
                </p>
                <p>
                  A small first deliverable would identify which downstream
                  assumptions change a real project shortlist, then measure
                  where more evidence could reduce decision regret.
                </p>
              </section>
            </div>
            <div className="source">
              <Compass size={18} />
              <div>
                <strong>Research basis</strong>
                <p>
                  Vibrant Planet publicly describes Pyrologix fire modeling,
                  project sequencing with ForSys, and plans constrained by
                  budget, workforce, or acres. Its Management Outcomes
                  documentation compares no-action and post-action hazard. This
                  independent demo uses invented data.
                </p>
                <a
                  href="https://vibrantplanet.com/platform"
                  target="_blank"
                  rel="noreferrer"
                >
                  Platform description <ArrowRight size={13} />
                </a>
                <a
                  href="https://go.vibrantplanet.net/learn/management-outcomes"
                  target="_blank"
                  rel="noreferrer"
                >
                  Management Outcomes <ArrowRight size={13} />
                </a>
              </div>
            </div>
            <div className="data-tools">
              <button className="back" onClick={downloadTemplate}>
                <Download size={15} /> Download unit CSV template
              </button>
              <button
                className="back"
                onClick={() => inputRef.current?.click()}
              >
                Load unit CSV
              </button>
            </div>
            <button className="back" onClick={() => setPage("overview")}>
              Return to analysis <ArrowRight size={15} />
            </button>
            <footer>
              ANDREW GORDIENKO / DECISION LAB{" "}
              <span>
                Synthetic demonstration ·{" "}
                <a
                  href="https://github.com/AndrewGordienko/vibrant-planet-decision-lab"
                  target="_blank"
                  rel="noreferrer"
                >
                  View source
                </a>
              </span>
            </footer>
          </div>
        )}
      </main>
    </div>
  );
}
export default App;
