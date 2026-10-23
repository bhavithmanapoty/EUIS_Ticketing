import { read, utils } from "xlsx";
import {
  COLUMNS,
  COLUMN_LABELS,
  MAX_ROWS,
  normaliseHeader,
  validateRows,
  normaliseRow,
  type RowError,
  type TicketRow,
} from "@/lib/tickets";

export type ParseResult = {
  sheetName: string;
  rows: TicketRow[];
  errors: RowError[];
};

// Zero-width / BOM characters pasted from other apps would make "S123" and
// "S123\u200b" look like different students.
function clean(value: unknown): string {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .trim();
}

/** Parses the first visible worksheet of an .xlsx file into ticket rows. */
export function parseWorkbook(data: ArrayBuffer | Uint8Array): ParseResult {
  const wb = read(data, { type: "array" });
  // First visible sheet (exports sometimes include hidden helper sheets).
  const sheetName =
    wb.SheetNames.find((_, i) => !wb.Workbook?.Sheets?.[i]?.Hidden) ?? wb.SheetNames[0];
  if (!sheetName) {
    return { sheetName: "", rows: [], errors: [{ row: 0, message: "The file has no sheets" }] };
  }

  // Array-of-arrays with formatted text, so numeric IDs stay as written.
  const grid = utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  });

  const headers = (grid[0] ?? []).map(normaliseHeader);
  const indexes = COLUMNS.map(({ header, field }) => ({
    field,
    index: headers.indexOf(header),
  }));
  const missing = indexes.filter((c) => c.index === -1);
  if (missing.length) {
    return {
      sheetName,
      rows: [],
      errors: missing.map((c) => ({
        row: 1,
        message: `Missing column "${COLUMN_LABELS[c.field]}"`,
      })),
    };
  }

  const rows: TicketRow[] = [];
  const rowNumbers: number[] = [];
  grid.slice(1).forEach((cells, i) => {
    const values = indexes.map(({ index }) => clean(cells[index]));
    if (values.every((v) => v === "")) return; // skip blank lines
    const raw: Partial<TicketRow> = {};
    indexes.forEach(({ field }, j) => (raw[field] = values[j]));
    rows.push(normaliseRow(raw));
    rowNumbers.push(i + 2);
  });

  if (rows.length === 0) {
    return { sheetName, rows, errors: [{ row: 0, message: "No data rows found" }] };
  }

  // Validate one row at a time so error row numbers match Excel even when
  // blank lines were skipped.
  const errors = rows.flatMap((r, i) => validateRows([r], rowNumbers[i]));
  if (rows.length > MAX_ROWS) {
    errors.unshift({ row: 0, message: `Too many rows (max ${MAX_ROWS})` });
  }
  return { sheetName, rows, errors };
}
