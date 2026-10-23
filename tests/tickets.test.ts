import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import { parseWorkbook } from "@/lib/excel";
import { computeNewRows, countByStudent, validateRows, type TicketRow } from "@/lib/tickets";

const HEADERS = ["Student ID", "Name", "Purchaser Email", "Dietary requirements", "Membership"];

function row(studentId: string, name = "Test Person"): TicketRow {
  return {
    studentId,
    name,
    email: "test@example.com",
    dietaryRequirements: "Vegetarian",
    membership: "Member",
  };
}

function xlsx(grid: unknown[][]): Uint8Array {
  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.aoa_to_sheet(grid), "Product Sales");
  return write(wb, { type: "array", bookType: "xlsx" });
}

describe("computeNewRows (count per Student ID)", () => {
  it("returns all rows when nothing exists", () => {
    const rows = [row("S1"), row("S2"), row("S1")];
    expect(computeNewRows(rows, {})).toHaveLength(3);
  });

  it("skips as many rows as tickets already exist", () => {
    const rows = [row("S1", "a"), row("S1", "b"), row("S1", "c"), row("S2")];
    const result = computeNewRows(rows, { S1: 2, S2: 1 });
    expect(result.map((r) => r.name)).toEqual(["c"]);
  });

  it("is case-insensitive on Student ID", () => {
    expect(computeNewRows([row("s1")], countByStudent(["S1"]))).toHaveLength(0);
  });

  it("re-uploading the same sheet yields nothing new", () => {
    const rows = [row("S1"), row("S1"), row("S2")];
    const existing = countByStudent(rows.map((r) => r.studentId));
    expect(computeNewRows(rows, existing)).toHaveLength(0);
  });
});

describe("validateRows", () => {
  it("accepts good rows", () => {
    expect(validateRows([row("S1")])).toEqual([]);
  });

  it("rejects cells that would email several or other recipients", () => {
    for (const email of ["a@x.com,b@y.com", "a@x.com; b@y.com", "Name <a@x.com>", '"a"@x.com']) {
      expect(validateRows([{ ...row("S1"), email }])).toHaveLength(1);
    }
  });

  it("flags empty fields and bad emails with the Excel row number", () => {
    const errors = validateRows([row("S1"), { ...row(""), email: "not-an-email" }]);
    expect(errors).toEqual([
      { row: 3, message: "Student ID is empty" },
      { row: 3, message: 'Invalid email "not-an-email"' },
    ]);
  });
});

describe("parseWorkbook", () => {
  it("parses a sheet with headers in any case and extra columns", () => {
    const data = xlsx([
      ["student id", " NAME ", "Purchaser Email", "Dietary Requirements", "Membership", "Notes"],
      ["S100", "Alice", "alice@example.com", "Vegetarian", "Member", "x"],
      [],
      [12345, "Bob", "bob@example.com", "Non-Vegetarian", "Non-Member", ""],
    ]);
    const result = parseWorkbook(data);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { studentId: "S100", name: "Alice", email: "alice@example.com", dietaryRequirements: "Vegetarian", membership: "Member" },
      { studentId: "12345", name: "Bob", email: "bob@example.com", dietaryRequirements: "Non-Vegetarian", membership: "Non-Member" },
    ]);
  });

  it("reports missing columns", () => {
    const result = parseWorkbook(xlsx([["Student ID", "Name", "Purchaser Email"], ["S1", "A", "a@b.co"]]));
    expect(result.errors.map((e) => e.message)).toEqual([
      'Missing column "Dietary requirements"',
      'Missing column "Membership"',
    ]);
  });

  it("reports bad rows with their Excel row numbers (blank lines skipped)", () => {
    const result = parseWorkbook(
      xlsx([HEADERS, ["S1", "A", "a@b.co", "Veg", "Member"], [], ["S2", "", "nope", "Veg", "Member"]])
    );
    expect(result.errors).toEqual([
      { row: 4, message: "Name is empty" },
      { row: 4, message: 'Invalid email "nope"' },
    ]);
  });

  // Parse-only check against the real sheet if it's present locally (it is
  // gitignored). Nothing is emailed.
  it.skipIf(!existsSync("Diwali_Members.xlsx"))("parses the real purchaser sheet", () => {
    const result = parseWorkbook(new Uint8Array(readFileSync("Diwali_Members.xlsx")));
    expect(result.errors).toEqual([]);
    expect(result.rows.length).toBeGreaterThan(0);
  });
});
