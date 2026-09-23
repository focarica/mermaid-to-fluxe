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
const attributePattern = new RegExp(
  `^(?:([\\w]+(?:\\([^()\\s]+\\))?(?:\\[\\])*)\\s+)?(${nameToken})(?:\\s+((?:PK|FK|UK)(?:\\s*,\\s*(?:PK|FK|UK))*))?(?:\\s+(${quotedToken}))?$`,
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
  for (const key of flags?.split(/\s*,\s*/) ?? []) {
    switch (key) {
      case "PK":
      case "FK":
      case "UK":
        if (keys.includes(key)) {
          throw new ErParseError(line, `Duplicate key flag: ${key}`);
        }
        keys.push(key);
        break;
      default:
        throw new ErParseError(line, `Unsupported key flag: ${key}`);
    }
  }
  return {
    name: unquote(name),
    ...(type === undefined ? {} : { type }),
    keys,
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
  let block: { readonly name: string; readonly line: number } | undefined;

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
      block = { name, line };
      text = rest.trim();
      if (!text) continue;
    }

    if (block) {
      const close = text.indexOf("}");
      if (close >= 0 && text.slice(close + 1).trim()) {
        throw new ErParseError(line, "Unexpected content after entity block");
      }
      const content = close >= 0 ? text.slice(0, close) : text;
      const entity = entities.get(block.name);
      if (entity === undefined) {
        throw new ErParseError(block.line, `Missing entity: ${block.name}`);
      }
      const attributes = [...entity.attributes];
      for (const segment of attributeSegments(content, line)) {
        attributes.push(parseAttribute(segment, line));
      }
      entities.set(block.name, { name: block.name, attributes });
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
    throw new ErParseError(block.line, `Missing } for entity ${block.name}`);
  return { entities: [...entities.values()], relationships };
}
