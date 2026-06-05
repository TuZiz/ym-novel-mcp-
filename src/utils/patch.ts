export function patchValue<T>(value: T | undefined, current: T): T {
  return value === undefined ? current : value;
}
