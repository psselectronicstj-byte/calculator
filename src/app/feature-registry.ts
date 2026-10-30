import type { FeatureKind, NavigationTarget } from "../domain/feature";

export const featureLabels: Record<FeatureKind, string> = {
  calculator: "Калькулятор",
  algebra: "Алгебра",
  equations: "Уравнения",
  calculus: "Анализ",
  graph2d: "График 2D",
  graph3d: "График 3D",
  matrices: "Матрицы",
};

export const navigationItems: Array<{ id: NavigationTarget; label: string }> = [
  { id: "calculator", label: "Калькулятор" },
  { id: "algebra", label: "Алгебра" },
  { id: "equations", label: "Уравнения" },
  { id: "calculus", label: "Анализ" },
  { id: "graph2d", label: "2D-график" },
  { id: "graph3d", label: "3D-график" },
  { id: "matrices", label: "Матрицы" },
  { id: "history", label: "История" },
];
