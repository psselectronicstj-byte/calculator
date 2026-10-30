import type { FeatureKind } from "./feature";

export type HistoryRestoreData =
  | {
    kind: "equation-system";
    coefficientsText: string;
    constantsText: string;
  }
  | {
    kind: "matrix-operation";
    operation: "add" | "multiply";
    leftText: string;
    rightText: string;
  }
  | {
    kind: "matrix-operation";
    operation: "solve-system";
    leftText: string;
    constantsText: string;
  }
  | {
    kind: "matrix-operation";
    operation: "transpose" | "determinant" | "inverse" | "rank" | "eigen";
    leftText: string;
  };

export type HistoryEntry = {
  id: string;
  feature: FeatureKind;
  input: string;
  result: string;
  status: "exact" | "approximate" | "unsupported";
  createdAt: number;
  restoreData?: HistoryRestoreData;
};
