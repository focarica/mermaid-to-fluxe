import { describe, expect, test } from "bun:test";
import { ErParseError, parseErDiagram } from "./parser";

describe("parseErDiagram", () => {
  test("parses attributes and identifying relationship when given a typical diagram", () => {
    const source = `erDiagram
CUSTOMER {
  string id PK
  int age
}
CUSTOMER ||--o{ ORDER : places`;

    const result = parseErDiagram(source);

    expect(result).toEqual({
      entities: [
        {
          name: "CUSTOMER",
          attributes: [
            { name: "id", type: "string", keys: ["PK"] },
            { name: "age", type: "int", keys: [] },
          ],
        },
        { name: "ORDER", attributes: [] },
      ],
      relationships: [
        {
          from: "CUSTOMER",
          to: "ORDER",
          fromCardinality: "one",
          toCardinality: "zero-or-more",
          identifying: true,
          label: "places",
        },
      ],
    });
  });

  test("preserves quoted names, labels, comments, arrays and combined keys", () => {
    const source = `%% heading
erDiagram %% declaration
"Customer Profile" { varchar(255)[] "display name" PK, FK, UK "Shown; with %% mark"; int age; }
"Customer Profile" o|..|{ "Order Item" : "has many items" %% trailing`;

    const result = parseErDiagram(source);

    expect(result.entities).toEqual([
      {
        name: "Customer Profile",
        attributes: [
          {
            name: "display name",
            type: "varchar(255)[]",
            keys: ["PK", "FK", "UK"],
            comment: "Shown; with %% mark",
          },
          { name: "age", type: "int", keys: [] },
        ],
      },
      { name: "Order Item", attributes: [] },
    ]);
    expect(result.relationships[0]).toMatchObject({
      label: "has many items",
      identifying: false,
      fromCardinality: "zero-or-one",
      toCardinality: "one-or-more",
    });
  });

  test.each([
    ["||", "one"],
    ["o|", "zero-or-one"],
    ["|o", "zero-or-one"],
    ["|{", "one-or-more"],
    ["}|", "one-or-more"],
    ["o{", "zero-or-more"],
    ["}o", "zero-or-more"],
  ])("maps cardinality %s when used at either endpoint", (token, expected) => {
    const source = `erDiagram\nLEFT ${token}--${token} RIGHT : linked`;

    const result = parseErDiagram(source);

    expect(result.relationships[0]).toMatchObject({
      fromCardinality: expected,
      toCardinality: expected,
    });
    expect(result.entities.map((entity) => entity.name)).toEqual([
      "LEFT",
      "RIGHT",
    ]);
  });

  test("adds attributes when an inferred entity is subsequently declared", () => {
    const source = "erDiagram\nA ||--|| B : linked\nB { string id PK; }";

    const result = parseErDiagram(source);

    expect(result.entities[1]?.attributes).toEqual([
      { name: "id", type: "string", keys: ["PK"] },
    ]);
  });

  test("parses a standalone quoted entity declaration", () => {
    const source = 'erDiagram\n"Named Entity"';

    const result = parseErDiagram(source);

    expect(result.entities).toEqual([{ name: "Named Entity", attributes: [] }]);
  });

  test.each([
    ["", 1, "Expected erDiagram"],
    ["%% first\nflowchart TD", 2, "Expected erDiagram"],
    ["erDiagram\nA {", 2, "Missing }"],
    ["erDiagram\nA { string } garbage", 2, "Unexpected content"],
    ["erDiagram\nA { int age FK, BAD }", 2, "Malformed attribute"],
    ["erDiagram\nA { int age FK, FK }", 2, "Duplicate key"],
    ["erDiagram\nA ||-o{ B : linked", 2, "Unsupported ER statement"],
    ["erDiagram\nA ||--|| B", 2, "Unsupported ER statement"],
    ["erDiagram\nA { int age; }\nA { int id; }", 3, "Duplicate entity"],
    ["erDiagram\nA { int age; ; int id }", 2, "Empty attribute"],
    [
      "erDiagram\nA { int age }\nother unrecognized syntax",
      3,
      "Unsupported ER statement",
    ],
  ])(
    "returns a line-aware typed error when given %s",
    (source, line, message) => {
      const parse = () => parseErDiagram(source);

      expect(parse).toThrow(ErParseError);
      expect(parse).toThrow(`Line ${line}: ${message}`);
    },
  );
});
