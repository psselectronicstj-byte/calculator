export type CalculationStep = {
  title: string;
  expression?: string;
  explanation: string;
};

export type MathErrorCode =
  | "invalid-input"
  | "invalid-range"
  | "invalid-shape"
  | "domain-error"
  | "unsupported"
  | "no-solution"
  | "inconsistent"
  | "underdetermined"
  | "singular"
  | "resource-limit";

export type MathOutcome<T> =
  | {
      ok: true;
      status: "exact" | "approximate";
      value: T;
      steps: CalculationStep[];
      notes: string[];
    }
  | {
      ok: false;
      code: MathErrorCode;
      message: string;
    };

export function exact<T>(
  value: T,
  steps: CalculationStep[] = [],
  notes: string[] = [],
): MathOutcome<T> {
  return { ok: true, status: "exact", value, steps, notes };
}

export function approximate<T>(
  value: T,
  steps: CalculationStep[] = [],
  notes: string[] = [],
): MathOutcome<T> {
  return { ok: true, status: "approximate", value, steps, notes };
}

export function failure<T = never>(
  code: MathErrorCode,
  message: string,
): MathOutcome<T> {
  return { ok: false, code, message };
}
