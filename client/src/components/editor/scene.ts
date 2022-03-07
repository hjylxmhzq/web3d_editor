import { SceneInfo } from './index';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { Box3, Scene, Vector3, Vector2, Raycaster, Group, Object3D, Intersection, Mesh, Material, MeshBasicMaterial, Color, Matrix4, BufferGeometry, MeshStandardMaterial, BoxHelper, Box3Helper, FrontSide, SphereBufferGeometry, Texture } from 'three';
import EventEmitter from 'events';
import { CustomTransformControls } from '../Scene/CustomTransformControls';
import { FlyOrbitControls } from '../Scene/FlyOrbitControls';
import { customMouseEvent } from '../Scene/customMouseEvent';
import { sceneManager } from '../api/scene';
import { Octree } from './utils/Octree';
import { SimplifyModifier } from './utils/SimplifyModifier';
import { SimplifyModifier as SimplifyModifierOrigin } from './utils/SimplifyModifierOrigin';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter'
import { mergeVertices } from './utils/mergeVertices';
import simplifyMesh from './utils/SimplifyModifierTexture';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { saveToLocal, TilesGenerator } from './utils/gen3dtiles';
import { generateUUID } from 'three/src/math/MathUtils';
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree, MeshBVHVisualizer, SplitStrategy, SAH, CENTER, AVERAGE } from 'three-mesh-bvh';
import { createMeshEdge, GeometryOperator, mergeMeshesInGroup } from './utils/GeometryUtils';
import { debounce, normalizeMousePosition } from './utils/common';
import { SubdivisionModifier } from './utils/SubdivisionModifier';
import { createBrushHelper, performStroke, StrokeParameter } from './utils/sculptTools';
import customKeyboardEvent from './utils/inputEvent';
import { observe, SceneSetting, sceneSettings } from './settings';
import { useRef } from 'react';
import { createPaintBrushMesh, getLastMaterial, performPaint, performPaintOnPoint } from './utils/drawTools';
import { getTrianglesHighlightMesh, updateHighlightTriangle } from './utils/Highlight';
import { getCanvas, isCanvas } from './utils/canvas';
import { MaterialStaticUtils } from './utils/MaterialUtils';
import { disableShadow, enableShadow, raycastMesh } from './utils/SceneUtils';
import { loadFile } from './utils/Files';
import { sceneStorage } from './store';

const saveBtn = document.createElement('button');

saveBtn.style.position = 'fixed';

saveBtn.style.left = '20px';
saveBtn.style.top = '20px';
saveBtn.innerHTML = 'SAVE'

document.body.append(saveBtn);


const renderEvent = new EventEmitter();

const _v0 = new Vector3();
const _m0 = new Matrix4();
const _identityM4 = new Matrix4().identity();

const seletedMeshRef: { current: undefined | Mesh } = { current: undefined };
const seletedMeshSet: Set<Mesh> = new Set();

const raycaster = new Raycaster();

export async function scene(si: SceneInfo) {
  const { camera, scene, renderer } = si;


  observe(() => sceneSettings.currentTool, (o, n) => {

    let currentTool = sceneSettings.currentTool;

    if (currentTool === 'sculpt') {

      // brushHelper.visible = true;

    } else {

      brushHelper.visible = false;

    }

    if (currentTool === 'paint') {

      // paintBrushHelper.visible = true;

    } else {

      paintBrushHelper.visible = false;

    }

    if (currentTool !== 'move') {

      transformControl.detach();

    }
  });

  observe(() => sceneSettings.scene.castShadow, (o, n) => {

    const castShadow = sceneSettings.scene.castShadow;

    console.log(castShadow)

    if (castShadow) {

      enableShadow(group);

    } else {

      disableShadow(group);

    }

  });

  observe(() => sceneSettings.global.subdivision, (o, n) => {

    console.log(o, n)
    if (o !== n) {

      if (seletedMeshRef.current) {

        const newGeo = subdivitionModifier.modify(seletedMeshRef.current.geometry);

        seletedMeshRef.current.geometry = newGeo;

        updateBVHHelper();

        updateMeshEdge();

      }

    }

  });


  observe(() => sceneSettings.global.showBoundingBox, (o, n) => {

    if (o !== n) {

      if (sceneSettings.global.showBoundingBox) {

        updateBoundingBox();

      } else {

        boxHelperGroup.clear();

      }

    }

  });

  observe(() => sceneSettings.global.simplification, (o, n) => {
    if (o !== n) {
      if (seletedMeshRef.current) {
        const newGeo = simplifyMesh(seletedMeshRef.current.geometry, 0.1, true);
        seletedMeshRef.current.geometry = newGeo;
        updateBVHHelper();
        updateMeshEdge();
      }
    }
  });

  observe(() => sceneSettings.global.meshEdgeDepthTest, (o, n) => {
    if (o !== n) {
      if (seletedMeshRef.current) {
        updateMeshEdge();
      }
    }
  });

  observe(() => sceneSettings.action.importModel, async (o, n) => {
    const file = await loadFile('.glb');
    const url = URL.createObjectURL(file);
    const model = await loadGltf(scene, url);
    group.add(model);
  });

  observe(() => sceneSettings.action.loadTexturesInScene, async (o, n) => {
    await MaterialStaticUtils.collectTextures(group);
  });

  observe(() => {
    let { roughness, metalness } = sceneSettings.paint
  }, async (o, n) => {
    if (seletedMeshRef.current) {
      let { roughness, metalness } = sceneSettings.paint
      const material = MaterialStaticUtils.getAllMaterial(seletedMeshRef.current);
      for (let m of material) {
        if (m instanceof MeshStandardMaterial) {
          m.metalness = metalness;
          m.roughness = roughness;
        }
      }
    }
  });

  observe(() => sceneSettings.action.applyTexture, async (o, n) => {
    if (!seletedMeshRef.current) {

      return;

    }

    const textureImg = await sceneStorage.getTextureImage(sceneSettings.action.applyTexture);
    const texture = sceneStorage.getTexture(sceneSettings.action.applyTexture);

    if (texture && textureImg) {

      const { naturalWidth: w, naturalHeight: h } = textureImg;
      const cvs = getCanvas(w, h);
      const ctx = cvs.getContext('2d');
      if (ctx) {

        ctx.drawImage(textureImg, 0, 0, w, h);
        const imgBitMap = await createImageBitmap(cvs);

        const mList = MaterialStaticUtils.getAllMaterial(seletedMeshRef.current);

        if (texture.type === 'albedo') {

          const t = MaterialStaticUtils.getTexture(seletedMeshRef.current);
          if (t) {
            t.image = imgBitMap;
            t.needsUpdate = true;
          }

        } else if (texture.type === 'normal') {

          for (let m of mList) {

            if (m instanceof MeshStandardMaterial) {

              const normalMap = m.map?.clone() || new Texture();

              normalMap.image = imgBitMap;

              normalMap.needsUpdate = true;

              m.normalMap = normalMap;

              m.needsUpdate = true;

            }

          }

        } else if (texture.type === 'displace') {

          for (let m of mList) {

            if (m instanceof MeshStandardMaterial) {

              const displaceMap = m.map?.clone() || new Texture();

              displaceMap.image = imgBitMap;

              displaceMap.needsUpdate = true;

              m.displacementMap = displaceMap;

              m.needsUpdate = true;

            }

          }

        }

      }

    }
  });

  observe(() => {
    let _ = sceneSettings.global.showOctreeHelper;
    let __ = sceneSettings.global.showBVHHelper;
    let __1 = sceneSettings.global.BVHHelperDepth;
    let __2 = sceneSettings.global.showMeshEdge;
  }, (o, n) => {

    let { showOctreeHelper, showBVHHelper, BVHHelperDepth, showMeshEdge } = sceneSettings.global;

    if (showOctreeHelper) {
      octree.helperGroup.visible = true;
    } else {
      octree.helperGroup.visible = false;
    }

    if (showBVHHelper) {
      updateBVHHelper();
    } else {
      if (bvhHelperGroup.children.length > 0) {
        bvhHelperGroup.children[0].visible = false;
      }
    }

    if (showMeshEdge) {
      updateMeshEdge()
    } else {
      meshEdgeHelperGroup.clear();
    }

    if (bvhHelperGroup.children.length) {
      (bvhHelperGroup.children[0] as MeshBVHVisualizer).depth = BVHHelperDepth;
      (bvhHelperGroup.children[0] as MeshBVHVisualizer).update();
    }

  });

  let helperGroup = new Group();
  let meshEdgeHelperGroup = new Group();
  let bvhHelperGroup = new Group();
  let brushHelper = createBrushHelper();
  let paintBrushHelper = createPaintBrushMesh();
  let trianglesHighlightHelper = getTrianglesHighlightMesh();
  let boxHelperGroup = new Group();
  brushHelper.visible = false;
  paintBrushHelper.visible = false;

  scene.add(helperGroup);
  helperGroup.add(brushHelper);
  helperGroup.add(meshEdgeHelperGroup);
  helperGroup.add(bvhHelperGroup);
  helperGroup.add(boxHelperGroup);
  helperGroup.add(paintBrushHelper);
  helperGroup.add(trianglesHighlightHelper);

  let octree = new Octree({
    undeferred: false,
    // set the max depth of tree
    depthMax: 10,
    // max number of objects before nodes split or merge
    objectsThreshold: 8,
    // percent between 0 and 1 that nodes will overlap each other
    // helps insert objects that lie over more than one node
    radius: 10,
    overlapPct: 0,
    scene,
  });

  const tilesGenerator = new TilesGenerator();

  const subdivitionModifier = new SubdivisionModifier(1);

  function renderLoop() {
    requestAnimationFrame(renderLoop);
    renderer.render(scene, camera);
    octree.update();
    camera.updateMatrixWorld();
    renderEvent.emit('render');
  }

  const flyOrbitControls = new FlyOrbitControls(camera, renderer.domElement);
  flyOrbitControls.screenSpacePanning = false;
  flyOrbitControls.minDistance = 1;
  flyOrbitControls.maxDistance = 2000;

  let originLiveSelect = sceneSettings.scene.liveSelect;

  flyOrbitControls.addEventListener('start', (e) => {

    originLiveSelect = sceneSettings.scene.liveSelect;
    sceneSettings.scene.liveSelect = false;

  });

  flyOrbitControls.addEventListener('end', (e) => {

    sceneSettings.scene.liveSelect = originLiveSelect;

  });

  const transformControl = new CustomTransformControls(camera, renderer.domElement);
  onTransform(transformControl, octree);

  scene.add(transformControl);


  function updateMeshEdge() {

    if (seletedMeshRef.current && sceneSettings.global.showMeshEdge) {

      meshEdgeHelperGroup.clear();
      meshEdgeHelperGroup.add(createMeshEdge(seletedMeshRef.current, sceneSettings.global.meshEdgeDepthTest));

    }

  }

  function updateBVHHelper(refit = false) {

    if (!seletedMeshRef.current?.geometry.boundsTree || !sceneSettings.global.showBVHHelper) return;

    if (refit) {

      if (bvhHelperGroup.children[0]) {

        (bvhHelperGroup.children[0] as MeshBVHVisualizer).update();

      }
      return;

    }

    const bvhVisualizer = new MeshBVHVisualizer(seletedMeshRef.current, sceneSettings.global.BVHHelperDepth);

    bvhVisualizer.opacity = 0.8;
    bvhVisualizer.depth = sceneSettings.global.BVHHelperDepth;

    bvhVisualizer.name = 'bvhVisualizer';

    bvhHelperGroup.clear();

    bvhHelperGroup.position.set(0, 0, 0);
    bvhHelperGroup.scale.set(1, 1, 1);
    bvhHelperGroup.quaternion.identity();

    bvhHelperGroup.add(bvhVisualizer);

    bvhHelperGroup.applyMatrix4(seletedMeshRef.current.matrixWorld);

    console.log(bvhVisualizer)

  }

  function updateBoundingBox(force = true) {

    boxHelperGroup.clear();

    if (!sceneSettings.global.showBoundingBox) {

      return;

    }

    if (seletedMeshRef.current) {

      const mesh = seletedMeshRef.current;

      if (force || !mesh.geometry.boundingBox) {

        mesh.geometry.computeBoundingBox();

      }

      const bbox = mesh.geometry.boundingBox?.clone().applyMatrix4(mesh.matrixWorld);

      if (!bbox) return;

      const boxHelper = new Box3Helper(bbox, new Color('blue'));

      // boxHelper.applyMatrix4(mesh.matrixWorld);

      boxHelperGroup.add(boxHelper);

    }

  }

  transformControl.addEventListener('mouseDown', (e) => {

    flyOrbitControls.enabled = false;

  });

  transformControl.addEventListener('mouseUp', (e) => {

    flyOrbitControls.enabled = true;
    updateMeshEdge();
    updateBoundingBox();

  });

  renderEvent.on('render', () => {

    if (sceneSettings.currentTool === 'sculpt') {

      brushHelper.scale.set(sceneSettings.sculpt.size, sceneSettings.sculpt.size, sceneSettings.sculpt.size);

    }

    if (sceneSettings.currentTool === 'paint') {

      paintBrushHelper.scale.set(sceneSettings.paint.size, sceneSettings.paint.size, sceneSettings.paint.size);

    }

  });

  customKeyboardEvent.onWheel(e => {

    if (customKeyboardEvent.ctrl) {

      if (sceneSettings.currentTool === 'sculpt') {

        sceneSettings.sculpt.size += e.deltaY / 500;
        sceneSettings.sculpt.size = sceneSettings.sculpt.size < 0.05 ? 0.05 : sceneSettings.sculpt.size > 1000 ? 1000 : sceneSettings.sculpt.size;

      }

      if (sceneSettings.currentTool === 'paint') {

        sceneSettings.paint.size += e.deltaY / 500;
        sceneSettings.paint.size = sceneSettings.paint.size < 0.05 ? 0.05 : sceneSettings.paint.size > 1000 ? 1000 : sceneSettings.paint.size;

      }

    }

  });

  customKeyboardEvent.onKey('Control',
    (e) => {

      flyOrbitControls.enabled = false;

    },
    (e) => {

      flyOrbitControls.enabled = true;

    }
  );

  customMouseEvent.onMouseDown(() => {

    const m = getLastMaterial();

    if (m && m.map && isCanvas(m.map.image)) {

      const ctx = m.map.image.getContext('2d');

      if (ctx) {

        ctx.beginPath();

      }

    }

  });

  customMouseEvent.onMousemove((e) => {

    if (sceneSettings.scene.liveSelect) {

      updateSeletedMesh(e);

    }

    const boundsTree = seletedMeshRef.current?.geometry.boundsTree;

    if (sceneSettings.currentTool === 'sculpt' || sceneSettings.currentTool === 'paint') {

      if (boundsTree && seletedMeshRef.current) {

        const { clientX: x, clientY: y } = e;

        let mouse = new Vector2(x, y);

        mouse = normalizeMousePosition(mouse);

        raycaster.setFromCamera(mouse, camera);

        const invMat = new Matrix4();

        invMat.copy(seletedMeshRef.current.matrixWorld).invert();

        const ray = raycaster.ray.clone();

        ray.applyMatrix4(invMat);

        const hit = boundsTree.raycast(ray, FrontSide);

        if (hit.length) {

          if (sceneSettings.currentTool === 'sculpt') {

            brushHelper.visible = true;

            hit.sort((a, b) => a.distance - b.distance);

            const hitFirst = hit[0];

            _v0.copy(hitFirst.point).applyMatrix4(seletedMeshRef.current.matrixWorld);

            brushHelper.position.copy(_v0);

            if (customMouseEvent.mousedown && customKeyboardEvent.ctrl) {

              const changedTriangles = new Set();
              const changedIndices = new Set();
              const traversedNodeIndices = new Set();
              const sets = {

                accumulatedTriangles: changedTriangles,
                accumulatedIndices: changedIndices,
                accumulatedTraversedNodeIndices: traversedNodeIndices,

              };

              performStroke(boundsTree, _v0, seletedMeshRef.current, brushHelper, false, sets, sceneSettings.sculpt);

              meshEdgeHelperGroup.clear();
              updateMeshEdge();
              updateBVHHelper(true);

            } else {

              performStroke(boundsTree, _v0, seletedMeshRef.current, brushHelper, true, {}, sceneSettings.sculpt);

            }

          } else if (sceneSettings.currentTool === 'paint') {

            paintBrushHelper.visible = true;

            hit.sort((a, b) => a.distance - b.distance);

            const hitFirst = hit[0];

            _v0.copy(hitFirst.point).applyMatrix4(seletedMeshRef.current.matrixWorld);

            const face = hitFirst.face;

            paintBrushHelper.position.copy(_v0);

            if (customMouseEvent.mousedown && customKeyboardEvent.ctrl) {

              const changedTriangles = new Set();
              const changedIndices = new Set();
              const traversedNodeIndices = new Set();
              const sets = {

                accumulatedTriangles: changedTriangles,
                accumulatedIndices: changedIndices,
                accumulatedTraversedNodeIndices: traversedNodeIndices,

              };

              if (sceneSettings.paint.verticeColor) {

                performPaint(boundsTree, _v0, seletedMeshRef.current, paintBrushHelper, sceneSettings.paint);

              } else if (face) {

                performPaintOnPoint(_v0, face, seletedMeshRef.current, sceneSettings.paint);

              }

            }

          }


        }

      }

    }

  });

  function updateSeletedMesh(e: MouseEvent) {

    const { clientX: x, clientY: y } = e;

    let mouse = new Vector2(x, y);

    mouse = normalizeMousePosition(mouse);

    raycaster.setFromCamera(mouse, camera);

    const intersects: Intersection[] = [];

    raycaster.intersectObjects([group], true, intersects);

    console.log(intersects);

    intersects.filter(m => m.object instanceof Mesh).sort((a, b) => a.distance - b.distance);

    if (intersects.length) {

      const firstCast = intersects[0].object;

      if (firstCast !== seletedMeshRef.current) {

        if (seletedMeshRef.current?.geometry.boundsTree) {

          seletedMeshRef.current.geometry.boundsTree = undefined;

        }

        if (customKeyboardEvent.ctrl) {

          seletedMeshSet.add(firstCast as Mesh);

        } else {

          seletedMeshSet.clear();

        }

        console.log(firstCast);

        seletedMeshRef.current = firstCast as Mesh;

        seletedMeshRef.current.updateMatrixWorld();

        const texture = MaterialStaticUtils.getTexture(seletedMeshRef.current);

        const material = MaterialStaticUtils.getAllMaterial(seletedMeshRef.current);

        if (material.length) {


          for (let m of material) {

            if (m instanceof MeshStandardMaterial) {

              const { roughness, metalness } = m;

              sceneSettings.paint.roughness = roughness;
              sceneSettings.paint.metalness = metalness;

            }

          }

        }

        if (texture) {

          const image = texture.image;

          if (image) {

            const cvs = getCanvas(image.width, image.height);

            const ctx = cvs.getContext('2d');

            if (ctx) {

              ctx.drawImage(image, 0, 0, image.width, image.height);

            }

          }

        }

        updateBoundingBox();

        const boundsTree = new MeshBVH(seletedMeshRef.current.geometry, {
          strategy: CENTER
        });

        seletedMeshRef.current.geometry.boundsTree = boundsTree;

        if (sceneSettings.global.showBVHHelper) {

          updateBVHHelper();

        }

        meshEdgeHelperGroup.clear();
        updateMeshEdge();

        return;

      }

    } else {

      if (seletedMeshRef.current?.geometry.boundsTree) {

        seletedMeshRef.current.geometry.boundsTree = undefined;

      }

      seletedMeshRef.current = undefined;
      transformControl.detach();
      flyOrbitControls.enabled = true;
      brushHelper.visible = false;
      paintBrushHelper.visible = false;
      meshEdgeHelperGroup.clear();
      return;

    }

    const boundsTree = seletedMeshRef.current.geometry.boundsTree;

    if (boundsTree && seletedMeshRef.current) {

      const invMat = new Matrix4();

      invMat.copy(seletedMeshRef.current.matrixWorld).invert();

      const ray = raycaster.ray.clone();

      ray.applyMatrix4(invMat);

      console.time('bvh raycast time');
      const hit = boundsTree.raycast(ray, FrontSide);
      console.timeEnd('bvh raycast time');

      console.log('hit: ', hit);

      const _temp = new Vector3();

      if (hit.length) {

        hit.sort((a, b) => a.distance - b.distance);

        const intersection = hit[0];

        if (intersection.faceIndex && intersection.face) {

          const go = new GeometryOperator(seletedMeshRef.current.geometry);

          if (sceneSettings.currentTool === 'addvertex') {

            go.addVerticeInFace(intersection.faceIndex, intersection.point);

          } else if (sceneSettings.currentTool === 'deletevertex') {

            go.removeAllJointFacesByFace(intersection.faceIndex);

          } else if (sceneSettings.currentTool === 'addface') {

            go.addLoopFaceInFace(intersection.faceIndex);

          } else if (sceneSettings.currentTool === 'move') {

            transformControl.detach();
            transformControl.attach(seletedMeshRef.current);

          }

          // go.removeAllJointFacesByFaceVertex(intersection.faceIndex, 0);

          // const meshFace = new MeshFace(face.a, face.b, face.c, _temp);

          const newGeo = go.rebuild();

          seletedMeshRef.current.geometry = newGeo;

          meshEdgeHelperGroup.clear();


          seletedMeshRef.current.geometry.boundsTree = new MeshBVH(newGeo, { strategy: CENTER });

          updateMeshEdge();

          updateBVHHelper();

        }

      }
    }

  }

  customMouseEvent.onClickNoMove((e) => {

    updateSeletedMesh(e);

  });

  renderLoop();
  // const sceneFile = '3dtiles/gltf_b3dm/rock.gltf';
  // const sceneFile = '3dtiles/gltf_b3dm/trunk.glb';
  // const sceneFile = '3dtiles/gltf_b3dm/po1.glb';
  const sceneFile = '3dtiles/gltf_b3dm/mountain1.glb';
  // const sceneFile = '3dtiles/gltf_b3dm/city.glb';
  // const sceneFile = '3dtiles/gltf_b3dm/cottage2.glb';
  // const sceneFile = '3dtiles/gltf_b3dm/model.gltf';
  // const sceneFile = '3dtiles/gltf_b3dm/l22_1910.glb';
  // const sceneFile = '3dtiles/gltf_b3dm/l23_402.glb';
  // const sceneFile = '3dtiles/gltf_b3dm/lod17.glb';
  // const sceneFile = '3dtiles/gltf_b3dm/lod17_1.glb';
  // const sceneFile = '3dtiles/gltf1/sample.gltf';
  // const sceneFile = '3dtiles/b3dm2gltf/BlockBA_L18_';
  // const sceneFile = '3dtiles/gltf_b3dm/plane_tree_trunk/scene.gltf';
  // const sceneFile = '3dtiles/test_data2/luogang.glb';
  // const sceneFile = '3dtiles/gltf_b3dm/luogang_merged.glb';
  // const sceneFile = '3dtiles/gltf_b3dm/luogang_merged.gltf';

  const model = await loadGltf(scene, 'http://127.0.0.1:8999/' + sceneFile);

  const basicMaterial = new MeshStandardMaterial({ color: new Color('white'), wireframe: false, wireframeLinewidth: 1 });

  // model.position.set(0, 0, 0);
  console.log(model);

  const simplifyModifier = new SimplifyModifier();

  const simplifyModifierOrigin = new SimplifyModifierOrigin();

  // mergeMeshesInGroup(model, true);

  // model.traverse(m => {
  //   if (m instanceof Mesh) {
  //     // m.material = basicMaterial;
  //     // allGeo.push(m.geometry);
  //     // octree.add(m);
  //     modelMesh = m.clone(true);
  //     modelMesh.applyMatrix4(m.parent?.matrixWorld);
  //   }
  // });


  // modelMesh.material = basicMaterial;

  // helperGroup.add(createMeshEdge(modelMesh, true, new Color('red')));

  // modelMesh.geometry = subdivitionModifier.modify(simGeo);

  // const simGeo = simplifyMesh(modelMesh.geometry, 0.1, false);
  // const simGeo = simplifyModifier.modify(modelMesh.geometry, 1) as any;
  // modelMesh.geometry = simGeo;


  const group = new Group();

  group.add(model);

  scene.add(group);

  group.traverse(m => {
    if (m instanceof Mesh) {
      octree.add(m);
    }
  });

  saveBtn.addEventListener('click', async () => {
    if (!tilesGenerator.fileList.length) {
      await tilesGenerator.gen3dTile(octree);
    } else {
      await saveToLocal(tilesGenerator.fileList);
    }
  });

  enableShadow(group);
  await sceneManager.init(sceneFile, group);
  console.log('sceneManager inited');
  (window as any).octree = octree;
  (window as any).sceneManager = sceneManager;
}

const meshMaterialMap = new Map<Mesh, Material | Material[]>();

function onTransform(tc: CustomTransformControls, octree: Octree) {
  let startMatrix: Matrix4 | null = null;
  tc.addEventListener('mouseDown', () => {
    const obj = tc.object;
    obj.updateMatrix();
    startMatrix = obj.matrix.clone();
  });
  tc.addEventListener('mouseUp', async () => {
    octree.rebuild();
    const obj = tc.object;
    obj.updateMatrix();
    if (startMatrix && !startMatrix.equals(obj.matrix)) {
      console.log('mesh change', startMatrix, obj);
      const currentNodeId = sceneManager.currentNode?.id;
      if (!currentNodeId) {
        return;
      }
      const res = await sceneManager.addTransformNode(currentNodeId, obj.name, obj.matrix);
      console.log(res);
    }
    startMatrix = null;
  });
}

function clearHighlight() {
  for (let m of Array.from(meshMaterialMap)) {
    m[0].material = m[1];
  }
}

function loadGltf(scene: Scene, src: string): Promise<Group> {
  const loader = new GLTFLoader();

  // Optional: Provide a DRACOLoader instance to decode compressed mesh data
  // const dracoLoader = new DRACOLoader();
  // dracoLoader.setDecoderPath('/examples/js/libs/draco/');
  // loader.setDRACOLoader(dracoLoader);

  // Load a glTF resource
  return new Promise((resolve, reject) => {
    loader.load(
      // resource URL
      src,
      // called when the resource is loaded
      function (gltf) {
        console.log(gltf);

        const bbox3 = new Box3();
        const center = new Vector3();
        bbox3.setFromObject(gltf.scene);
        bbox3.getCenter(center);
        gltf.scene.position.set(-center.x, -center.y, -center.z);
        // scene.add(gltf.scene);
        resolve(gltf.scene);
      },
      // called while loading is progressing
      function (xhr) {

        const loaded = xhr.loaded / xhr.total

        if (loaded === 1) {

          console.log('model loaded');

        }

      },
      // called when loading has errors
      function (error) {
        reject(error);
        console.log('An error happened');

      }
    );
  })
}