export type Cardinality =
  | "one"
  | "zero-or-one"
  | "one-or-more"
  | "zero-or-more";

export type Attribute = {
  readonly name: string;
  readonly type?: string;
  readonly keys: readonly ("PK" | "FK" | "UK")[];
  readonly comment?: string;
};

export type Entity = {
  readonly name: string;
  readonly attributes: readonly Attribute[];
};

export type Relationship = {
  readonly from: string;
  readonly to: string;
  readonly fromCardinality: Cardinality;
  readonly toCardinality: Cardinality;
  readonly identifying: boolean;
  readonly label: string;
};

export type Diagram = {
  readonly entities: readonly Entity[];
  readonly relationships: readonly Relationship[];
};
