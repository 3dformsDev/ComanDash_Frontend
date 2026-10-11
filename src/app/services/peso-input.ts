// Only explicit input changes the value. Rendering a weighted cost must never round its stored precision.
export function enteredPesos(value: unknown): number | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? Number(digits) : null;
}
