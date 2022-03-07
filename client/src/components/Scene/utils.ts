import { VertexNormalsHelper } from 'three/examples/jsm/helpers/VertexNormalsHelper';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { EventEmitter } from 'events';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TilesRenderer } from '3d-tiles-renderer';
import {
  Box3,
  Box3Helper,
  BufferAttribute,
  BufferGeometry,
  Camera,
  CameraHelper,
  Color,
  DataTexture,
  DoubleSide,
  Face,
  Float32BufferAttribute,
  FrontSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Sphere,
  SphereGeometry,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer
} from "three";
import { customMouseEvent, MousePosition } from './customMouseEvent';
import { SelectionBoxHelper } from './SelectionBoxHelper';
import { SelectionBox } from './SelectionBox';
import { MeshFace } from './Face';
import { CustomTransformControls } from './CustomTransformControls';
import { TilesGroup } from '3d-tiles-renderer/src/three/TilesGroup';
import { eventBus, EventType } from './eventBus';

let tempVec3 = new Vector3();
let tempVec3_1 = new Vector3();
let tempMat4 = new Matrix4();
let _emptyFn = function () { }

export interface IntersectInfo {
  distance: number;
  object: Mesh;
  face: Face
}

export function moveToTile(tiles: any) {
  const box = new Box3();
  const sphere = new Sphere();
  const matrix = new Matrix4();

  let position = new Vector3();
  let distanceToEllipsoidCenter = 0;

  if (tiles.getOrientedBounds(box, matrix)) {

    position = new Vector3().setFromMatrixPosition(matrix);
    distanceToEllipsoidCenter = position.length();

  } else if (tiles.getBoundingSphere(sphere)) {

    position = sphere.center.clone();
    distanceToEllipsoidCenter = position.length();

  }

  const surfaceDirection = position.normalize();
  const up = new Vector3(0, 1, 0);
  const rotationToNorthPole = rotationBetweenDirections(surfaceDirection, up);

  tiles.group.quaternion.x = rotationToNorthPole.x;
  tiles.group.quaternion.y = rotationToNorthPole.y;
  tiles.group.quaternion.z = rotationToNorthPole.z;
  tiles.group.quaternion.w = rotationToNorthPole.w;

  tiles.group.position.y = - distanceToEllipsoidCenter;

}

function rotationBetweenDirections(dir1: Vector3, dir2: Vector3) {

  const rotation = new Quaternion();
  const a = new Vector3().crossVectors(dir1, dir2);
  rotation.x = a.x;
  rotation.y = a.y;
  rotation.z = a.z;
  rotation.w = 1 + dir1.clone().dot(dir2);
  rotation.normalize();

  return rotation;

}

export enum SELECT_TYPE {
  click = 'click',
  hover = 'hover',
}

export class SelectionControls {
  tiles: TilesRenderer;
  selectType: SELECT_TYPE;
  enabled = true;
  cb: ((m: any[]) => void) | null = null;
  hoverCb: ((m: any[]) => void) | null = null;
  raycaster = new Raycaster();
  camera: Camera;
  constructor(tiles: TilesRenderer, camera: Camera, type: SELECT_TYPE = SELECT_TYPE.click) {
    this.tiles = tiles;
    this.camera = camera;
    this.selectType = type;
    customMouseEvent.onClickNoMove(this.onMouseclick);
  }
  onMouseclick = (e: MouseEvent) => {
    if (this.cb) {
      const mouse = new Vector2();
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = - (e.clientY / window.innerHeight) * 2 + 1;
      const raycaster = this.raycaster;
      raycaster.setFromCamera(mouse, this.camera);
      const intersects: any[] = [];
      this.tiles.raycast(raycaster, intersects);
      console.log(intersects)
      intersects.sort((a, b) => {
        return a.distance - b.distance;
      });
      if (intersects.length) {
        this.cb && this.cb(intersects);
      }
    }
  };
  destroy() {
    customMouseEvent.offClickNoMove(this.onMouseclick);
  }
  onSelect(cb: (intersects: any[]) => void) {
    this.cb = cb;
  }
}

export class HighlightControls {

  private selectedObj: Object3D[] = [];
  private faces: Face[] = [];
  private raycaster = new Raycaster();
  group = new Group();
  enabled = true;
  highlightTriangleEnabled = true;

  constructor(public camera: Camera) {
    this.group.name = 'SelectionControls.group';
    this.group.matrixAutoUpdate = false;
    this.group.visible = true;
    // customMouseEvent.onMousemove(this.onMousemove);
  }

  onMousemove = (e: MouseEvent) => {
    if (this.highlightTriangleEnabled && this.selectedObj) {
      const mouse = new Vector2();
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = - (e.clientY / window.innerHeight) * 2 + 1;
      const raycaster = this.raycaster;
      raycaster.setFromCamera(mouse, this.camera);
      const intersects: any[] = [];
      for (let obj of this.selectedObj) {
        raycastObject(raycaster, obj, intersects);
      }
      if (intersects.length) {
        this.addTriangle(intersects)
      }
    }
  };

  addTriangle(intersects: IntersectInfo[]) {
    if (intersects.length > 0) {
      let faceHighlightGroup = new Group();
      faceHighlightGroup.name = "FaceHelperGroup";

      let material = new MeshBasicMaterial({
        color: new Color("lightgrey"),
        transparent: true,
        opacity: 0.9,
        // side: DoubleSide
        // alphaTest: 0.5,
      });


      let mesh = intersects[0].object;
      let face = intersects[0].face;
      faceHighlightGroup.applyMatrix4(mesh.matrixWorld);
      const oldFaceGroup = this.group.getObjectByName("FaceHelperGroup");
      oldFaceGroup && mesh.remove(oldFaceGroup);

      let points = getPoints(mesh);

      let vertices = [points[face.a], points[face.b], points[face.c]] as [Vector3, Vector3, Vector3];

      let triangle = createTriangle(vertices, material);
      triangle.name = "Face_";
      triangle.userData.type = "createMeshHelpers";

      triangle.userData.verticesNumbers = [];

      vertices.forEach((item) => {
        points.forEach((itemVert, index) => {
          if (item.equals(itemVert)) {
            triangle.userData.verticesNumbers.push(index);
            return;
          }
        });
      });

      faceHighlightGroup.add(triangle);
      this.group.add(faceHighlightGroup);
    }
  }

  destroy() {
    this.clear();
    customMouseEvent.offMousemove(this.onMousemove);
  }

  clear() {
    this.selectedObj.length = 0;
    this.group.clear();
  }

  highlightBBox(obj: Mesh) {
    console.log(obj);
    this.selectedObj.push(obj);
    const bbox = new Box3().setFromObject(obj);
    const box3Helper = new Box3Helper(bbox);
    this.group.add(box3Helper);
  }

  highlightTriangel(face: Face) {
    this.faces.push(face);
  }

  highlightMesh(obj: Mesh) {
    this.selectedObj.push(obj);
    let material: MeshBasicMaterial;

    if (Array.isArray(obj.material)) {
      material = obj.material[0] as MeshBasicMaterial;
    } else {
      material = obj.material as MeshBasicMaterial;
    }

    obj.userData.lastColorHex = material.color.getHex();
    obj.userData.highlight = true;
    material.color.setHex(0xffffff);
  }
}

export class TextureProjectionEditor {
  group = new Group();
  editObj: Mesh[] = [];
  helper: CameraHelper;
  constructor(public camera: Camera) {
    const fakeCamera = new PerspectiveCamera(65, 1.2, 0.5, 1000);
    this.helper = new CameraHelper(fakeCamera);
    this.helper.raycast = _emptyFn;
  }

  attach(obj: Mesh, imageUrl: string) {
    this.detach();
    this.editObj.push(obj);
    const matrixWorld = obj.matrixWorld;
    obj.geometry.computeBoundingSphere();
    const center = obj.geometry.boundingSphere?.center.clone();
    center?.applyMatrix4(matrixWorld);
    if (center) {
      this.helper.camera.position.set(center.x, center.y + 10, center.z);
      this.helper.camera.lookAt(center);
      console.log(center);
    }
    this.helper.update();
    this.group.add(this.helper);
    console.log(obj);
    const uvs = this.getUVs(obj);

    console.log(obj.material);

    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
      const texture = new Texture(img);
      texture.repeat.set(1, 1);
      const material = new MeshStandardMaterial();
      material.copy(obj.material as MeshStandardMaterial);
      material.map = texture;
      texture.needsUpdate = true;
      (obj.material as MeshStandardMaterial) = material;
      (obj.material as MeshStandardMaterial).needsUpdate = true;
      console.log(obj);
      obj.geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    }
    img.src = imageUrl;
  }

  getUVs(obj: Mesh) {
    const points = getPoints(obj);
    const modelMatrix = obj.matrixWorld.clone();
    const viewMatrix = this.helper.camera.matrixWorldInverse.clone();
    const projectMatrix = this.helper.camera.projectionMatrix.clone();
    const pvmMatrix = new Matrix4().copy(projectMatrix).multiply(viewMatrix).multiply(modelMatrix);
    const uvs: number[] = [];

    for (let p of points) {
      p.applyMatrix4(pvmMatrix);
      let u = p.x;
      let v = p.y;

      u = (u * 0.5) + 0.5;
      v = (v * 0.5) + 0.5;

      uvs.push(
        u, v
      );
    }
    return uvs;
  }

  detach() {
    this.group.clear();
  }

}

export class EditControls {
  group = new Group();
  private editObj: Mesh[] = [];
  enabled = true;
  raycaster = new Raycaster();
  selectHandlers: Mesh[] = [];
  faceGroup = new Group();
  edgeGroup = new Group();
  sphereGroup = new Group();
  selectedFaces: MeshFace[] = [];
  handlerSize = 0.04;
  _boxSelectionEnabled = false;
  onSelectVertex: (e: MouseEvent) => void;
  onSelectBox: (e: MouseEvent, startPos: MousePosition) => void;
  selectionBoxHelper: SelectionBoxHelper;
  selectionBox: SelectionBox;
  helperGroup = new Group();
  sphereHandlerEnabled = false;
  textureProjectionEditor: TextureProjectionEditor;
  mergedGroup = new Group();

  get boxSelectionEnabled() {
    return this._boxSelectionEnabled;
  }

  set boxSelectionEnabled(v) {
    v = !!v;
    this._boxSelectionEnabled = v;
    if (v === false) {
      this.selectionBoxHelper.enabled = false;
    } else {
      this.selectionBoxHelper.enabled = true;
    }
  }

  constructor(
    public orbitControls: OrbitControls,
    public camera: PerspectiveCamera,
    public renderer: WebGLRenderer
  ) {
    this.group.name = 'EditControls.group';
    this.group.matrixAutoUpdate = false;
    this.group.visible = true;
    let lastSelected: Mesh | null = null;
    let transformStartPosition: Vector3 | undefined;
    this.selectionBoxHelper = SelectionBoxHelper.getinstance(renderer.domElement, 'selection-box-helper');
    this.selectionBox = new SelectionBox(camera);
    this.helperGroup.add(this.selectionBox.helperGroup);
    this.textureProjectionEditor = new TextureProjectionEditor(this.camera);
    this.group.add(this.faceGroup);
    this.group.add(this.edgeGroup);
    this.group.add(this.sphereGroup);
    this.group.add(this.textureProjectionEditor.group);
    this.group.add(this.mergedGroup);

    eventBus.on(EventType.TRANSFORM_START, function (e) {
      const transformControls = e;
      orbitControls.enabled = false;
      transformStartPosition = transformControls.object?.position.clone();
      console.log('start: ', transformStartPosition?.x, transformStartPosition?.y, transformStartPosition?.z);
    });

    eventBus.on(EventType.TRANSFORM_END, (e) => {
      console.log('end')
      const transformControls = e;
      orbitControls.enabled = true;
      if (!this.selectedFaces.length) {
        if (transformStartPosition && transformControls.object) {
          const pos = transformControls.object.position;
          const vertexsIndexes = transformControls.object.userData.vertexNumer.split('_').map((v: string) => Number(v));
          this.setVertexPosition(vertexsIndexes, pos);
        }
      } else {
        if (transformStartPosition && transformControls.object) {
          console.log('transform')
          const pos = transformControls.object.position.clone();
          const obj = this.editObj[0];
          const invertedMatrix = obj.matrixWorld.clone().invert();
          pos.applyMatrix4(invertedMatrix);
          transformStartPosition.applyMatrix4(invertedMatrix);
          const translation = pos.sub(transformStartPosition);
          const vertexesindex = [];
          const exists = new Set();
          for (let face of this.selectedFaces) {
            const { a, b, c } = face;
            if (!exists.has(a)) {
              vertexesindex.push(a);
            }
            if (!exists.has(b)) {
              vertexesindex.push(b);
            }
            if (!exists.has(c)) {
              vertexesindex.push(c);
            }
          }
          console.log(translation);
          this.translateVertexesPosition(vertexesindex, translation);
        }
      }
      transformStartPosition = undefined;
    });


    this.onSelectBox = (e: MouseEvent, startPos: MousePosition) => {
      if (!this.editObj.length || !this.boxSelectionEnabled) {
        return;
      }
      eventBus.emit(EventType.DETACH_TRANSFORM_OBJECT);
      this.faceGroup.clear();
      const obj = this.editObj[0];
      console.log(e, startPos);
      tempVec3.set(startPos.x, startPos.y, 0.5);
      tempVec3_1.set(e.clientX, e.clientY, 0.5);
      normalizeMousePosition(tempVec3);
      normalizeMousePosition(tempVec3_1);
      const selectedFaces = this.selectionBox.select(tempVec3, tempVec3_1, this.editObj);
      this.selectedFaces = selectedFaces;
      const facesGeometry = new BufferGeometry();
      const vertexes = [];
      // const uvs: number[] = [];
      const points = getAllPoints(obj);
      // const uvPoints = getAllUVs(obj);

      for (let face of selectedFaces) {
        const { a, b, c } = face;
        const ai = points[a];
        const bi = points[b];
        const ci = points[c];

        vertexes.push(
          ai.x, ai.y, ai.z,
          bi.x, bi.y, bi.z,
          ci.x, ci.y, ci.z,
        );
      }

      facesGeometry.setAttribute('position', new Float32BufferAttribute(vertexes, 3));
      const facesMesh = new Mesh(facesGeometry, new MeshBasicMaterial({
        transparent: true,
        color: 0xaa0000,
        opacity: 0.7,
        side: FrontSide,
        vertexColors: false,
      }));
      facesMesh.applyMatrix4(obj.matrixWorld);
      facesMesh.geometry.computeBoundingSphere();
      facesMesh.raycast = _emptyFn;
      facesMesh.frustumCulled = false;
      const sphere = facesMesh.geometry.boundingSphere;
      if (sphere) {

        sphere.applyMatrix4(obj.matrixWorld);

        const editGroup = new Group();
        editGroup.raycast = _emptyFn;
        editGroup.position.set(sphere.center.x, sphere.center.y, sphere.center.z);
        editGroup.updateMatrixWorld();
        const x = facesMesh.matrix
          .clone()
          .premultiply(editGroup.matrixWorld.clone().invert())
          .multiply(facesMesh.matrix.clone().invert());
        facesMesh.applyMatrix4(x);

        editGroup.add(facesMesh);
        editGroup.updateMatrixWorld(true);
        this.faceGroup.add(editGroup);
        eventBus.emit(EventType.ATTACH_TRANSFORM_OBJECT, editGroup);
      }
    }

    this.onSelectVertex = (e: MouseEvent) => {
      if (!this.editObj.length) {
        return;
      }

      const mouse = new Vector2();
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = - (e.clientY / window.innerHeight) * 2 + 1;
      const raycaster = this.raycaster;
      raycaster.setFromCamera(mouse, this.camera);
      const intersects: IntersectInfo[] = [];
      let sphere = new Sphere();
      sphere.radius = this.handlerSize;

      for (let handlerMesh of this.selectHandlers) {
        sphere.center.setFromMatrixPosition(handlerMesh.matrixWorld);
        if (raycaster.ray.intersectSphere(sphere, tempVec3)) {
          const intersectInfo = {
            distance: raycaster.camera.position.distanceTo(handlerMesh.position),
            object: handlerMesh,
          }
          intersects.push(intersectInfo as any);
        }
      }

      if (intersects.length) {
        intersects.sort((a, b) => {
          return a.distance - b.distance;
        });

        const selected = intersects[0].object;

        if (lastSelected === selected) {
          return;
        }

        if (lastSelected) {
          eventBus.emit(EventType.DETACH_TRANSFORM_OBJECT);
          firstChildOfArray(lastSelected.material as MeshBasicMaterial).color.setHex(lastSelected.userData.originColor);
          delete lastSelected.userData.originColor;
        }

        const material = firstChildOfArray(selected.material) as MeshBasicMaterial;
        selected.userData.originColor = material.color.getHex();
        material.color.setHex(0xffffff);
        selected.matrixAutoUpdate = true;
        eventBus.emit(EventType.ATTACH_TRANSFORM_OBJECT, selected);
        lastSelected = selected;
      } else {
        eventBus.emit(EventType.DETACH_TRANSFORM_OBJECT);
        this.faceGroup.clear();

        if (lastSelected) {
          firstChildOfArray(lastSelected.material as MeshBasicMaterial).color.setHex(lastSelected.userData.originColor);
          delete lastSelected.userData.originColor;
        }

        lastSelected = null;
      }
    }
    customMouseEvent.onMouseDrag(this.onSelectBox);
    customMouseEvent.onClickNoMove(this.onSelectVertex);
  }

  destroy() {
    customMouseEvent.offMouseDrag(this.onSelectBox);
    customMouseEvent.offClickNoMove(this.onSelectVertex);
  }

  detach() {
    this.selectHandlers.length = 0;
    this.editObj.length = 0;
    this.sphereGroup.clear();
    this.edgeGroup.clear();
    this.faceGroup.clear();
    eventBus.emit(EventType.DETACH_TRANSFORM_OBJECT);
  }

  attach(obj: Mesh) {
    // this.detach();
    this.mergedGroup.clear();
    const matrixWorld = obj.matrixWorld.clone();
    if (this.editObj.length) {
      const curGeometries = this.editObj.map(m => m.geometry);
      const mergedGeometry = mergeBufferGeometries([...curGeometries, obj.geometry]);
      const basicMaterial = new MeshStandardMaterial({
        color: new Color(0xeeeeee),
        side: DoubleSide
      });
      const materials = Array.from({ length: mergedGeometry.groups.length }).fill(basicMaterial) as MeshStandardMaterial[];
      const merged = new Mesh(mergedGeometry, basicMaterial);
      merged.receiveShadow = true;
      merged.castShadow = true;
      this.detach();
      this.mergedGroup.add(merged);
      merged.applyMatrix4(matrixWorld);
      merged.updateMatrixWorld();
      obj = merged;
    }
    this.editObj.push(obj);
    console.log(obj);
    eventBus.emit(EventType.DETACH_TRANSFORM_OBJECT);
    if (this.sphereHandlerEnabled) {
      const points = this.getPoints(obj);
      const [vertexes, vertexesIndexes] = this.getVertexes(points);
      this.addSpheresToVertexes(vertexes, vertexesIndexes, obj.matrixWorld);
    }
    const points = getAllPoints(obj);
    this.addMeshEdge(points, obj.matrixWorld);
  }

  addMeshEdge(vertexes: Vector3[], transform: Matrix4) {
    const geometry = new BufferGeometry();
    const array = [];
    for (let i = 0; i < vertexes.length; i += 3) {
      const p1 = vertexes[i];
      const p2 = vertexes[i + 1];
      const p3 = vertexes[i + 2];
      array.push(
        p1.x, p1.y, p1.z,
        p2.x, p2.y, p2.z,
        p1.x, p1.y, p1.z,
        p3.x, p3.y, p3.z,
        p2.x, p2.y, p2.z,
        p3.x, p3.y, p3.z,
      );
    }

    geometry.setAttribute('position', new Float32BufferAttribute(array, 3));
    const material = new LineBasicMaterial({ color: 0x00ffff, depthTest: false, transparent: true, opacity: 0.5 });
    material.linewidth = 1;
    const line = new LineSegments(geometry, material);
    function emptyRaycast() { }
    const editGroup = this.edgeGroup;
    // editGroup.matrixAutoUpdate = false;
    editGroup.raycast = emptyRaycast;
    editGroup.matrix.copy(transform);
    editGroup.matrixAutoUpdate = false;
    editGroup.renderOrder = 999;
    editGroup.add(line);
  }

  addSpheresToVertexes(vertexes: Vector3[], vertexesIndexes: Map<Vector3, number[]>, transform: Matrix4) {
    let sphereGeometry = new SphereGeometry(this.handlerSize, 5, 5);
    function emptyRaycast() { }
    const editGroup = this.sphereGroup;
    // editGroup.matrixAutoUpdate = false;
    editGroup.raycast = emptyRaycast;
    editGroup.applyMatrix4(transform);
    editGroup.matrix.copy(transform);
    editGroup.updateWorldMatrix(true, false);

    vertexes.map((item, index) => {
      let sphere = new Mesh(sphereGeometry, new MeshBasicMaterial({ color: new Color('red') }));
      sphere.raycast = emptyRaycast;
      sphere.name = 'editMeshHelper';
      sphere.position.set(item.x, item.y, item.z);
      sphere.updateMatrixWorld(true);
      sphere.userData.vertexNumer = vertexesIndexes.get(item)!.join('_');
      // sphere.matrixAutoUpdate = false;
      // sphere.applyMatrix4(transform);
      editGroup.add(sphere);
      this.selectHandlers.push(sphere);
    });
  }

  getPoints(mesh: Mesh) {
    return getPoints(mesh);
  }

  setVertexPosition(vertexesIndexes: number[], pos: Vector3) {
    if (!this.editObj.length) {
      console.warn('no edit object attached');
      return;
    }
    const mesh = this.editObj[0];
    let pointsArray = mesh.geometry.attributes.position.array;
    let itemSize = mesh.geometry.attributes.position.itemSize;
    const newPositions = [];
    for (let i = 0; i < pointsArray.length; i++) {
      newPositions.push(pointsArray[i]);
    }
    for (let vertexsIndex of vertexesIndexes) {
      const xIndex = vertexsIndex * itemSize;
      const yIndex = xIndex + 1;
      const zIndex = yIndex + 1;
      newPositions[xIndex] = pos.x;
      newPositions[yIndex] = pos.y;
      newPositions[zIndex] = pos.z;
    }
    mesh.geometry.setAttribute('position', new Float32BufferAttribute(newPositions, 3));
    mesh.geometry.attributes.position.needsUpdate = true;
  }

  translateVertexesPosition(vertexesIndexes: number[], translation: Vector3) {
    if (!this.editObj.length) {
      console.warn('no edit object attached');
      return;
    }
    const mesh = this.editObj[0];
    let index = mesh.geometry.index;
    if (!index) {
      return;
    }
    const indexArray = index.array;
    const allIndex = [];
    const attrPosition = mesh.geometry.getAttribute('position');
    const signSet = new Set();
    for (let vertexIndex of vertexesIndexes) {
      const pi = indexArray[vertexIndex];
      const x = attrPosition.getX(pi);
      const y = attrPosition.getY(pi);
      const z = attrPosition.getZ(pi);

      signSet.add(`${x}_${y}_${z}`);
    }
    for (let i = 0; i < attrPosition.count; i++) {
      const x = attrPosition.getX(i);
      const y = attrPosition.getY(i);
      const z = attrPosition.getZ(i);
      const sign = `${x}_${y}_${z}`;
      if (signSet.has(sign)) {
        const v = new Vector3(x, y, z);
        v.add(translation);
        attrPosition.setXYZ(i, v.x, v.y, v.z);
      }
    }

    attrPosition.needsUpdate = true;
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
}

export function firstChildOfArray<T>(arr: T[] | T): T {
  if (Array.isArray(arr)) {
    return arr[0];
  } else {
    return arr;
  }
}

export function raycastObject(raycaster: Raycaster, obj: Object3D, intersects: any[]) {
  if (obj.children.length) {
    for (let child of obj.children) {
      raycastObject(raycaster, child, intersects);
    }
  }
  Object.getPrototypeOf(obj).raycast.call(obj, raycaster, intersects);
  return intersects;
}

export function getVertexes(points: Vector3[]): [Vector3[], Map<Vector3, number[]>] {
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

export function getFacesAndNormals(mesh: Mesh): [MeshFace[], Vector3[]] {
  mesh.geometry.computeVertexNormals();
  const points = getAllPoints(mesh);
  const ns = getAllVec3Attrib(mesh, 'normal');
  if (!ns) {
    console.error('no normals found');
    return [[], []];
  }

  const normals: Vector3[] = [];
  const faces: MeshFace[] = [];
  let idx = 0;
  if (points.length % 3 !== 0) {
    console.error(`points.length is ${points.length}`);
  }
  while (idx < points.length) {
    const n1 = ns[idx];
    const n2 = ns[idx + 1];
    const n3 = ns[idx + 2];

    const normal = n1.clone().add(n2).add(n3);
    normal.normalize();
    normals.push(normal);

    const a = points[idx];
    const b = points[idx + 1];
    const c = points[idx + 2];
    const center_x = (a.x + b.x + c.x) / 3;
    const center_y = (a.y + b.y + c.y) / 3;
    const center_z = (a.z + b.z + c.z) / 3;
    faces.push(new MeshFace(idx, idx + 1, idx + 2, new Vector3(center_x, center_y, center_z)));
    idx += 3;
  }
  return [faces, normals];
}

export function getFaces(points: Vector3[]) {
  const faces: MeshFace[] = [];
  let idx = 0;
  if (points.length % 3 !== 0) {
    console.error(`points.length is ${points.length}`);
  }
  while (idx < points.length) {
    const a = points[idx];
    const b = points[idx + 1];
    const c = points[idx + 2];
    const center_x = (a.x + b.x + c.x) / 3;
    const center_y = (a.y + b.y + c.y) / 3;
    const center_z = (a.z + b.z + c.z) / 3;
    faces.push(new MeshFace(idx, idx + 1, idx + 2, new Vector3(center_x, center_y, center_z)));
    idx += 3;
  }
  return faces;
}

export function getPoints(mesh: Mesh) {
  let pointsArray = mesh.geometry.attributes.position.array;
  let itemSize = mesh.geometry.attributes.position.itemSize;

  let points = [];

  for (let i = 0; i < pointsArray.length; i += itemSize) {
    points.push(new Vector3(pointsArray[i], pointsArray[i + 1], pointsArray[i + 2]));
  }

  return points;
}

export function getAllPoints(mesh: Mesh) {
  const index = mesh.geometry.getIndex();
  let pointsArray = mesh.geometry.attributes.position.array;
  let itemSize = mesh.geometry.attributes.position.itemSize;

  let points = [];

  if (index) {
    const ia = index.array;
    for (let i = 0; i < ia.length; i++) {
      const p1 = ia[i];
      points.push(new Vector3(
        pointsArray[p1 * itemSize],
        pointsArray[p1 * itemSize + 1],
        pointsArray[p1 * itemSize + 2],
      ));
    }
  } else {
    return getPoints(mesh);
  }

  return points;
}


export function getAllVec3Attrib(mesh: Mesh, attrName: string) {
  const index = mesh.geometry.getIndex();
  let pointsArray = mesh.geometry.attributes[attrName].array;
  let itemSize = mesh.geometry.attributes[attrName].itemSize;

  if (itemSize !== 3) {
    console.error('attribute item size is not 3');
    return null;
  }
  let points = [];

  if (index) {
    const ia = index.array;
    for (let i = 0; i < ia.length; i++) {
      const p1 = ia[i];
      points.push(new Vector3(
        pointsArray[p1 * itemSize],
        pointsArray[p1 * itemSize + 1],
        pointsArray[p1 * itemSize + 2],
      ));
    }
  } else {
    console.error('mesh doesn\'t have index');
    return null;
  }

  return points;
}


export function getAllUVs(mesh: Mesh) {
  const index = mesh.geometry.getIndex();
  let pointsArray = mesh.geometry.attributes.uv.array;
  let itemSize = mesh.geometry.attributes.uv.itemSize;

  let points = [];

  if (index) {
    const ia = index.array;
    for (let i = 0; i < ia.length; i++) {
      const p1 = ia[i];
      points.push(new Vector2(
        pointsArray[p1 * itemSize],
        pointsArray[p1 * itemSize + 1],
      ));
    }
  }

  return points;
}

export function createTriangle(vertices: [Vector3, Vector3, Vector3], material: MeshBasicMaterial) {
  let positions: number[] = [];

  vertices.map((item) => {
    positions.push(item.x);
    positions.push(item.y);
    positions.push(item.z);
  });

  const geometry = new BufferGeometry();

  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3)
  );

  geometry.setIndex([0, 1, 2]);

  const mesh = new Mesh(geometry, material);

  return mesh;
}

function normalizeMousePosition(mouse: Vector2 | Vector3) {
  mouse.x = (mouse.x / window.innerWidth) * 2 - 1;
  mouse.y = - (mouse.y / window.innerHeight) * 2 + 1;
  return mouse;
}

function exportTextureToUrl(texture: Texture, openInNewTab = true) {
  const image = texture.image as ImageBitmap;
  const { width, height } = image;
  const cvs = document.createElement('canvas');
  cvs.width = width;
  cvs.height = height;
  const ctx = cvs.getContext('2d');
  ctx?.drawImage(image, 0, 0);
  return new Promise((resolve, reject) => {
    cvs.toBlob((b) => {
      if (!b) {
        reject();
        return;
      }
      const url = URL.createObjectURL(b);
      if (openInNewTab) {
        window.open(url, '_blank');
      }
      resolve(url);
    });
  })
}

(window as any).exportTextureToUrl = exportTextureToUrl;

export function getTileOfObject3D(obj: Object3D) {
  let target: Object3D | null = obj;
  while (target && !(target.parent instanceof TilesGroup)) {
    target = target.parent;
  }
  const tr = GlobalVar.get('tilesRenderer');
  if (!target || !tr) {
    return null;
  }
  const tile = [...tr.activeTiles].find((t: any) => t.cached?.scene === target);
  return tile;
}

export const GlobalVar = {
  map: new Map<string, any>(),
  get(name: string) {
    return GlobalVar.map.get(name);
  },
  set(name: string, value: any) {
    GlobalVar.map.set(name, value);
  }
}

export function rayTriangleIntersection(v1: Vector3, v2: Vector3, v3: Vector3, origin: Vector3, dir: Vector3) {

  //Find vectors for two edges sharing V1
  const e1 = v2.clone().sub(v1);
  const e2 = v3.clone().sub(v1);

  //Begin calculating determinant - also used to calculate u parameter
  const P = dir.clone().cross(e2);
  //if determinant is near zero, ray lies in plane of triangle
  const det = e1.clone().dot(P);
  //NOT CULLING
  if (det > -Number.EPSILON && det < Number.EPSILON) {
    return false;
  }
  const inv_det = 1 / det;

  //calculate distance from V1 to ray origin
  const T = origin.clone().sub(v1);

  //Calculate u parameter and test bound
  const u = T.clone().dot(P) * inv_det;
  //The intersection lies outside of the triangle
  if (u < 0 || u > 1) {
    return false;
  }

  //Prepare to test v parameter
  const Q = T.clone().cross(e1);
  //Calculate V parameter and test bound
  const v = dir.clone().dot(Q) * inv_det;

  //The intersection lies outside of the triangle
  if (v < 0 || u + v > 1) {
    return false;
  }

  const t = e2.clone().dot(Q) * inv_det;

  //ray intersection
  if (t > Number.EPSILON) {
    return origin.clone().add(dir.clone().multiplyScalar(t));
  }

  return false;
}

export function mergeMeshes(meshes: Mesh[]) {
  const geometrys = meshes.map(m => m.geometry);
  const mergedGeometry = mergeBufferGeometries(geometrys);
  const newMesh = new Mesh(mergedGeometry, new MeshBasicMaterial());
  return newMesh;
}