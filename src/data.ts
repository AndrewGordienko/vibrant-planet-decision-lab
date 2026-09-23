import { projects, type Project } from "./model";

export const columns = [
  "id",
  "name",
  "area",
  "acres",
  "cost",
  "hazard",
  "community",
  "water",
  "habitat",
  "efficacy",
  "readiness",
  "sensitivity",
] as const;
const numeric: Record<string, [number, number]> = {
  acres: [1, 1000000],
  cost: [0.01, 1000],
  hazard: [0, 1],
  community: [0, 100],
  water: [0, 100],
  habitat: [0, 100],
  efficacy: [0, 1],
  readiness: [0, 1],
  sensitivity: [0, 3],
};

function rows(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) result.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted value.");
  row.push(cell);
  if (row.some((v) => v.trim())) result.push(row);
  return result;
}

export function parseProjectCsv(text: string): Project[] {
  const data = rows(text.replace(/^\uFEFF/, ""));
  if (data.length < 2)
    throw new Error("The CSV needs a header and seven treatment units.");
  const header = data[0].map((value) => value.trim().toLowerCase());
  for (const column of columns)
    if (!header.includes(column)) throw new Error(`Missing column: ${column}`);
  if (data.length !== 8)
    throw new Error(
      `Expected seven treatment units; found ${data.length - 1}.`,
    );
  const ids = new Set<string>();
  return data.slice(1).map((row, index) => {
    const item = Object.fromEntries(
      columns.map((column) => [
        column,
        (row[header.indexOf(column)] ?? "").trim(),
      ]),
    );
    for (const key of ["id", "name", "area"])
      if (!item[key]) throw new Error(`Row ${index + 2}: ${key} is required.`);
    if (ids.has(item.id)) throw new Error(`Duplicate unit ID: ${item.id}`);
    ids.add(item.id);
    const values: Record<string, number> = {};
    for (const [key, [low, high]] of Object.entries(numeric)) {
      const value = Number(item[key]);
      if (
        item[key] === "" ||
        !Number.isFinite(value) ||
        value < low ||
        value > high
      )
        throw new Error(
          `Row ${index + 2}: ${key} must be between ${low} and ${high}.`,
        );
      values[key] = value;
    }
    return {
      ...projects[index],
      id: item.id,
      name: item.name,
      area: item.area,
      ...values,
    } as Project;
  });
}

export function templateCsv() {
  const quote = (value: string | number) =>
    `"${String(value).replaceAll('"', '""')}"`;
  return (
    [
      columns.join(","),
      ...projects.map((project) =>
        columns.map((column) => quote(project[column])).join(","),
      ),
    ].join("\n") + "\n"
  );
}
