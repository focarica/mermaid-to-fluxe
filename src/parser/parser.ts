import type {
  Attribute,
  Cardinality,
  Diagram,
  Entity,
  Relationship,
} from "./model";

export class ErParseError extends Error {
  override readonly name = "ErParseError";

  constructor(
    readonly line: number,
    message: string,
  ) {
    super(`Line ${line}: ${message}`);
  }
}

const nameToken = String.raw`(?:"(?:\\.|[^"\\])*"|[\w-]+)`;
const quotedToken = String.raw`"(?:\\.|[^"\\])*"`;
const relationPattern = new RegExp(
  `^(${nameToken})\\s+(\\|\\||o\\||\\|o|\\|\\{|\\}\\||o\\{|\\}o)(--|\\.\\.)(\\|\\||o\\||\\|o|\\|\\{|\\}\\||o\\{|\\}o)\\s+(${nameToken})\\s*:\\s*(.+)$`,
);
const blockPattern = new RegExp(`^(${nameToken})\\s*\\{(.*)$`);
const relationshipBlockPattern = new RegExp(
  `^RELATIONSHIP\\s+(${nameToken})\\s*\\{(.*)$`,
  "i",
);
const attributeFlags = String.raw`(?:PK|FK|UK|DERIVED|COMPOSITE(?:\([^)]*\))?)`;
const attributePattern = new RegExp(
  `^(?:([\\w]+(?:\\([^()\\s]+\\))?(?:\\[\\])*)\\s+)?(${nameToken})(?:\\s+(${attributeFlags}(?:\\s*,\\s*${attributeFlags})*))?(?:\\s+(${quotedToken}))?$`,
);

function unquote(value: string): string {
  return value.startsWith('"')
    ? value.slice(1, -1).replace(/\\(["\\])/g, "$1")
    : value;
}

function cardinality(token: string, line: number): Cardinality {
  switch (token) {
    case "||":
      return "one";
    case "o|":
    case "|o":
      return "zero-or-one";
    case "|{":
    case "}|":
      return "one-or-more";
    case "o{":
    case "}o":
      return "zero-or-more";
    default:
      throw new ErParseError(line, `Unsupported cardinality: ${token}`);
  }
}

function parseAttribute(text: string, line: number): Attribute {
  const match = attributePattern.exec(text);
  const type = match?.[1];
  const name = match?.[2];
  const flags = match?.[3];
  const comment = match?.[4];
  if (!name) {
    throw new ErParseError(line, `Malformed attribute: ${text}`);
  }
  const keys: ("PK" | "FK" | "UK")[] = [];
  let derived = false;
  let components: string[] | undefined;
  const parsedFlags =
    flags?.match(/COMPOSITE(?:\([^)]*\))|DERIVED|PK|FK|UK/g) ?? [];
  for (const flag of parsedFlags) {
    switch (flag) {
      case "PK":
      case "FK":
      case "UK":
        if (keys.includes(flag)) {
          throw new ErParseError(line, `Duplicate key flag: ${flag}`);
        }
        keys.push(flag);
        break;
      case "DERIVED":
        if (derived) {
          throw new ErParseError(line, "Duplicate attribute marker: DERIVED");
        }
        derived = true;
        break;
      default:
        if (flag.startsWith("COMPOSITE")) {
          const list = flag.match(/^COMPOSITE\((.*)\)$/)?.[1];
          if (list === undefined || components !== undefined) {
            throw new ErParseError(
              line,
              list === undefined
                ? "Composite attributes need named components"
                : "Duplicate attribute marker: COMPOSITE",
            );
          }
          components = list.split(",").map((part) => unquote(part.trim()));
          if (components.length === 0 || components.some((part) => !part)) {
            throw new ErParseError(
              line,
              "Composite attributes need components",
            );
          }
        } else {
          throw new ErParseError(line, `Unsupported attribute marker: ${flag}`);
        }
    }
  }
  return {
    name: unquote(name),
    ...(type === undefined ? {} : { type }),
    keys,
    ...(derived ? { derived: true } : {}),
    ...(components === undefined ? {} : { components }),
    ...(comment === undefined ? {} : { comment: unquote(comment) }),
  };
}

function stripComment(text: string): string {
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "\\" && quoted) {
      index++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && text.slice(index, index + 2) === "%%") {
      return text.slice(0, index).trim();
    }
  }
  return text.trim();
}

function attributeSegments(text: string, line: number): readonly string[] {
  const segments: string[] = [];
  let start = 0;
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "\\" && quoted) {
      index++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ";" && !quoted) {
      const segment = text.slice(start, index).trim();
      if (!segment) {
        throw new ErParseError(line, "Empty attribute between semicolons");
      }
      segments.push(segment);
      start = index + 1;
    }
  }
  const finalSegment = text.slice(start).trim();
  if (finalSegment) segments.push(finalSegment);
  return segments;
}

export function parseErDiagram(source: string): Diagram {
  const entities = new Map<string, Entity>();
  const declared = new Set<string>();
  const relationships: Relationship[] = [];
  let started = false;
  let block:
    | { readonly kind: "entity"; readonly name: string; readonly line: number }
    | {
        readonly kind: "relationship";
        readonly index: number;
        readonly line: number;
      }
    | undefined;

  const lines = source.split(/\r\n|\n|\r/);
  for (const [index, raw] of lines.entries()) {
    const line = index + 1;
    let text = stripComment(raw);
    if (!text) continue;

    if (!started) {
      if (text !== "erDiagram") {
        throw new ErParseError(line, "Expected erDiagram declaration");
      }
      started = true;
      continue;
    }

    const relationshipOpen = block ? null : relationshipBlockPattern.exec(text);
    if (relationshipOpen) {
      const rawLabel = relationshipOpen[1];
      const rest = relationshipOpen[2];
      if (rawLabel === undefined || rest === undefined) {
        throw new ErParseError(line, "Malformed relationship attribute block");
      }
      const label = unquote(rawLabel);
      const matching = relationships
        .map((relationship, index) => ({ relationship, index }))
        .filter(({ relationship }) => relationship.label === label);
      if (matching.length !== 1) {
        throw new ErParseError(
          line,
          matching.length === 0
            ? `Unknown relationship label: ${label}`
            : `Ambiguous relationship label: ${label}`,
        );
      }
      block = { kind: "relationship", index: matching[0]?.index ?? 0, line };
      text = rest.trim();
      if (!text) continue;
    }

    const open = block ? null : blockPattern.exec(text);
    if (open) {
      const rawName = open[1];
      const rest = open[2];
      if (rawName === undefined || rest === undefined) {
        throw new ErParseError(line, "Malformed entity declaration");
      }
      const name = unquote(rawName);
      if (!name.trim())
        throw new ErParseError(line, "Entity name cannot be empty");
      if (declared.has(name)) {
        throw new ErParseError(line, `Duplicate entity declaration: ${name}`);
      }
      declared.add(name);
      if (!entities.has(name)) entities.set(name, { name, attributes: [] });
      block = { kind: "entity", name, line };
      text = rest.trim();
      if (!text) continue;
    }

    if (block) {
      const close = text.indexOf("}");
      if (close >= 0 && text.slice(close + 1).trim()) {
        throw new ErParseError(line, "Unexpected content after entity block");
      }
      const content = close >= 0 ? text.slice(0, close) : text;
      const attributes = attributeSegments(content, line).map((segment) =>
        parseAttribute(segment, line),
      );
      if (block.kind === "entity") {
        const entity = entities.get(block.name);
        if (entity === undefined) {
          throw new ErParseError(block.line, `Missing entity: ${block.name}`);
        }
        entities.set(block.name, {
          name: block.name,
          attributes: [...entity.attributes, ...attributes],
        });
      } else {
        const relationship = relationships[block.index];
        if (!relationship) {
          throw new ErParseError(block.line, "Missing relationship");
        }
        relationships[block.index] = {
          ...relationship,
          attributes: [...(relationship.attributes ?? []), ...attributes],
        };
      }
      if (close >= 0) block = undefined;
      continue;
    }

    if (new RegExp(`^${nameToken}$`).test(text)) {
      const name = unquote(text);
      if (!name.trim())
        throw new ErParseError(line, "Entity name cannot be empty");
      if (declared.has(name))
        throw new ErParseError(line, `Duplicate entity declaration: ${name}`);
      declared.add(name);
      if (!entities.has(name)) entities.set(name, { name, attributes: [] });
      continue;
    }

    const relation = relationPattern.exec(text);
    if (relation) {
      const fromToken = relation[1];
      const left = relation[2];
      const connector = relation[3];
      const right = relation[4];
      const toToken = relation[5];
      const labelToken = relation[6]?.trim();
      if (
        !fromToken ||
        !left ||
        !connector ||
        !right ||
        !toToken ||
        !labelToken
      ) {
        throw new ErParseError(line, `Malformed relationship: ${text}`);
      }
      if (
        labelToken.includes('"') &&
        !new RegExp(`^${quotedToken}$`).test(labelToken)
      ) {
        throw new ErParseError(line, "Malformed quoted relationship label");
      }
      const from = unquote(fromToken);
      const to = unquote(toToken);
      if (!from.trim() || !to.trim() || !unquote(labelToken).trim()) {
        throw new ErParseError(
          line,
          "Relationship names and label cannot be empty",
        );
      }
      if (!entities.has(from))
        entities.set(from, { name: from, attributes: [] });
      if (!entities.has(to)) entities.set(to, { name: to, attributes: [] });
      relationships.push({
        from,
        to,
        fromCardinality: cardinality(left, line),
        toCardinality: cardinality(right, line),
        identifying: connector === "--",
        label: unquote(labelToken),
      });
      continue;
    }
    throw new ErParseError(line, `Unsupported ER statement: ${text}`);
  }
  if (!started) throw new ErParseError(1, "Expected erDiagram declaration");
  if (block)
    throw new ErParseError(
      block.line,
      block.kind === "entity"
        ? `Missing } for entity ${block.name}`
        : "Missing } for relationship attributes",
    );
  return { entities: [...entities.values()], relationships };
}
