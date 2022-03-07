import { Vector3 } from 'three';

export class MeshFace {
  constructor(public a: number, public b: number, public c: number, public center: Vector3) { }
}

export class MeshFaceWithNormal {
  constructor(public a: number, public b: number, public c: number, public center: Vector3, public normal: Vector3) { }
}
