export type CrapEntry = {
  name: string;
  namespace: string;
  complexity: number;
  coverage: number | undefined;
  crap: number | undefined;
};

export function crapScore(
  complexity: number,
  coveragePct: number | undefined,
): number | undefined {
  if (coveragePct === undefined) {
    return undefined;
  }
  const uncovered = 1 - coveragePct / 100;
  return complexity * complexity * uncovered ** 3 + complexity;
}

export function sortByCrap(entries: readonly CrapEntry[]): CrapEntry[] {
  return [...entries].sort((a, b) => {
    if (a.crap === undefined && b.crap === undefined) {
      return 0;
    }
    if (a.crap === undefined) {
      return 1;
    }
    if (b.crap === undefined) {
      return -1;
    }
    return b.crap - a.crap;
  });
}

export function formatJson(entries: readonly CrapEntry[]): string {
  const rows = entries.map((entry) => ({
    function: entry.name,
    namespace: entry.namespace,
    cc: entry.complexity,
    coverage: entry.coverage ?? null,
    crap: entry.crap ?? null,
  }));
  return `${JSON.stringify(rows, null, 2)}\n`;
}

export function formatReport(entries: readonly CrapEntry[]): string {
  const header = formatRow("Function", "Namespace", "CC", "Cov%", "CRAP");
  const separator = "-".repeat(header.length);
  const rows = entries.map((entry) =>
    formatRow(
      entry.name,
      entry.namespace,
      String(entry.complexity),
      formatCoverage(entry.coverage),
      formatCrap(entry.crap),
    ),
  );
  return ["CRAP Report", "===========", header, separator, ...rows, ""].join(
    "\n",
  );
}

function formatRow(
  name: string,
  namespace: string,
  cc: string,
  coverage: string,
  crap: string,
): string {
  return `${name.padEnd(30)} ${namespace.padEnd(35)} ${cc.padStart(4)} ${coverage.padStart(7)} ${crap.padStart(8)}`;
}

function formatCoverage(coverage: number | undefined): string {
  if (coverage === undefined) {
    return "  N/A ";
  }
  return `${coverage.toFixed(1)}%`;
}

function formatCrap(crap: number | undefined): string {
  if (crap === undefined) {
    return "     N/A";
  }
  return crap.toFixed(1);
}
