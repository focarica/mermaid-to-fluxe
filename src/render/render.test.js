import { describe, expect, test } from "bun:test";
import { parseErDiagram } from "../parser/parser";
import { describeDiagram } from "./render";

describe("describeDiagram", () => {
  test("includes attribute metadata and only present comments", () => {
    // Given a diagram with one commented and one uncommented attribute
    const diagram = parseErDiagram(`erDiagram
      Customer {
        string name PK "Customer display name"
        int age
      }
    `);

    // When its accessible description is generated
    const description = describeDiagram(diagram);

    // Then metadata and the supplied comment appear, without an absent comment
    expect(description).toContain(
      "name, type string, PK, comment Customer display name; age, type int",
    );
    expect(description).not.toContain("age, type int, comment");
  });
});
