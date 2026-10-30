import nerdamer from "nerdamer";
import { all, create } from "mathjs";
import * as THREE from "three";

const math = create(all);

export const bundledEngineProbe = [
  nerdamer("2+3").evaluate().text(),
  math.det([[1, 0], [0, 1]]),
  new THREE.Scene().type,
];
