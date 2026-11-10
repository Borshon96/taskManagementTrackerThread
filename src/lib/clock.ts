let clock: () => Date = () => new Date();

export function nowIso(): string {
  return clock().toISOString();
}

export function setClock(fn: (() => Date) | null) {
  clock = fn ?? (() => new Date());
}
