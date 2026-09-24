export function createTracePin() {
  let key: string | null = null;
  return {
    activeKey: (transientKey: string | null): string | null =>
      key ?? transientKey,
    clear: (): void => {
      key = null;
    },
    retain: (keys: ReadonlySet<string>): string | null => {
      if (key !== null && !keys.has(key)) key = null;
      return key;
    },
    toggle: (nextKey: string): string | null => {
      key = key === nextKey ? null : nextKey;
      return key;
    },
  };
}
