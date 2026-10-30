import type { FeatureKind } from "./feature";

export type HistoryEntry = {
  id: string;
  feature: FeatureKind;
  input: string;
  result: string;
  status: "exact" | "approximate" | "unsupported";
  createdAt: number;
};
