import type { FieldError } from "./types";

export function toFieldErrorMap(errors: FieldError[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of errors) {
    map[e.field] = e.message;
  }
  return map;
}
