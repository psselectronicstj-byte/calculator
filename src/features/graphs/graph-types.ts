export type GraphExpression = {
  id: string;
  expression: string;
  color: string;
};

export type GraphRange = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

export type GraphPoint = {
  x: number;
  y: number;
};

export type Graph3DRange = GraphRange & {
  resolution: number;
};

export type Graph3DPoint = {
  x: number;
  y: number;
  z: number;
};
