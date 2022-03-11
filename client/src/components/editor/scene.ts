import { SceneInfo } from './index';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { Box3, Scene, Vector3, Vector2, Raycaster, Group, Object3D, Intersection, Mesh, Material, MeshBasicMaterial, Color, Matrix4, BufferGeometry, MeshStandardMaterial, BoxHelper, Box3Helper, FrontSide, SphereBufferGeometry, Texture, BoxBufferGeometry, PlaneBufferGeometry, DoubleSide, ConeBufferGeometry } from 'three';
import EventEmitter from 'events';
import { CustomTransformControls } from '../Scene/CustomTransformControls';
import { FlyOrbitControls } from '../Scene/FlyOrbitControls';
import { customMouseEvent } from '../Scene/customMouseEvent';
import { sceneManager } from '../api/scene';
import { Octree } from './utils/Octree';
import { SimplifyModifier } from './utils/SimplifyModifier';
import { SimplifyModifier as SimplifyModifierOrigin } from './utils/SimplifyModifierOrigin';
import simplifyMesh from './utils/SimplifyModifierTexture';
import { saveToLocal, TilesGenerator } from './utils/gen3dtiles';
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree, SplitStrategy, SAH, CENTER, AVERAGE } from 'three-mesh-bvh';
import { MeshBVHVisualizer } from './utils/MeshBVHVisializer';
import { createMeshEdge, GeometryOperator, GeoStaticUtils, mergeMeshesInGroup, refitMeshEdge } from './utils/GeometryUtils';
import { debounce, normalizeMousePosition } from './utils/common';
import { SubdivisionModifier } from './utils/SubdivisionModifier';
import { createBrushHelper, performStroke, StrokeParameter } from './utils/sculptTools';
import customKeyboardEvent from './utils/inputEvent';
import { observe, SceneSetting, sceneSettings, TextureType } from './settings';
import { createPaintBrushMesh, getLastMaterial, performPaint, performPaintOnPoint } from './utils/drawTools';
import { getTrianglesHighlightMesh, updateHighlightTriangle } from './utils/Highlight';
import { getCanvas, isCanvas } from './utils/canvas';
import { MaterialStaticUtils } from './utils/MaterialUtils';
import { disableShadow, enableShadow, raycastMesh } from './utils/SceneUtils';
import { loadFile } from './utils/Files';
import { sceneStorage } from './store';
import { SelectionBoxHelper } from './utils/SelectBoxHelper';
import { rectCast } from './utils/rectCast';
import { CSG } from 'three-csg-ts';
import { exportGLTF } from './utils/exporter';
import { createBaseMapPlane } from './utils/baseMap';

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

const selectedMeshRef: { current: undefined | Mesh } = { current: undefined };
const selectedMeshSet: Set<Mesh> = new Set();
const selectedTriSet: Set<number> = new Set();

const raycaster = new Raycaster();

export async function scene(si: SceneInfo) {
  const { camera, scene, renderer } = si;


  observe(() => sceneSettings.currentTool, (o, n) => {

    let currentTool = sceneSettings.currentTool;

    if (currentTool === 'edit' && sceneSettings.edit.type === 'sculpt') {

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

      if (selectedMeshRef.current) {

        let addFaceIndices

        let newGeo: BufferGeometry;
        if (sceneSettings.edit.simpleSubdivision) {

          const go = new GeometryOperator(selectedMeshRef.current.geometry);
          if (selectedTriSet.size) {

            addFaceIndices = go.simpleSubdivision(Array.from(selectedTriSet));

          } else {

            go.simpleSubdivision();

          }
          newGeo = go.rebuild();

        } else {

          newGeo = subdivisionModifier.modify(selectedMeshRef.current.geometry);

        }
        selectedMeshRef.current.geometry = newGeo;

        selectedMeshRef.current.geometry.boundsTree = new MeshBVH(newGeo, { strategy: CENTER });

        selectedTriSet.clear();

        trianglesHighlightHelper.clear();

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

  observe(() => sceneSettings.action.unionGeometries, (o, n) => {
    if (o !== n) {
      if (selectedMeshSet.size > 1) {
        const meshes = Array.from(selectedMeshSet).filter(m => m.geometry.getAttribute('position'));
        const newMesh = CSG.union(meshes[0], meshes[1]);
        MaterialStaticUtils.getAllMaterial(newMesh).forEach(m => {
          if (m instanceof MeshStandardMaterial) {
            m.flatShading = true;
          }
        });
        const translateMatrix = new Matrix4().makeTranslation(0, 1, 0);
        newMesh.applyMatrix4(translateMatrix);
        group.add(newMesh);
        octree.add(newMesh);
      }
    }
  });

  observe(() => sceneSettings.action.intersectGeometries, (o, n) => {
    if (o !== n) {
      if (selectedMeshSet.size) {
        if (selectedMeshSet.size > 1) {
          const meshes = Array.from(selectedMeshSet).filter(m => m.geometry.getAttribute('position'));
          const newMesh = CSG.intersect(meshes[0], meshes[1]);
          MaterialStaticUtils.getAllMaterial(newMesh).forEach(m => {
            if (m instanceof MeshStandardMaterial) {
              m.flatShading = true;
            }
          });
          const translateMatrix = new Matrix4().makeTranslation(0, 1, 0);
          newMesh.applyMatrix4(translateMatrix);
          group.add(newMesh);
          octree.add(newMesh);
        }
      }
    }
  });

  observe(() => sceneSettings.action.extractFaces, (o, n) => {
    if (o !== n) {
      if (selectedMeshRef.current && selectedTriSet.size) {
        const go = new GeometryOperator(selectedMeshRef.current.geometry);
        const newMesh = selectedMeshRef.current.clone();
        go.selectFaces(Array.from(selectedTriSet));
        newMesh.geometry = go.rebuild();
        selectedMeshRef.current.updateMatrixWorld();
        selectedMeshRef.current.matrixWorld.decompose(newMesh.position, newMesh.quaternion, newMesh.scale);
        GeoStaticUtils.reCenterVertices(newMesh);
        const translateMatrix = new Matrix4().makeTranslation(0, 1, 0);
        newMesh.applyMatrix4(translateMatrix);
        octree.add(newMesh);
        group.add(newMesh);
      }
    }
  });

  observe(() => sceneSettings.global.simplification, (o, n) => {
    if (o !== n) {
      if (selectedMeshRef.current) {
        const newGeo = simplifyMesh(selectedMeshRef.current.geometry, 0.1, true);
        selectedMeshRef.current.geometry = newGeo;
        updateBVHHelper();
        updateMeshEdge();
      }
    }
  });

  observe(() => sceneSettings.scene.showBaseMap, () => {
    if (sceneSettings.scene.showBaseMap) {
      let baseMapPlane = createBaseMapPlane(sceneSettings.scene.baseMapCenterLng, sceneSettings.scene.baseMapCenterLat, 18);
      baseMapGroup.add(baseMapPlane);
    } else {
      baseMapGroup.clear();
    }
  });

  observe(() => sceneSettings.global.meshEdgeDepthTest, (o, n) => {
    if (o !== n) {
      if (selectedMeshRef.current) {
        updateMeshEdge();
      }
    }
  });

  observe(() => sceneSettings.action.recomputeCenter, (o, n) => {
    if (o !== n) {
      if (selectedMeshRef.current) {
        GeoStaticUtils.reCenterVertices(selectedMeshRef.current);
        transformControl.detach();
        boxHelperGroup.clear();
        bvhHelperGroup.clear();
        meshEdgeHelperGroup.clear();
        octree.remove(selectedMeshRef.current);
        octree.add(selectedMeshRef.current);
        selectedMeshRef.current = undefined;
      }
    }
  });

  observe(() => sceneSettings.action.importModel, async (o, n) => {
    const file = await loadFile('.glb');
    const url = URL.createObjectURL(file);
    const model = await loadGltf(scene, url);
    model.traverse(obj => {
      if (obj instanceof Mesh) {
        octree.add(obj);
      }
    });
    group.add(model);
  });

  observe(() => sceneSettings.action.loadTexturesInScene, async (o, n) => {
    await MaterialStaticUtils.collectTextures(group);
  });

  observe(() => sceneSettings.action.deleteGeometry, async (o, n) => {
    if (selectedMeshRef.current) {
      octree.remove(selectedMeshRef.current);
      selectedMeshRef.current.parent?.remove(selectedMeshRef.current);
      selectedMeshRef.current = undefined;
      boxHelperGroup.clear();
      bvhHelperGroup.clear();
      meshEdgeHelperGroup.clear();
      transformControl.detach();
    }
    if (selectedMeshSet.size) {
      selectedMeshSet.forEach(mesh => {
        octree.remove(mesh);
        mesh.parent?.remove(mesh);
        boxHelperGroup.clear();
        bvhHelperGroup.clear();
        meshEdgeHelperGroup.clear();
        transformControl.detach();
      });
    }
  });

  observe(() => sceneSettings.action.mergeGeometries, async (o, n) => {
    if (selectedMeshSet.size) {
      const newMesh = GeoStaticUtils.mergeMeshes(Array.from(selectedMeshSet));
      const sizeVector = new Vector3(1, 0, 0);
      newMesh.geometry.boundingBox?.getSize(sizeVector)
      const translateMatrix = new Matrix4().makeTranslation(sizeVector.x, 0, 0);
      newMesh.applyMatrix4(translateMatrix);
      octree.add(newMesh);
      group.add(newMesh);
    }
  });

  observe(() => sceneSettings.action.dulplicateMesh, async (o, n) => {
    dulplicateMesh();
  });

  observe(() => sceneSettings.action.createGeometry, async (o, n) => {

    function updatePosition(mesh: Mesh) {
      const position = new Vector3();
      const direction = new Vector3();

      camera.getWorldDirection(direction);
      camera.getWorldPosition(position);
      position.add(direction.multiplyScalar(10));
      mesh.position.copy(position);
    }
    const material = new MeshStandardMaterial({ flatShading: false });
    const mesh = new Mesh(undefined, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    updatePosition(mesh);

    if (sceneSettings.action.createGeometry === 'sphere') {
      const sphere = new SphereBufferGeometry(2, 20, 20);
      mesh.geometry = sphere;
    } else if (sceneSettings.action.createGeometry === 'box') {
      const box = new BoxBufferGeometry(2, 2, 2, 5, 5);
      mesh.geometry = box;
    } else if (sceneSettings.action.createGeometry === 'plane') {
      const plane = new PlaneBufferGeometry(20, 20, 20, 20);
      material.side = DoubleSide;
      mesh.geometry = plane;
      mesh.rotateX(-0.5 * Math.PI);
      mesh.updateMatrixWorld();
    } else if (sceneSettings.action.createGeometry === 'cone') {
      const cone = new ConeBufferGeometry(2, 5, 20, 20);
      material.side = DoubleSide;
      mesh.geometry = cone;
      mesh.updateMatrixWorld();
    }

    octree.add(mesh);
    group.add(mesh);

  });

  observe(() => { let { x, y, z } = sceneSettings.transform }, async (o, n) => {
    if (selectedMeshRef.current && !transforming) {
      const { x, y, z, type } = sceneSettings.transform;
      selectedMeshRef.current.position.set(x, y, z);
      refitMeshEdge();
      transformControl.setMode(type);
    }
  });

  observe(() => { let _ = sceneSettings.transform.type }, async (o, n) => {
    if (selectedMeshRef.current && !transforming) {
      const type = sceneSettings.transform.type;
      transformControl.setMode(type);
      refitMeshEdge();
    }
  });

  observe(() => {
    let { roughness, metalness } = sceneSettings.paint
  }, async (o, n) => {
    if (selectedMeshRef.current) {
      let { roughness, metalness } = sceneSettings.paint
      const material = MaterialStaticUtils.getAllMaterial(selectedMeshRef.current);
      for (let m of material) {
        if (m instanceof MeshStandardMaterial) {
          m.metalness = metalness;
          m.roughness = roughness;
        }
      }
    }
  });

  observe(() => {
    let _ = sceneSettings.action.exportSceneToGltf
  }, async (o, n) => {
    exportGLTF(group);
  });

  observe(() => {
    let _ = sceneSettings.action.exportSelectedToGltf
  }, async (o, n) => {
    if (selectedMeshRef.current) {
      exportGLTF(selectedMeshRef.current);
    }
  });

  observe(() => {
    let _ = sceneSettings.action.clearAllTexture
  }, async (o, n) => {
    if (selectedMeshRef.current) {
      const materials = MaterialStaticUtils.getAllMaterial(selectedMeshRef.current);
      for (let m of materials) {
        const cvs = getCanvas(10, 10, false, true, 0xdddddd);
        const imageBitMap = await createImageBitmap(cvs);
        m.map && (m.map.image = imageBitMap);
        m.map && (m.map.needsUpdate = true);
        m.aoMap = null;
        if (m instanceof MeshStandardMaterial) {
          m.normalMap = null;
          m.roughnessMap = null;
          m.metalnessMap = null;
          m.displacementMap = null;
        }
        m.needsUpdate = true;
      }
    }
  });

  observe(() => sceneSettings.action.applyTexture, async (o, n) => {
    if (!selectedMeshRef.current) {

      return;

    }

    let material = MaterialStaticUtils.getFirstMaterial(selectedMeshRef.current);
    const textureImg = await sceneStorage.getTextureImage(sceneSettings.action.applyTexture);
    const texture = sceneStorage.getTexture(sceneSettings.action.applyTexture);

    if (!material) {

      material = selectedMeshRef.current.material = new MeshStandardMaterial();

    }

    if (!material.map) {

      const m = MaterialStaticUtils.getFirstMaterial(selectedMeshRef.current);
      material.map = new Texture();
      material.needsUpdate = true;

    }

    if (texture && textureImg) {

      const { naturalWidth: w, naturalHeight: h } = textureImg;

      const cvs = getCanvas(w, h);
      const ctx = cvs.getContext('2d');

      if (ctx) {

        ctx.drawImage(textureImg, 0, 0, w, h);

        const imgBitMap = await createImageBitmap(cvs);

        let mList = MaterialStaticUtils.getAllMaterial(selectedMeshRef.current);


        if (selectedTriSet.size) {

          const go = new GeometryOperator(selectedMeshRef.current.geometry);
          const originMaterialIndex = go.extractFacesToGroup(Array.from(selectedTriSet));
          selectedMeshRef.current.geometry = go.rebuild();
          if (!Array.isArray(selectedMeshRef.current.material)) {
            selectedMeshRef.current.material = [selectedMeshRef.current.material as MeshStandardMaterial];
          }
          const m = (selectedMeshRef.current.material as MeshStandardMaterial[])[originMaterialIndex];
          const newMaterial = m.clone();
          m.map && (newMaterial.map = m.map?.clone());
          selectedMeshRef.current.material.push(newMaterial);
          mList = [newMaterial];

        }

        if (texture.type === 'albedo') {

          for (let m of mList) {

            const t = m.map;
  
            if (t) {
              t.image = imgBitMap;
              t.needsUpdate = true;
            }

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

        } else if (texture.type === TextureType.roughness) {

          for (let m of mList) {

            if (m instanceof MeshStandardMaterial) {

              const roughnessMap = m.map?.clone() || new Texture();

              roughnessMap.image = imgBitMap;

              roughnessMap.needsUpdate = true;

              m.roughnessMap = roughnessMap;

              m.needsUpdate = true;

            }

          }

        } else if (texture.type === TextureType.ao) {

          for (let m of mList) {

            if (m instanceof MeshStandardMaterial) {

              const aoMap = m.map?.clone() || new Texture();

              aoMap.image = imgBitMap;

              aoMap.needsUpdate = true;

              m.aoMap = aoMap;

              m.needsUpdate = true;

            }

          }

        } else if (texture.type === TextureType.metalness) {

          for (let m of mList) {

            if (m instanceof MeshStandardMaterial) {

              const metalnessMap = m.map?.clone() || new Texture();

              metalnessMap.image = imgBitMap;

              metalnessMap.needsUpdate = true;

              m.metalnessMap = metalnessMap;

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
      (bvhHelperGroup.children[0] as any).depth = BVHHelperDepth;
      (bvhHelperGroup.children[0] as any).update();
    }

  });

  let helperGroup = new Group();
  let meshEdgeHelperGroup = new Group();
  let bvhHelperGroup = new Group();
  let baseMapGroup = new Group();
  let brushHelper = createBrushHelper();
  let paintBrushHelper = createPaintBrushMesh();
  let trianglesHighlightHelper = new Group();

  if (sceneSettings.scene.showBaseMap) {

    let baseMapPlane = createBaseMapPlane(sceneSettings.scene.baseMapCenterLng, sceneSettings.scene.baseMapCenterLat, 18);
    baseMapGroup.add(baseMapPlane);

  }

  trianglesHighlightHelper.add(getTrianglesHighlightMesh());
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
  helperGroup.add(trianglesHighlightHelper);
  helperGroup.add(baseMapGroup);

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

  octree.helperGroup.visible = sceneSettings.global.showOctreeHelper;

  const tilesGenerator = new TilesGenerator();

  const subdivisionModifier = new SubdivisionModifier(1);

  const selectBoxHelper = SelectionBoxHelper.getinstance(renderer.domElement, 'selection-box-helper');

  function renderLoop() {
    requestAnimationFrame(renderLoop);
    renderer.render(scene, camera);
    flyOrbitControls.update();
    octree.update();
    camera.updateMatrixWorld();
    renderEvent.emit('render');
  }

  const flyOrbitControls = new FlyOrbitControls(camera, renderer.domElement);

  (window as any).fc = flyOrbitControls;

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

  transformControl.setMode(sceneSettings.transform.type);
  onTransform(transformControl, octree);

  scene.add(transformControl);


  function dulplicateMesh() {

    const translateMatrix = new Matrix4().makeTranslation(0, 0, 5);

    if (selectedMeshSet.size) {

      selectedMeshSet.forEach(mesh => {

        dulplicate(mesh);

      });

    } else if (selectedMeshRef.current) {

      dulplicate(selectedMeshRef.current);

    }

    function dulplicate(mesh: Mesh) {
      const newMesh = mesh.clone();
      mesh.updateMatrixWorld();
      mesh.matrixWorld.decompose(newMesh.position, newMesh.quaternion, newMesh.scale);
      newMesh.applyMatrix4(translateMatrix);

      octree.add(newMesh);
      group.add(newMesh);
    }

  }

  function updateMeshEdge() {

    if (selectedMeshRef.current && sceneSettings.global.showMeshEdge) {

      meshEdgeHelperGroup.clear();
      meshEdgeHelperGroup.add(createMeshEdge(selectedMeshRef.current, sceneSettings.global.meshEdgeDepthTest));

    }

  }

  function updateTrianglesHelper() {

    if (selectedMeshRef.current && selectedTriSet.size > 0) {

      const mesh = updateHighlightTriangle(selectedMeshRef.current, selectedTriSet);
      trianglesHighlightHelper.clear();
      trianglesHighlightHelper.add(mesh);

    }

  }

  function updateBVHHelper(refit = false) {

    if (!selectedMeshRef.current?.geometry.boundsTree || !sceneSettings.global.showBVHHelper) return;

    if (refit) {

      if (bvhHelperGroup.children[0]) {

        (bvhHelperGroup.children[0] as any).update();

      }
      return;

    }

    const bvhVisualizer = new MeshBVHVisualizer(selectedMeshRef.current, sceneSettings.global.BVHHelperDepth);

    bvhVisualizer.opacity = 0.8;
    bvhVisualizer.depth = sceneSettings.global.BVHHelperDepth;

    bvhVisualizer.name = 'bvhVisualizer';

    bvhHelperGroup.clear();

    bvhHelperGroup.add(bvhVisualizer);

    selectedMeshRef.current.updateMatrixWorld();
    // selectedMeshRef.current.matrixWorld.decompose(bvhHelperGroup.position, bvhHelperGroup.quaternion, bvhHelperGroup.scale);
    bvhHelperGroup.updateMatrixWorld();

    console.log(bvhVisualizer)

  }

  function updateBoundingBox(force = true) {

    boxHelperGroup.clear();

    if (selectedMeshSet.size) {

      selectedMeshSet.forEach((mesh) => {

        if (force || !mesh.geometry.boundingBox) {

          mesh.geometry.computeBoundingBox();

        }

        const bbox = mesh.geometry.boundingBox?.clone().applyMatrix4(mesh.matrixWorld);

        if (!bbox) return;

        const boxHelper = new Box3Helper(bbox, new Color('blue'));
        boxHelperGroup.add(boxHelper);

      });

      return;

    }

    if (!sceneSettings.global.showBoundingBox) {

      return;

    }

    if (selectedMeshRef.current) {

      const mesh = selectedMeshRef.current;

      if (force || !mesh.geometry.boundingBox) {

        mesh.geometry.computeBoundingBox();

      }

      const bbox = mesh.geometry.boundingBox?.clone().applyMatrix4(mesh.matrixWorld);

      if (!bbox) return;

      const boxHelper = new Box3Helper(bbox, new Color('blue'));

      boxHelperGroup.add(boxHelper);

    }

  }

  const updateTransformInfo = debounce(() => {

    if (selectedMeshRef.current) {
      transforming = true;
      const { x, y, z } = selectedMeshRef.current.position;
      sceneSettings.transform.x = x;
      sceneSettings.transform.y = y;
      sceneSettings.transform.z = z;
      transforming = false;
    }

  }, 50);

  let transforming = false;

  transformControl.addEventListener('mouseDown', (e) => {

    flyOrbitControls.enabled = false;
    transforming = true;

  });

  transformControl.addEventListener('mouseUp', (e) => {

    flyOrbitControls.enabled = true;
    transforming = false;
    updateMeshEdge();
    updateBoundingBox();

  });

  transformControl.addEventListener('objectChange', (e) => {

    updateTransformInfo();

  });

  renderEvent.on('render', () => {

    if (sceneSettings.currentTool === 'edit' && sceneSettings.edit.type === 'sculpt') {

      brushHelper.scale.set(sceneSettings.sculpt.size, sceneSettings.sculpt.size, sceneSettings.sculpt.size);

    }

    if (sceneSettings.currentTool === 'paint') {

      paintBrushHelper.scale.set(sceneSettings.paint.size, sceneSettings.paint.size, sceneSettings.paint.size);

    }

  });

  customKeyboardEvent.onWheel(e => {

    if (customKeyboardEvent.ctrl) {

      if (sceneSettings.currentTool === 'edit' && sceneSettings.edit.type === 'sculpt') {

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

  customKeyboardEvent.onKey('v',
    (e) => {
      if (customKeyboardEvent.ctrl || customKeyboardEvent.meta) {
        dulplicateMesh();
      }
    }
  );

  customKeyboardEvent.onKey('Backspace',
    (e) => {
      sceneSettings.action.deleteGeometry++;
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

  customKeyboardEvent.onKey('Alt', (e) => {
    selectBoxHelper.enabled = true;
    transformControl.enabled = false;
    flyOrbitControls.enabled = false;
  }, (e) => {
    selectBoxHelper.enabled = false;
    transformControl.enabled = true;
    flyOrbitControls.enabled = true;
  })

  let shouldDetach = false;
  customKeyboardEvent.onKey('t', (e) => {
    updateSeletedMesh(lastMousePos.x, lastMousePos.y);
    if (selectedMeshRef.current) {
      sceneSettings.transform.type = 'translate';
      transformControl.detach();
      transformControl.attach(selectedMeshRef.current);
      shouldDetach = true;
    }
  });

  customKeyboardEvent.onKey('r', (e) => {
    updateSeletedMesh(lastMousePos.x, lastMousePos.y);
    if (selectedMeshRef.current) {
      sceneSettings.transform.type = 'rotate';
      transformControl.detach();
      transformControl.attach(selectedMeshRef.current);
      shouldDetach = true;
    }
  });

  customKeyboardEvent.onKey('g', (e) => {
    updateSeletedMesh(lastMousePos.x, lastMousePos.y);
    if (selectedMeshRef.current) {
      sceneSettings.transform.type = 'scale';
      transformControl.detach();
      transformControl.attach(selectedMeshRef.current);
      shouldDetach = true;
    }
  });

  customKeyboardEvent.onKey('Escape', (e) => {
    if (selectedMeshRef.current) {
      transformControl.detach();
      selectedMeshRef.current = undefined;
      bvhHelperGroup.clear();
      boxHelperGroup.clear();
      meshEdgeHelperGroup.clear();
    }
  });

  customMouseEvent.onMouseUp(() => {
    if (shouldDetach) {
      shouldDetach = false;
      transformControl.detach();
    }
  })

  let lastMousePos = new Vector2();

  customMouseEvent.onMousemove((e) => {

    lastMousePos.x = e.clientX;
    lastMousePos.y = e.clientY;

    if (sceneSettings.scene.liveSelect) {

      updateSeletedMesh(e.clientX, e.clientY);

    }

    if (customKeyboardEvent.alt && customMouseEvent.mousedown) {

      const startPoint = new Vector3(selectBoxHelper.startPoint.x, selectBoxHelper.startPoint.y, 0.5);
      const endPoint = new Vector3(e.clientX, e.clientY, 0.5);

      normalizeMousePosition(startPoint);
      normalizeMousePosition(endPoint);

      const collection = rectCast(camera, startPoint, endPoint, group);

      if (!customKeyboardEvent.ctrl) {

        selectedMeshSet.clear();

      }

      for (let mesh of collection) {

        selectedMeshSet.add(mesh);

      }

      selectedMeshRef.current = undefined;

      updateBoundingBox();

      return;

    }

    const boundsTree = selectedMeshRef.current?.geometry.boundsTree;

    if (sceneSettings.currentTool === 'edit' || sceneSettings.currentTool === 'paint') {

      if (boundsTree && selectedMeshRef.current) {

        const { clientX: x, clientY: y } = e;

        let mouse = new Vector2(x, y);

        mouse = normalizeMousePosition(mouse);

        raycaster.setFromCamera(mouse, camera);

        const invMat = new Matrix4();

        invMat.copy(selectedMeshRef.current.matrixWorld).invert();

        const ray = raycaster.ray.clone();

        ray.applyMatrix4(invMat);

        const hit = boundsTree.raycast(ray, FrontSide);

        if (hit.length) {

          if (sceneSettings.currentTool === 'edit') {

            brushHelper.visible = true;

            hit.sort((a, b) => a.distance - b.distance);

            const hitFirst = hit[0];

            const faceIndex = hitFirst.faceIndex;

            _v0.copy(hitFirst.point).applyMatrix4(selectedMeshRef.current.matrixWorld);

            brushHelper.position.copy(_v0);

            if (customMouseEvent.mouseLeftDown && customKeyboardEvent.ctrl) {

              const changedTriangles = new Set();
              const changedIndices = new Set();
              const traversedNodeIndices = new Set();
              const sets = {

                accumulatedTriangles: changedTriangles,
                accumulatedIndices: changedIndices,
                accumulatedTraversedNodeIndices: traversedNodeIndices,

              };

              performStroke(boundsTree, _v0, selectedMeshRef.current, brushHelper, false, sets, sceneSettings.sculpt);

              meshEdgeHelperGroup.clear();
              updateMeshEdge();
              updateBVHHelper(true);

            } else {

              performStroke(boundsTree, _v0, selectedMeshRef.current, brushHelper, true, {}, sceneSettings.sculpt);

              if (customMouseEvent.mouseRightDown && customKeyboardEvent.ctrl) {

                faceIndex !== undefined && selectedTriSet.add(faceIndex);

                updateTrianglesHelper();

              }

            }

          } else if (sceneSettings.currentTool === 'paint') {

            paintBrushHelper.visible = true;

            hit.sort((a, b) => a.distance - b.distance);

            const hitFirst = hit[0];

            _v0.copy(hitFirst.point).applyMatrix4(selectedMeshRef.current.matrixWorld);

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

                performPaint(boundsTree, _v0, selectedMeshRef.current, paintBrushHelper, sceneSettings.paint);

              } else if (face) {

                performPaintOnPoint(_v0, face, selectedMeshRef.current, sceneSettings.paint);

              }

            }

          }

        }

      }

    }

  });

  function updateSeletedMesh(x: number, y: number) {

    if (selectedMeshSet.size) {

      selectedMeshSet.clear();

      updateBoundingBox();

    }

    if (selectedTriSet.size) {

      selectedTriSet.clear();
      trianglesHighlightHelper.clear();

    }

    let mouse = new Vector2(x, y);

    mouse = normalizeMousePosition(mouse);

    raycaster.setFromCamera(mouse, camera);

    const intersects: Intersection[] = [];

    raycaster.intersectObjects([group], true, intersects);

    console.log(intersects);

    intersects.filter(m => m.object instanceof Mesh).sort((a, b) => a.distance - b.distance);

    if (intersects.length) {

      const firstCast = intersects[0].object as Mesh;

      if (firstCast !== selectedMeshRef.current) {

        if (selectedMeshRef.current?.geometry.boundsTree) {

          selectedMeshRef.current.geometry.boundsTree = undefined;

        }

        if (customKeyboardEvent.ctrl) {

          selectedMeshSet.add(firstCast as Mesh);

        } else {

          selectedMeshSet.clear();

        }

        console.log(firstCast);

        selectedMeshRef.current = firstCast;

        selectedMeshRef.current.updateMatrixWorld();

        updateTransformInfo();

        const texture = MaterialStaticUtils.getTexture(selectedMeshRef.current);

        const material = MaterialStaticUtils.getAllMaterial(selectedMeshRef.current);

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

        const boundsTree = new MeshBVH(selectedMeshRef.current.geometry, {
          strategy: CENTER
        });

        selectedMeshRef.current.geometry.boundsTree = boundsTree;

        if (sceneSettings.global.showBVHHelper) {

          updateBVHHelper();

        }

        meshEdgeHelperGroup.clear();
        updateMeshEdge();

        return;

      }

    } else {

      if (selectedMeshRef.current?.geometry.boundsTree) {

        selectedMeshRef.current.geometry.boundsTree = undefined;

      }

      selectedMeshRef.current = undefined;
      transformControl.detach();
      flyOrbitControls.enabled = true;
      brushHelper.visible = false;
      paintBrushHelper.visible = false;
      meshEdgeHelperGroup.clear();
      return;

    }

    const boundsTree = selectedMeshRef.current.geometry.boundsTree;

    if (boundsTree && selectedMeshRef.current) {

      const invMat = new Matrix4();

      invMat.copy(selectedMeshRef.current.matrixWorld).invert();

      const ray = raycaster.ray.clone();

      ray.applyMatrix4(invMat);

      console.time('bvh raycast time');
      const hit = boundsTree.raycast(ray, FrontSide);
      console.timeEnd('bvh raycast time');

      console.log('hit: ', hit);

      if (hit.length) {

        hit.sort((a, b) => a.distance - b.distance);

        const intersection = hit[0];

        if (sceneSettings.currentTool === 'edit') {

          if (intersection.faceIndex && intersection.face) {

            const go = new GeometryOperator(selectedMeshRef.current.geometry);

            if (sceneSettings.edit.type === 'addvertex') {

              go.addVerticeInFace(intersection.faceIndex, intersection.point);

            } else if (sceneSettings.edit.type === 'deletevertex') {

              go.removeAllJointFacesByFaceAndReTriangulation(intersection.faceIndex);

            } else if (sceneSettings.edit.type === 'deleteface') {

              go.removeAllJointFacesByFace(intersection.faceIndex);

            } else if (sceneSettings.edit.type === 'addface') {

              go.addLoopFaceInFace(intersection.faceIndex);

            }

            // go.removeAllJointFacesByFaceVertex(intersection.faceIndex, 0);

            // const meshFace = new MeshFace(face.a, face.b, face.c, _temp);

            const newGeo = go.rebuild();
            selectedMeshRef.current.geometry = newGeo;
            selectedMeshRef.current.geometry.boundsTree = new MeshBVH(newGeo, { strategy: CENTER });

            meshEdgeHelperGroup.clear();

            updateMeshEdge();

            updateBVHHelper();

          }

        } else if (sceneSettings.currentTool === 'move') {

          transformControl.detach();
          transformControl.attach(selectedMeshRef.current);

        }

      }
    }

  }

  customMouseEvent.onClickNoMove((e) => {

    updateSeletedMesh(e.clientX, e.clientY);

  });

  renderLoop();
  // const sceneFile = '3dtiles/gltf_b3dm/rock.gltf';
  // const sceneFile = '3dtiles/gltf_b3dm/trunk.glb';
  // const sceneFile = '3dtiles/gltf_b3dm/po1.glb';
  // const sceneFile = '3dtiles/gltf_b3dm/mountain1.glb';
  // const sceneFile = '3dtiles/gltf_b3dm/city.glb';
  // const sceneFile = '3dtiles/gltf_b3dm/cottage2.glb';
  // const sceneFile = '3dtiles/gltf_b3dm/model.gltf';
  // const sceneFile = '3dtiles/gltf_b3dm/l22_1910.glb';
  // const sceneFile = '3dtiles/gltf_b3dm/l23_402.glb';
  // const sceneFile = '3dtiles/gltf_b3dm/lod17.glb';
  // const sceneFile = '3dtiles/gltf_b3dm/lod17_1.glb';
  const sceneFile = '3dtiles/gltf1/sample.gltf';
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

  // modelMesh.geometry = subdivisionModifier.modify(simGeo);

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
