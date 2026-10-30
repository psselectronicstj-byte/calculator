export type Matrix = number[][];

export type EigenResult = {
  values: number[];
  vectors: Matrix;
};

export type MatrixOperation =
  | "add"
  | "multiply"
  | "transpose"
  | "determinant"
  | "inverse"
  | "rank"
  | "eigen";

export type MatrixOperationValue = number | number[] | Matrix | EigenResult;
