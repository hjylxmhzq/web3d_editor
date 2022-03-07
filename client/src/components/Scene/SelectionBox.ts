import { Color, DoubleSide, Group, LineBasicMaterial, LineSegments, Matrix3, MeshBasicMaterial, PlaneHelper, SphereGeometry } from 'three';
import { Float32BufferAttribute } from 'three';
import { BufferGeometry } from 'three';
import { MOUSE, Object3D } from 'three';
import { Camera, OrthographicCamera, PerspectiveCamera } from 'three';
import {
  Frustum,
  Vector3,
  Matrix4,
  Quaternion,
  Mesh,
} from 'three';
import { getAllPoints, getFaces, getFacesAndNormals, rayTriangleIntersection } from './utils';
import { VertexNormalsHelper } from 'three/examples/jsm/helpers/VertexNormalsHelper';

/**
 * This is a class to check whether objects are in a selection area in 3D space
 */

const _frustum = new Frustum();

const _tmpPoint = new Vector3();

const _vecNear = new Vector3();
const _vecTopLeft = new Vector3();
const _vecTopRight = new Vector3();
const _vecDownRight = new Vector3();
const _vecDownLeft = new Vector3();

const _vectemp1 = new Vector3();
const _vectemp2 = new Vector3();
const _vectemp3 = new Vector3();


class SelectionBox {

  startPoint = new Vector3();
  endPoint = new Vector3();
  collection = [];
  instances = {};
  helperGroup = new Group();

  constructor(public camera: PerspectiveCamera, public deep = Number.MAX_VALUE) { }

  select(startPoint: Vector3, endPoint: Vector3, meshes: Mesh[]) {

    this.startPoint = startPoint || this.startPoint;
    this.endPoint = endPoint || this.endPoint;
    this.collection = [];

    console.log(this.startPoint, this.endPoint);

    this.updateFrustum(this.startPoint, this.endPoint);
    return this.searchFacesInFrustum(this.camera.position, _frustum, meshes);
  }

  updateFrustum(startPoint: Vector3, endPoint: Vector3) {

    startPoint = startPoint || this.startPoint;
    endPoint = endPoint || this.endPoint;

    // Avoid invalid frustum

    if (startPoint.x === endPoint.x) {

      endPoint.x += Number.EPSILON;

    }

    if (startPoint.y === endPoint.y) {

      endPoint.y += Number.EPSILON;

    }

    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();

    if (this.camera.isPerspectiveCamera) {

      _tmpPoint.copy(startPoint);
      _tmpPoint.x = Math.min(startPoint.x, endPoint.x);
      _tmpPoint.y = Math.max(startPoint.y, endPoint.y);
      endPoint.x = Math.max(startPoint.x, endPoint.x);
      endPoint.y = Math.min(startPoint.y, endPoint.y);

      _vecNear.setFromMatrixPosition(this.camera.matrixWorld);
      _vecTopLeft.copy(_tmpPoint);
      _vecTopRight.set(endPoint.x, _tmpPoint.y, 0);
      _vecDownRight.copy(endPoint);
      _vecDownLeft.set(_tmpPoint.x, endPoint.y, 0);

      _vecTopLeft.unproject(this.camera);
      _vecTopRight.unproject(this.camera);
      _vecDownRight.unproject(this.camera);
      _vecDownLeft.unproject(this.camera);

      // const geometry = new BufferGeometry();
      // geometry.setAttribute('position', new Float32BufferAttribute([
      //   _vecNear.x, _vecNear.y, _vecNear.z,
      //   _vecTopLeft.x, _vecTopLeft.y, _vecTopLeft.z,
      //   _vecTopRight.x, _vecTopRight.y, _vecTopRight.z,
      //   _vecNear.x, _vecNear.y, _vecNear.z,
      //   _vecTopLeft.x, _vecTopLeft.y, _vecTopLeft.z,
      //   _vecDownLeft.x, _vecDownLeft.y, _vecDownLeft.z,
      //   _vecNear.x, _vecNear.y, _vecNear.z,
      //   _vecDownLeft.x, _vecDownLeft.y, _vecDownLeft.z,
      //   _vecDownRight.x, _vecDownRight.y, _vecDownRight.z,
      //   _vecNear.x, _vecNear.y, _vecNear.z,
      //   _vecTopRight.x, _vecTopRight.y, _vecTopRight.z,
      //   _vecDownRight.x, _vecDownRight.y, _vecDownRight.z,
      // ], 3));

      // const colorNear = new Color();
      // colorNear.setRGB(1, 0, 0);
      // const colorFar = new Color();
      // colorFar.setRGB(0, 0, 1);
      // geometry.setAttribute('color', new Float32BufferAttribute([
      //   colorNear.r, colorNear.g, colorNear.b, 0.5,
      //   colorFar.r, colorFar.g, colorFar.b, 0.5,
      //   colorFar.r, colorFar.g, colorFar.b, 0.5,
      //   colorNear.r, colorNear.g, colorNear.b, 0.5,
      //   colorFar.r, colorFar.g, colorFar.b, 0.5,
      //   colorFar.r, colorFar.g, colorFar.b, 0.5,
      //   colorNear.r, colorNear.g, colorNear.b, 0.5,
      //   colorFar.r, colorFar.g, colorFar.b, 0.5,
      //   colorFar.r, colorFar.g, colorFar.b, 0.5,
      //   colorNear.r, colorNear.g, colorNear.b, 0.5,
      //   colorFar.r, colorFar.g, colorFar.b, 0.5,
      //   colorFar.r, colorFar.g, colorFar.b, 0.5,
      // ], 4));
      // geometry.computeBoundingSphere();
      // const material = new MeshBasicMaterial({
      //   color: 0xaaaaaa,
      //   side: DoubleSide,
      //   vertexColors: true,
      //   opacity: 0.5
      // });
      // const mesh = new Mesh(geometry, material);
      // this.helperGroup.clear();
      // this.helperGroup.add(mesh);

      _vectemp1.copy(_vecTopLeft).sub(_vecNear);
      _vectemp2.copy(_vecTopRight).sub(_vecNear);
      _vectemp3.copy(_vecDownRight).sub(_vecNear);
      _vectemp1.normalize();
      _vectemp2.normalize();
      _vectemp3.normalize();

      _vectemp1.multiplyScalar(this.deep);
      _vectemp2.multiplyScalar(this.deep);
      _vectemp3.multiplyScalar(this.deep);
      _vectemp1.add(_vecNear);
      _vectemp2.add(_vecNear);
      _vectemp3.add(_vecNear);

      const planes = _frustum.planes;

      planes[0].setFromCoplanarPoints(_vecNear, _vecTopLeft, _vecTopRight);
      planes[1].setFromCoplanarPoints(_vecNear, _vecTopRight, _vecDownRight);
      planes[2].setFromCoplanarPoints(_vecDownRight, _vecDownLeft, _vecNear);
      planes[3].setFromCoplanarPoints(_vecDownLeft, _vecTopLeft, _vecNear);
      planes[4].setFromCoplanarPoints(_vecTopRight, _vecDownRight, _vecDownLeft);
      planes[5].setFromCoplanarPoints(_vectemp3, _vectemp2, _vectemp1);
      planes[5].normal.multiplyScalar(- 1);

    } else {

      console.error('THREE.SelectionBox: Unsupported camera type.');

    }

  }

  getPoints(mesh: Mesh) {
    let pointsArray = mesh.geometry.attributes.position.array;
    let itemSize = mesh.geometry.attributes.position.itemSize;

    let points = [];

    for (let i = 0; i < pointsArray.length; i += itemSize) {
      points.push(new Vector3(pointsArray[i], pointsArray[i + 1], pointsArray[i + 2]));
    }

    return points;
  }

  getVertexes(points: Vector3[]): [Vector3[], Map<Vector3, number[]>] {
    const vertexes: Vector3[] = [];
    const vertexesIndexes = new Map<Vector3, number[]>();
    const tempSet = new Map<string, Vector3>();
    let idx = -1;
    for (let p of points) {
      idx++;
      const sign = `${p.x}_${p.y}_${p.z}`;
      if (tempSet.has(sign)) {
        vertexesIndexes.get(tempSet.get(sign)!)!.push(idx);
      } else {
        tempSet.set(sign, p);
        vertexesIndexes.set(p, [idx]);
        vertexes.push(p);
      }
    }
    return [vertexes, vertexesIndexes];
  }

  searchVertexesInFrustum(frustum: Frustum, meshes: Mesh[]) {
    const mesh = meshes[0];
    const points = this.getPoints(mesh);
    const [vertexes, vertexesIndexes] = this.getVertexes(points);


    const transform = mesh.matrixWorld;
    const collection = [];

    const tempVec3 = new Vector3();

    let idx = -1;

    for (let p of vertexes) {
      idx++;
      tempVec3.set(p.x, p.y, p.z);
      tempVec3.applyMatrix4(transform);

      if (frustum.containsPoint(tempVec3)) {
        // const sphere = new SphereGeometry(1, 4);
        // const mesh = new Mesh(sphere, new MeshBasicMaterial({ color: new Color(0x0000ff) }));
        // mesh.position.set(tempVec3.x, tempVec3.y, tempVec3.z);
        // mesh.updateMatrixWorld(true);
        // this.helperGroup.add(mesh);
        const indexes = vertexesIndexes.get(p);
        collection.push(idx);
      }
    }
    console.log(collection);
    return collection;
  }

  searchFacesInFrustum(cameraPosition: Vector3, frustum: Frustum, meshes: Mesh[]) {
    console.log('camera position: ', cameraPosition);

    const mesh = meshes[0];
    const res = getFacesAndNormals(mesh);

    const [faces, normals] = res;
    console.log(faces, normals);

    const transform = mesh.matrixWorld;
    const collection = [];

    const tempVec3 = new Vector3();

    let idx = -1;

    const normalMatrix = new Matrix3();
    const globalNormal = new Vector3();

    for (let face of faces) {
      idx++;
      const p = face.center;
      tempVec3.set(p.x, p.y, p.z);
      tempVec3.applyMatrix4(transform);

      if (frustum.containsPoint(tempVec3)) {
        // const sphere = new SphereGeometry(1, 4);
        // const mesh = new Mesh(sphere, new MeshBasicMaterial({ color: new Color(0x0000ff) }));
        // mesh.position.set(tempVec3.x, tempVec3.y, tempVec3.z);
        // mesh.updateMatrixWorld(true);
        // this.helperGroup.add(mesh);
        normalMatrix.getNormalMatrix(transform);

        globalNormal.copy(normals[idx]).applyMatrix3(normalMatrix).normalize();
        const eyeVec = tempVec3.clone().sub(cameraPosition);
        const dotProd = eyeVec.dot(globalNormal);

        if (dotProd <= 0) {
          collection.push(face);
        }
      }
    }
    const points = getAllPoints(mesh);
    const occludedIndex = new Set();
    const final = [];
    const tempP1 = new Vector3();
    const tempP2 = new Vector3();
    const tempP3 = new Vector3();
    for (let idx = 0; idx < collection.length; idx++) {
      const face = collection[idx];
      const p = face.center;
      tempVec3.set(p.x, p.y, p.z);
      tempVec3.applyMatrix4(transform);

      
      
      let inters: Vector3 | undefined = undefined;
      let occluded = false;
      
      const eyeVec = tempVec3.clone().sub(cameraPosition);
      // const curDis = tempVec3.distanceTo(cameraPosition);
      // for (let iIdx = 0; iIdx < collection.length; iIdx++) {
      //   if (iIdx === idx || occludedIndex.has(iIdx)) {
      //     continue;
      //   }
      //   const otherFace = collection[iIdx];
      //   tempP1.copy(points[otherFace.a]).applyMatrix4(transform);
      //   tempP2.copy(points[otherFace.b]).applyMatrix4(transform);
      //   tempP3.copy(points[otherFace.c]).applyMatrix4(transform);
      //   const intersect = rayTriangleIntersection(tempP1, tempP2, tempP3, cameraPosition, eyeVec.clone().normalize());

      //   if (intersect) {
      //     inters = intersect;
      //     const dis = intersect.distanceTo(cameraPosition);

      //     if (dis < curDis) {
      //       occluded = true;
      //       break;
      //     }
      //   }
      // }

      if (occluded) {
        occludedIndex.add(idx);
      } else {
        final.push(face);
      }
    }
    return final;
  }

}

export { SelectionBox };
