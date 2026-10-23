import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import { parseWorkbook } from "@/lib/excel";
import { computeNewRows, countByStudent, findWarnings, validateRows, type TicketRow } from "@/lib/tickets";

const HEADERS = ["Student ID", "Name", "Purchaser Email", "Dietary requirements", "Membership"];

function row(studentId: string, name = "Test Person"): TicketRow {
  return {
    studentId,
    name,
    email: "test@example.com",
    dietaryRequirements: "Vegetarian",
    membership: "Member",
    ticketType: "",
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

  it("allows blank dietary requirements and membership", () => {
    expect(validateRows([{ ...row("S1"), dietaryRequirements: "", membership: "" }])).toEqual([]);
  });

  it("flags empty fields and bad emails with the Excel row number", () => {
    const errors = validateRows([row("S1"), { ...row(""), email: "not-an-email" }]);
    expect(errors).toEqual([
      { row: 3, message: "Student ID is empty" },
      { row: 3, message: 'Invalid email "not-an-email"' },
    ]);
  });
});

describe("findWarnings", () => {
  const r = (studentId: string, email: string, name = "P"): TicketRow => ({ ...row(studentId, name), email });

  it("is quiet for a plain re-upload", () => {
    const rows = [r("S1", "a@x.com"), r("S2", "b@x.com")];
    const existing = rows.map((x) => ({ studentId: x.studentId, email: x.email }));
    expect(findWarnings(rows, [], existing)).toEqual([]);
  });

  it("is quiet for a second ticket bought by the same student", () => {
    const rows = [r("S1", "a@x.com"), r("S1", "a@x.com")];
    expect(findWarnings(rows, [rows[1]], [{ studentId: "S1", email: "a@x.com" }])).toEqual([]);
  });

  it("warns when a corrected Student ID would give the same email a second ticket", () => {
    const rows = [r("S1234567", "a@x.com")];
    const w = findWarnings(rows, rows, [{ studentId: "S123456", email: "A@x.com" }]);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/already has a ticket under Student ID S123456/);
  });

  it("warns when a corrected email would never be emailed", () => {
    const rows = [r("S1", "fixed@x.com")];
    const w = findWarnings(rows, [], [{ studentId: "s1", email: "typo@x.com" }]);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/won't be emailed/);
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
      { studentId: "S100", name: "Alice", email: "alice@example.com", dietaryRequirements: "Vegetarian", membership: "Member", ticketType: "" },
      { studentId: "12345", name: "Bob", email: "bob@example.com", dietaryRequirements: "Non-Vegetarian", membership: "Non-Member", ticketType: "" },
    ]);
  });

  it("leaves blank optional cells empty and strips invisible characters", () => {
    const result = parseWorkbook(xlsx([HEADERS, ["S1\u200b", "A\u00a0B", "a@b.co", "", ""]]));
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toEqual({
      studentId: "S1", name: "A B", email: "a@b.co", dietaryRequirements: "", membership: "", ticketType: "",
    });
  });

  it("reads the optional Ticket Type column when present (blank cells allowed)", () => {
    const result = parseWorkbook(
      xlsx([
        [...HEADERS, "Ticket Type"],
        ["S1", "A", "a@b.co", "Veg", "Member", "VIP"],
        ["S2", "B", "b@b.co", "Veg", "Member", ""],
      ])
    );
    expect(result.errors).toEqual([]);
    expect(result.rows.map((r) => r.ticketType)).toEqual(["VIP", ""]);
  });

  it("works without the Ticket Type column", () => {
    const result = parseWorkbook(xlsx([HEADERS, ["S1", "A", "a@b.co", "Veg", "Member"]]));
    expect(result.errors).toEqual([]);
    expect(result.rows[0].ticketType).toBe("");
  });

  it("only requires Student ID, Name and Purchaser Email columns", () => {
    const result = parseWorkbook(xlsx([["Student ID", "Name", "Purchaser Email"], ["S1", "A", "a@b.co"]]));
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toEqual({
      studentId: "S1", name: "A", email: "a@b.co", dietaryRequirements: "", membership: "", ticketType: "",
    });
  });

  it("handles optional values row by row", () => {
    const result = parseWorkbook(
      xlsx([
        ["Student ID", "Name", "Purchaser Email", "Membership", "Ticket Type"],
        ["S1", "A", "a@b.co", "Member", ""],
        ["S2", "B", "b@b.co", "", "VIP"],
      ])
    );
    expect(result.errors).toEqual([]);
    expect(result.rows.map((r) => [r.dietaryRequirements, r.membership, r.ticketType])).toEqual([
      ["", "Member", ""],
      ["", "", "VIP"],
    ]);
  });

  it("reports missing required columns", () => {
    const result = parseWorkbook(xlsx([["Student ID", "Name", "Dietary requirements"], ["S1", "A", "Veg"]]));
    expect(result.errors.map((e) => e.message)).toEqual(['Missing column "Purchaser Email"']);
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
