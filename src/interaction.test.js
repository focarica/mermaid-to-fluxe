import { describe, expect, it } from "bun:test";
import { createTracePin } from "./interaction";

describe("trace pin", () => {
  it("toggles same key and replaces another key", () => {
    const pin = createTracePin();

    expect(pin.toggle("entity:A")).toBe("entity:A");
    expect(pin.toggle("entity:B")).toBe("entity:B");
    expect(pin.toggle("entity:B")).toBeNull();
  });

  it("keeps pin ahead of hover and focus, then clears removed keys", () => {
    const pin = createTracePin();
    pin.toggle("entity:A");

    expect(pin.activeKey("entity:B")).toBe("entity:A");
    expect(pin.retain(new Set(["entity:B"]))).toBeNull();
    expect(pin.activeKey("entity:B")).toBe("entity:B");
  });
});
