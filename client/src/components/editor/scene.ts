import { SceneInfo } from './index';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { Box3, Scene, Vector3, Vector2, Raycaster, Group, Object3D, Intersection, Mesh, Material, MeshBasicMaterial, Color, Matrix4, BufferGeometry, MeshStandardMaterial, BoxHelper, Box3Helper, FrontSide, SphereBufferGeometry, Texture, BoxBufferGeometry, PlaneBufferGeometry, DoubleSide, ConeBufferGeometry, RepeatWrapping, Sphere, Quaternion, OrthographicCamera } from 'three';
import EventEmitter from 'events';
import { CustomTransformControls } from '../Scene/CustomTransformControls';
import { FlyOrbitControls } from '../Scene/FlyOrbitControls';
import { customMouseEvent } from '../Scene/customMouseEvent';
import { sceneManager } from '../../api/scene';
import { Octree } from './utils/spatialIndex/Octree';
import { SimplifyModifier } from './utils/modifiers/SimplifyModifier';
import { SimplifyModifier as SimplifyModifierOrigin } from './utils/modifiers/SimplifyModifierOrigin';
import simplifyMesh from './utils/modifiers/SimplifyModifierTexture';
import { saveToLocal, TilesGenerator, initFileSystem } from './utils/exporters/3dtilesExporter';
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree, SplitStrategy, SAH, CENTER, AVERAGE } from 'three-mesh-bvh';
import { MeshBVHVisualizer } from './utils/spatialIndex/MeshBVHVisializer';
import { createBoundaryCylinder, createMeshEdge, GeometryOperator, GeoStaticUtils, getGeometryFacesCount, getGeometryVerticesCount, getIndexArray, mergeMeshesInGroup, refitMeshEdge } from './utils/geometryUtils/GeometryUtils';
import { debounce, nextTick, normalizeMousePosition } from './utils/CommonUtils';
import { SubdivisionModifier } from './utils/modifiers/SubdivisionModifier';
import { createBrushHelper, performStroke, StrokeParameter } from './utils/functions/SculptTools';
import customKeyboardEvent from './utils/events/inputEvent';
import { observe, SceneSetting, sceneSettings, TextureType } from './settings';
import { createPaintBrushMesh, getLastMaterial, performPaint, performPaintOnPoint } from './utils/functions/DrawTools';
import { getTrianglesHighlightMesh, updateHighlightTriangle } from './utils/sceneUtils/Highlight';
import { getCanvas, isCanvas } from './utils/sceneUtils/CanvasUtils';
import { MaterialStaticUtils } from './utils/materialUtils/MaterialUtils';
import { disableShadow, enableShadow, raycastMesh } from './utils/sceneUtils/SceneUtils';
import { loadFile, readFileToString } from './utils/io/Files';
import { sceneStorage } from './store';
import { SelectionBoxHelper } from './utils/selectionHelper/SelectBoxHelper';
import { rectCast } from './utils/selectionHelper/rectCast';
import { CSG } from 'three-csg-ts';
import { exportGLTF } from './utils/exporters/glTFExporter';
import { BaseMap, createBaseMapPlane } from './utils/baseMap/BaseMap';
import { parseGeoJson } from './utils/loaders/GeoJsonLoader';
import { projectFromLonLat } from './utils/baseMap/projections';
import { loadCubeTexture } from './utils/materialUtils/CubeTexture';
import { sceneHistory } from './utils/editHisotry/SceneHistory';
import { fossilDelta } from './utils/editHisotry/FossilDelta';
import { DebugTilesRenderer, TilesRenderer } from '3d-tiles-renderer';
import { update3DTiles } from './utils/versionControl/Update3DTiles';
import { load3DTile } from './utils/loaders/TilesLoader';
import { getAllVersions } from '../../api/vertionControl';

export const renderEvent = new EventEmitter();

const _v0 = new Vector3();
const _m0 = new Matrix4();
const _identityM4 = new Matrix4().identity();

const selectedMeshRef: { current: undefined | Mesh } = { current: undefined };
let copiedMesh: Set<Object3D> = new Set();
let selectedMaterialIndex = 0;
const selectedMeshSet: Set<Mesh> = new Set();
const selectedTriSet: Set<number> = new Set();

(window as any).selectedMeshRef = selectedMeshRef;

const raycaster = new Raycaster();

export async function scene(si: SceneInfo) {
  const { camera, scene, renderer, secondRenderer } = si;
  let clientRect = renderer.domElement.getBoundingClientRect();

  window.addEventListener('resize', () => {
    clientRect = renderer.domElement.getBoundingClientRect();
  });

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

        updateMeshInfo();

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

  observe(() => sceneSettings.action.subtractGeometries, (o, n) => {
    if (o !== n) {
      if (selectedMeshSet.size > 1) {
        const meshes = Array.from(selectedMeshSet).filter(m => m.geometry.getAttribute('position'));
        const newMesh = CSG.subtract(meshes[0], meshes[1]);
        const newMesh1 = CSG.subtract(meshes[1], meshes[0]);
        MaterialStaticUtils.getAllMaterial(newMesh).forEach(m => {
          if (m instanceof MeshStandardMaterial) {
            m.flatShading = true;
          }
        });
        const translateMatrix = new Matrix4().makeTranslation(0, 1, 0);
        newMesh.applyMatrix4(translateMatrix);
        newMesh1.applyMatrix4(translateMatrix);
        addObjectToScene(newMesh);
        addObjectToScene(newMesh1);
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
        addObjectToScene(newMesh);
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
          addObjectToScene(newMesh);
        }
      }
    }
  });

  let enableSceneVersionChange = true;

  observe(() => {
    let _1 = sceneSettings.action.selectScene;
  }, async (o, n) => {
    await reload3DTiles(n);
  });

  observe(() => {
    let _2 = sceneSettings.scene.currentTileVersion;
  }, async () => {

    if (sceneSettings.action.selectScene !== 'None' && enableSceneVersionChange) {

      const version = sceneSettings.scene.currentTileVersion;
      tilesGroup.clear();
      tilesRenderer = load3DTile(
        si,
        `http://127.0.0.1:8999/3dtiles_scene/${sceneSettings.action.selectScene}/tileset${version ? '_' + version : ''}.json`,
        sceneSettings.global.showOctreeHelper
      );
      tilesGroup.add(tilesRenderer.group as any);
    }

  });

  observe(() => sceneSettings.action.commitVersion, async (o, n) => {
    if (o !== n && tilesRenderer && sceneSettings.action.selectScene !== 'None') {
      const versionTag = Date.now().toString(16).substring(5);
      const success = await update3DTiles(sceneSettings.action.selectScene, tilesRenderer, versionTag);
      if (success) {
        sceneSettings.scene.currentTileVersion = versionTag;
        sceneSettings.action.updateVersions += 1;
      }
    }
  });

  observe(() => sceneSettings.action.saveCameraPosition, async (o, n) => {
    camera.updateMatrix();
    camera.updateProjectionMatrix();
    const matrix = camera.matrix;
    sceneSettings.scene.savedCameraMatrix = matrix.toArray();
    flyOrbitControls.saveState();
  });

  observe(() => sceneSettings.action.restoreCameraPosition, async (o, n) => {
    // const matrixArr = sceneSettings.scene.savedCameraMatrix;
    // const matrix = new Matrix4();
    // matrix.fromArray(matrixArr);
    // matrix.decompose(camera.position, camera.quaternion, camera.scale);
    // camera.updateMatrixWorld();
    flyOrbitControls.reset();
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
        addObjectToScene(newMesh);
      }
    }
  });

  observe(() => sceneSettings.global.simplification, (o, n) => {
    if (o !== n) {
      if (selectedMeshRef.current) {
        const simCount = sceneSettings.edit.simplificationVerticesCount;
        // const newGeo = simplifyMesh(selectedMeshRef.current.geometry, 0.1, true);
        const newGeo = simplificationModifier.modify(selectedMeshRef.current.geometry, simCount);
        if (newGeo) {
          selectedMeshRef.current.geometry = newGeo;
          updateBVHHelper();
          updateMeshEdge();
          updateMeshInfo();
        }
      }
    }
  });

  observe(() => sceneSettings.scene.showBaseMap, () => {
    if (sceneSettings.scene.showBaseMap) {
      baseMap.enable = true;
    } else {
      baseMap.enable = false;
    }
  });

  observe(() => sceneSettings.scene.baseMapBrightness, () => {
    if (sceneSettings.scene.showBaseMap) {
      baseMap.brightness = sceneSettings.scene.baseMapBrightness;
    }
  });

  observe(() => sceneSettings.global.meshEdgeDepthTest, (o, n) => {
    if (o !== n) {
      if (selectedMeshRef.current) {
        updateMeshEdge();
      }
    }
  });

  observe(() => {
    let _1 = sceneSettings.scene.baseMapCenterLat;
    let _2 = sceneSettings.scene.baseMapCenterLng;
  }, (o, n) => {
    const { baseMapCenterLat: lat, baseMapCenterLng: lon, baseMapZoomLevel: level } = sceneSettings.scene;
    baseMap.centerLat = lat;
    baseMap.centerLon = lon;
    baseMap.enable = false;
    baseMap.enable = true;
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

  observe(() => sceneSettings.action.saveTo3DTiles, async () => {
    const tilesGenerator = new TilesGenerator();

    tilesGenerator.addEventListener('progress', () => {
      sceneSettings.text.loading = tilesGenerator.finishedObjectCount / tilesGenerator.objectCount;
    });
    sceneSettings.text.loadingText = 'Generating 3D Tiles';
    await initFileSystem();
    await tilesGenerator.gen3dTile(octree);
    sceneSettings.text.loadingText = 'Writing Files';
    await saveToLocal(tilesGenerator.fileList, (finished, total) => {
      sceneSettings.text.loading = finished / total;
    });
    setTimeout(() => {
      sceneSettings.text.loading = -1;
    }, 1000);
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
    const box3 = new Box3();
    box3.setFromObject(model);
    const minY = box3.min.y;
    model.translateY(-minY);
    console.log('import: ', model);
    addObjectToScene(model);
  });

  observe(() => sceneSettings.action.recalFlatUV, async (o, n) => {
    if (selectedMeshRef.current) {
      GeoStaticUtils.recalFlatUV(selectedMeshRef.current.geometry);
    }
  });
  observe(() => sceneSettings.action.importGeoJson, async (o, n) => {
    const file = await loadFile('.json');
    const jsonStr = await readFileToString(file);
    const { baseMapCenterLat: lat, baseMapCenterLng: lon } = sceneSettings.scene;
    const [x, y] = projectFromLonLat(lon, lat);
    const center = new Vector2(x, y);
    const model = parseGeoJson(jsonStr, center);
    addObjectToScene(model, true);
  });

  observe(() => sceneSettings.action.loadTexturesInScene, async (o, n) => {
    await MaterialStaticUtils.collectTextures(group);
  });

  observe(() => sceneSettings.scene.secondCameraWidth, async (o, n) => {
    if (secondRenderer) {
      const w = sceneSettings.scene.secondCameraWidth;
      orCamera.left = -w;
      orCamera.right = w;
      orCamera.top = w;
      orCamera.bottom = -w;
      orCamera.updateProjectionMatrix();
    }
  });

  observe(() => sceneSettings.action.deleteGeometry, async (o, n) => {
    if (selectedMeshRef.current) {
      sceneHistory.addRemoveObject(selectedMeshRef.current, selectedMeshRef.current.parent || group);
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
        sceneHistory.addRemoveObject(mesh, mesh.parent || group);
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
      addObjectToScene(newMesh);
    }
  });

  observe(() => sceneSettings.action.dulplicateMesh, async (o, n) => {
    dulplicateMesh();
  });

  observe(() => sceneSettings.action.createGeometry, async (o, n) => {

    if (!sceneSettings.action.createGeometry) {
      return;
    }

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

    addObjectToScene(mesh);

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
    let meshes: Mesh[] = [];
    if (selectedMeshRef.current) {
      meshes = [selectedMeshRef.current];
    }
    if (selectedMeshSet.size) {
      meshes = Array.from(selectedMeshSet);
    }

    for (let mesh of meshes) {
      let { roughness, metalness } = sceneSettings.paint
      const material = MaterialStaticUtils.getAllMaterial(mesh);
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
    let _ = sceneSettings.action.editBoundary
  }, async (o, n) => {
    if (selectedMeshRef.current) {
      updateBoundaryEditHanlder(selectedMeshRef.current);
    }
  });

  observe(() => {
    let _ = sceneSettings.action.applyEnvMap
  }, async (o, n) => {
    let meshes: Mesh[] = [];
    if (selectedMeshRef.current) {
      meshes = [selectedMeshRef.current];
    }
    if (selectedMeshSet.size) {
      meshes = Array.from(selectedMeshSet);
    }
    let idx = 0;
    sceneSettings.text.loading = 0;
    sceneSettings.text.loadingText = 'applying EnvMap';
    if (meshes?.length) {
      for (let mesh of meshes) {
        const mList = MaterialStaticUtils.getAllMaterial(mesh);
        for (let m of mList) {
          if (m instanceof MeshStandardMaterial) {
            m.envMap = loadCubeTexture(sceneSettings.scene.cubeTextureName);
            m.envMapIntensity = 0.5;
          }
        }
        idx++;
        sceneSettings.text.loading = idx / meshes.length;
        await nextTick();
      }
    }
    setTimeout(() => {
      sceneSettings.text.loading = -1;
    }, 1000);
  });

  observe(() => {
    let _ = sceneSettings.action.convertToPBRMaterial
  }, async (o, n) => {
    if (selectedMeshRef.current) {
      MaterialStaticUtils.convertToStandardMaterial(selectedMeshRef.current);
    }
  });

  observe(() => {
    let _ = sceneSettings.action.highlightEdges
  }, async (o, n) => {
    boxHelperGroup.clear();
    updateMeshEdge(true);
  });

  observe(() => {
    let _ = sceneSettings.action.computeVertexNormal
  }, async (o, n) => {
    if (selectedMeshRef.current) {
      selectedMeshRef.current.geometry.computeVertexNormals();
    }
  });
  observe(() => {
    let _ = sceneSettings.action.clearAllTexture
  }, async (o, n) => {
    let meshes: Mesh[] = [];
    if (selectedMeshRef.current) {
      meshes = [selectedMeshRef.current];
    }
    if (selectedMeshSet.size) {
      meshes = Array.from(selectedMeshSet);
    }
    for (let mesh of meshes) {
      const materials = MaterialStaticUtils.getAllMaterial(mesh);
      if (mesh.material instanceof Material) {
        mesh.material = new MeshStandardMaterial();
      } else {
        for (let i = 0; i < materials.length; i++) {
          mesh.material[i] = new MeshStandardMaterial();
          // const m = materials[i];
          // m.color = new Color(0xffffff);
          // const cvs = getCanvas(512, 512, false, true, 0xdddddd);
          // const imageBitMap = await createImageBitmap(cvs);
          // m.map && (m.map.image = imageBitMap);
          // m.map && (m.map.needsUpdate = true);
          // m.aoMap = null;
          // m.alphaMap = null;
          // if (m instanceof MeshStandardMaterial) {
          //   m.normalMap = null;
          //   m.roughnessMap = null;
          //   m.metalnessMap = null;
          //   m.displacementMap = null;
          //   m.emissiveMap = null;
          //   m.emissive = new Color(0x000000);
          //   m.envMap = null;
          // }
          // m.needsUpdate = true;
        }
      }
    }

  });

  observe(() => sceneSettings.action.applyTexture, async (o, n) => {

    let meshes: Mesh[] = [];

    if (selectedMeshRef.current) {
      meshes = [selectedMeshRef.current];
    }

    if (selectedMeshSet.size) {
      meshes = Array.from(selectedMeshSet);
    }

    if (!meshes.length) {
      return;
    }

    sceneSettings.text.loading = 0;
    sceneSettings.text.loadingText = 'applying Textures...';
    let idx = 0;
    for (let mesh of meshes) {

      sceneHistory.addObject(mesh);
      let material = MaterialStaticUtils.getFirstMaterial(mesh);
      const textureImg = await sceneStorage.getTextureImage(sceneSettings.action.applyTexture);
      const texture = sceneStorage.getTexture(sceneSettings.action.applyTexture);

      if (!material) {

        material = mesh.material = new MeshStandardMaterial();

      }

      if (!material.map) {

        const m = MaterialStaticUtils.getFirstMaterial(mesh);
        material.map = new Texture(undefined, undefined, RepeatWrapping, RepeatWrapping);
        material.needsUpdate = true;

      }

      if (texture && textureImg) {

        const { naturalWidth: w, naturalHeight: h } = textureImg;

        const cvs = getCanvas(w, h);
        const ctx = cvs.getContext('2d');

        if (ctx) {

          ctx.drawImage(textureImg, 0, 0, w, h);

          const imgBitMap = await createImageBitmap(cvs);

          let mList = MaterialStaticUtils.getAllMaterial(mesh);


          if (selectedTriSet.size) {

            const go = new GeometryOperator(mesh.geometry);
            const originMaterialIndex = go.extractFacesToGroup(Array.from(selectedTriSet));
            mesh.geometry = go.rebuild();
            if (!Array.isArray(mesh.material)) {
              mesh.material = [mesh.material as MeshStandardMaterial];
            }
            const m = (mesh.material as MeshStandardMaterial[])[originMaterialIndex];
            const newMaterial = m.clone();
            m.map && (newMaterial.map = m.map?.clone());
            mesh.material.push(newMaterial);
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

          } else if (texture.type === TextureType.emissive) {

            for (let m of mList) {

              if (m instanceof MeshStandardMaterial) {

                const emissiveMap = m.map?.clone() || new Texture();

                emissiveMap.image = imgBitMap;

                emissiveMap.needsUpdate = true;

                m.emissiveMap = emissiveMap;

                m.emissive = new Color(0xffffff);

                m.needsUpdate = true;

              }

            }

          } else if (texture.type === TextureType.alpha) {

            for (let m of mList) {

              if (m instanceof MeshStandardMaterial) {

                const alphaMap = m.map?.clone() || new Texture();

                alphaMap.image = imgBitMap;

                alphaMap.needsUpdate = true;

                m.alphaMap = alphaMap;

                m.transparent = true;

                m.needsUpdate = true;

              }

            }

          }

        }

      }

      idx++
      sceneSettings.text.loading = idx / meshes.length;
      await nextTick();

    }

    setTimeout(() => {
      sceneSettings.text.loading = -1;
    }, 1000);

  });

  observe(() => {
    let _ = sceneSettings.global.showOctreeHelper;
  }, async (o, n) => {

    await reload3DTiles(sceneSettings.action.selectScene);

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
  let verticesEditHelper = new Group();
  let brushHelper = createBrushHelper();
  let paintBrushHelper = createPaintBrushMesh();
  let baseMap = new BaseMap(
    camera,
    sceneSettings.scene.baseMapCenterLng,
    sceneSettings.scene.baseMapCenterLat,
    sceneSettings.scene.baseMapZoomLevel,
    sceneSettings.scene.showBaseMap
  );
  let trianglesHighlightHelper = new Group();

  baseMap.brightness = sceneSettings.scene.baseMapBrightness;

  if (sceneSettings.scene.showBaseMap) {

    baseMap.enable = true;

  }

  baseMapGroup.add(baseMap);


  trianglesHighlightHelper.add(getTrianglesHighlightMesh());
  let boxHelperGroup = new Group();
  brushHelper.visible = false;
  paintBrushHelper.visible = false;

  const group = new Group();
  group.add(verticesEditHelper);

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
    objectsThreshold: 50,
    // percent between 0 and 1 that nodes will overlap each other
    // helps insert objects that lie over more than one node
    radius: 10,
    overlapPct: 0,
    scene,
  });


  function removeObjectFromScene(obj: Object3D) {

    octree.remove(obj);
    obj.parent?.remove(obj);

  }

  octree.helperGroup.visible = sceneSettings.global.showOctreeHelper;

  const subdivisionModifier = new SubdivisionModifier(1);
  const simplificationModifier = new SimplifyModifier();

  const selectBoxHelper = SelectionBoxHelper.getinstance(renderer.domElement, 'selection-box-helper');

  const secondCameraWidth = sceneSettings.scene.secondCameraWidth;
  let orCamera = new OrthographicCamera(-secondCameraWidth, secondCameraWidth, secondCameraWidth, -secondCameraWidth, 1, 6000);
  orCamera.position.set(0, 1000, 0);
  orCamera.lookAt(0, 0, 0);

  const renderLoop = secondRenderer ?
    () => {
      requestAnimationFrame(renderLoop);
      renderer.render(scene, camera);
      secondRenderer.render(scene, orCamera);
      flyOrbitControls.update();
      octree.update();
      camera.updateMatrixWorld();
      renderEvent.emit('render');
    }
    : () => {
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

  scene.add(transformControl);

  async function reload3DTiles(sceneName: string) {
    if (sceneName !== 'None') {
      enableSceneVersionChange = false;
      const versions = await getAllVersions(sceneSettings.action.selectScene);
      let version = sceneSettings.scene.currentTileVersion;
      if (!versions.nodes.find(v => v.tagName === version)) {
        const newVersion = versions.nodes[versions.nodes.length - 1];
        sceneSettings.scene.currentTileVersion = newVersion.tagName;
      }
      version = sceneSettings.scene.currentTileVersion;
      enableSceneVersionChange = true;
      tilesGroup.clear();
      tilesRenderer = load3DTile(
        si,
        `http://127.0.0.1:8999/3dtiles_scene/${sceneSettings.action.selectScene}/tileset${version ? '_' + version : ''}.json`,
        sceneSettings.global.showOctreeHelper
      );
      tilesGroup.add(tilesRenderer.group as any);
    } else {
      tilesGroup.clear();
      tilesRenderer = null;
    }
  }

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

      addObjectToScene(newMesh);
    }

  }

  function addObjectToScene(obj: Object3D, recursive = false, recursiveInsertHisotry = false) {
    if (recursive) {
      const add = (obj: Object3D, parent: Object3D) => {
        obj = obj.clone();
        obj.applyMatrix4(parent.matrixWorld);
        if (obj instanceof Mesh) {
          octree.add(obj);
          obj.receiveShadow = sceneSettings.scene.castShadow;
          obj.castShadow = sceneSettings.scene.castShadow;
          group.add(obj);
          if (recursiveInsertHisotry) {
            sceneHistory.addInsertObject(obj, group);
          }
        }
        for (let child of obj.children) {
          add(child, obj);
        }
      }

      add(obj, group);
      if (!recursiveInsertHisotry) {
        sceneHistory.addInsertObject(obj, group);
      }
    } else {
      obj.receiveShadow = sceneSettings.scene.castShadow;
      obj.castShadow = sceneSettings.scene.castShadow;
      octree.add(obj);
      group.add(obj);
      sceneHistory.addInsertObject(obj, group);
    }
  }

  function copyMesh(mesh: Object3D, cloneAll = false) {

    const translateMatrix = new Matrix4().makeTranslation(0, 0, 5);

    dulplicate(mesh);

    function dulplicate(mesh: Object3D) {
      const newMesh = mesh.clone();
      if (cloneAll && mesh instanceof Mesh && newMesh instanceof Mesh) {
        for (let attrName in mesh.geometry.attributes) {
          const attr = mesh.geometry.getAttribute(attrName);
          newMesh.geometry.setAttribute(attrName, attr.clone());
        }
        if (Array.isArray(mesh.material)) {
          newMesh.material = MaterialStaticUtils.getAllMaterial(mesh).map(m => {
            const newMaterial = m.clone();
            if (m.map) {
              newMaterial.map = m.map.clone();
            }
            return newMaterial;
          });
        } else {
          newMesh.material = mesh.material.clone();
          if (mesh.material.map) {
            newMesh.material.map = mesh.material.map.clone();
            newMesh.material.map.needsUpdate = true;
          }
          newMesh.material.needsUpdate = true;
        }
        console.log(newMesh)
        newMesh.material.needsUpdate = true;
      }
      mesh.updateMatrixWorld();
      mesh.matrixWorld.decompose(newMesh.position, newMesh.quaternion, newMesh.scale);
      newMesh.applyMatrix4(translateMatrix);
      addObjectToScene(newMesh);
    }

  }

  function updateBoundaryEditHanlder(handlerMesh?: Mesh) {
    verticesEditHelper.clear();
    if (handlerMesh) {
      verticesEditHelper.add(createBoundaryCylinder(handlerMesh, sceneSettings.edit.verticesEditMode as any));
    }
  }

  function updateMeshEdge(allSeleted = false) {
    let meshes: Mesh[] = [];
    if (selectedMeshRef.current) {
      meshes = [selectedMeshRef.current];
    }
    if (allSeleted && selectedMeshSet.size) {
      meshes = Array.from(selectedMeshSet);
    }

    meshEdgeHelperGroup.clear();
    for (let mesh of meshes) {
      meshEdgeHelperGroup.add(createMeshEdge(mesh, sceneSettings.global.meshEdgeDepthTest));
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

  const updateMeshInfo = () => {

    if (selectedMeshRef.current) {
      const facesCount = getGeometryFacesCount(selectedMeshRef.current.geometry);
      const verticesCount = getGeometryVerticesCount(selectedMeshRef.current.geometry);
      sceneSettings.text.currentMeshFaces = facesCount;
      sceneSettings.text.currentMeshVertices = verticesCount;
    }

  }

  let transforming = false;

  let matrixStart = new Matrix4();
  let matrixEnd = new Matrix4();
  transformControl.addEventListener('mouseDown', (e) => {

    flyOrbitControls.enabled = false;
    transforming = true;
    if (selectedMeshRef.current) {
      selectedMeshRef.current.updateMatrix();
      matrixStart.copy(selectedMeshRef.current.matrix);
    }

  });

  transformControl.addEventListener('mouseUp', (e) => {

    flyOrbitControls.enabled = true;
    transforming = false;
    updateMeshEdge();
    updateBoundingBox();
    if (selectedMeshRef.current) {
      const mesh = selectedMeshRef.current;
      mesh.updateMatrix();
      matrixEnd.copy(mesh.matrix);
      octree.remove(selectedMeshRef.current);
      octree.add(selectedMeshRef.current);
      const transform = matrixEnd.multiply(matrixStart.invert());

      if (mesh.userData.attachMesh && mesh.userData.vertices) {
        GeoStaticUtils.applyMatrix4ToVertices(mesh.userData.attachMesh.geometry, transform, mesh.userData.vertices);
      } else {
        sceneHistory.addTransform(mesh, transform.clone());
      }
    }

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
  });

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

  customKeyboardEvent.onKey('y', (e) => {
    updateBoundaryEditHanlder(selectedMeshRef.current);
  });

  customKeyboardEvent.onKey('ArrowUp', (e) => {
    let meshes: Mesh[] = [];
    if (selectedMeshRef.current) {
      meshes = [selectedMeshRef.current];
    }
    if (selectedMeshSet.size) {
      meshes = Array.from(selectedMeshSet);
    }
    const scale = customKeyboardEvent.shift ? 10 : 1;
    for (let mesh of meshes) {
      if (customKeyboardEvent.ctrl || customKeyboardEvent.meta) {
        mesh.translateY(1 * scale)
      } else {
        mesh.translateX(1 * scale);
      }
      mesh.updateMatrixWorld();
    }
  });

  customKeyboardEvent.onKey('ArrowDown', (e) => {
    let meshes: Mesh[] = [];
    if (selectedMeshRef.current) {
      meshes = [selectedMeshRef.current];
    }
    if (selectedMeshSet.size) {
      meshes = Array.from(selectedMeshSet);
    }
    const scale = customKeyboardEvent.shift ? 10 : 1;
    for (let mesh of meshes) {
      if (customKeyboardEvent.ctrl || customKeyboardEvent.meta) {
        mesh.translateY(-1 * scale);
      } else {
        mesh.translateX(-1 * scale);
      }
      mesh.updateMatrixWorld();
    }
  });

  customKeyboardEvent.onKey('ArrowLeft', (e) => {
    let meshes: Mesh[] = [];
    if (selectedMeshRef.current) {
      meshes = [selectedMeshRef.current];
    }
    if (selectedMeshSet.size) {
      meshes = Array.from(selectedMeshSet);
    }
    const scale = customKeyboardEvent.shift ? 10 : 1;
    for (let mesh of meshes) {
      mesh.translateZ(-1 * scale);
      mesh.updateMatrixWorld();
    }
  });

  customKeyboardEvent.onKey('ArrowRight', (e) => {
    let meshes: Mesh[] = [];
    if (selectedMeshRef.current) {
      meshes = [selectedMeshRef.current];
    }
    if (selectedMeshSet.size) {
      meshes = Array.from(selectedMeshSet);
    }
    const scale = customKeyboardEvent.shift ? 10 : 1;
    for (let mesh of meshes) {
      mesh.translateZ(1 * scale);
      mesh.updateMatrixWorld();
    }
  });

  customKeyboardEvent.onKey('c', (e) => {
    if (customKeyboardEvent.ctrl || customKeyboardEvent.meta) {
      let meshes: Mesh[] = [];
      if (selectedMeshRef.current) {
        meshes = [selectedMeshRef.current];
      }
      if (selectedMeshSet.size) {
        meshes = Array.from(selectedMeshSet);
      }
      copiedMesh.clear();
      for (let mesh of meshes) {
        copiedMesh.add(mesh);
      }
    }
  });

  customKeyboardEvent.onKey('v', (e) => {
    if (customKeyboardEvent.ctrl || customKeyboardEvent.meta) {
      const cloneAll = !customKeyboardEvent.shift;
      if (copiedMesh.size) {
        copiedMesh.forEach(mesh => {
          copyMesh(mesh, cloneAll);
        });
      }
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

    lastMousePos.x = e.clientX - clientRect.left;
    lastMousePos.y = e.clientY - clientRect.top;

    if (sceneSettings.scene.liveSelect) {

      updateSeletedMesh(lastMousePos.x, lastMousePos.y);

    }

    if (customKeyboardEvent.alt && customMouseEvent.mousedown) {

      const startPoint = new Vector3(selectBoxHelper.startPoint.x - clientRect.left, selectBoxHelper.startPoint.y - clientRect.top, 0.5);
      const endPoint = new Vector3(lastMousePos.x, lastMousePos.y, 0.5);

      normalizeMousePosition(startPoint, clientRect.width, clientRect.height);
      normalizeMousePosition(endPoint, clientRect.width, clientRect.height);

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

        const { x, y } = lastMousePos;

        let mouse = new Vector2(x, y);

        mouse = normalizeMousePosition(mouse, clientRect.width, clientRect.height);

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

            if (customMouseEvent.mousedown && customKeyboardEvent.ctrl) {

              const changedTriangles = new Set();
              const changedIndices = new Set();
              const traversedNodeIndices = new Set();
              const sets = {

                accumulatedTriangles: changedTriangles,
                accumulatedIndices: changedIndices,
                accumulatedTraversedNodeIndices: traversedNodeIndices,

              };

              performStroke(boundsTree, _v0, selectedMeshRef.current, brushHelper, false, sets, {
                ...sceneSettings.sculpt,
                invert: customMouseEvent.mouseRightDown
              });

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

    if (selectedTriSet.size) {

      selectedTriSet.clear();
      trianglesHighlightHelper.clear();

    }

    let mouse = new Vector2(x, y);

    mouse = normalizeMousePosition(mouse, clientRect.width, clientRect.height);

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

        if (firstCast.userData) {

          sceneSettings.text.currentUserData = firstCast.userData;

        }

        selectedMaterialIndex = 0;

        selectedMeshRef.current = firstCast;

        selectedMeshRef.current.updateMatrixWorld();


        updateTransformInfo();
        updateMeshInfo();

        if (!firstCast.userData.attachMesh) {
          updateBoundaryEditHanlder();
        }

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
      selectedMeshSet.clear();
      updateBoundaryEditHanlder();
      updateBoundingBox();

      if (selectedMeshRef.current?.geometry.boundsTree) {

        selectedMeshRef.current.geometry.boundsTree = undefined;

      }
      sceneSettings.text.currentUserData = {};
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

      console.time('normal raycast')
      const intersectsss: Intersection[] = []
      selectedMeshRef.current.raycast(raycaster, intersectsss);
      console.log(intersectsss);
      console.timeEnd('normal raycast')

      const ray = raycaster.ray.clone();

      ray.applyMatrix4(invMat);

      console.time('bvh raycast time');
      const hit = boundsTree.raycast(ray, FrontSide);
      console.timeEnd('bvh raycast time');

      console.log('hit: ', hit);

      if (hit.length) {

        hit.sort((a, b) => a.distance - b.distance);

        const intersection = hit[0];

        if (intersection.face) {

          selectedMaterialIndex = intersection.face.materialIndex;

        }

        if (sceneSettings.currentTool === 'edit') {

          if (intersection.faceIndex !== undefined && intersection.face) {


            const go = new GeometryOperator(selectedMeshRef.current.geometry);
            const positions = go.rebuild().getAttribute('position').array as Float32Array;

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

            const newPositions = newGeo.getAttribute('position').array as Float32Array;

            const oldArr = new Uint8Array(positions.buffer);
            const newArr = new Uint8Array(newPositions.buffer);

            console.time('diff');
            const diff = fossilDelta.create(oldArr, newArr);
            console.log('diff', diff);
            console.timeEnd('diff');

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

    updateSeletedMesh(e.clientX - clientRect.left, e.clientY - clientRect.top);

  });

  renderLoop();

  // const sceneFile = '3dtiles/gltf_b3dm/model.gltf';
  // const model = await loadGltf(scene, 'http://127.0.0.1:8999/' + sceneFile);

  let tilesRenderer: TilesRenderer | null = null;

  let tilesGroup = new Group();

  (async () => {
    if (sceneSettings.action.selectScene !== 'None') {
      enableSceneVersionChange = false;
      const versions = await getAllVersions(sceneSettings.action.selectScene);
      let version = sceneSettings.scene.currentTileVersion;
      if (!versions.nodes.find(v => v.tagName === version)) {
        const newVersion = versions.nodes[versions.nodes.length - 1];
        sceneSettings.scene.currentTileVersion = newVersion.tagName;
      }
      version = sceneSettings.scene.currentTileVersion;
      enableSceneVersionChange = true;
      tilesGroup.clear();
      tilesRenderer = load3DTile(
        si,
        `http://127.0.0.1:8999/3dtiles_scene/${sceneSettings.action.selectScene}/tileset${version ? '_' + version : ''}.json`,
        sceneSettings.global.showOctreeHelper
      );
      tilesGroup.add(tilesRenderer.group as any);
    } else {
      tilesGroup.clear();
      tilesRenderer = null;
    }
  })();

  renderEvent.on('render', () => {
    camera.updateMatrix();
    tilesRenderer && tilesRenderer.update();
  });

  group.add(tilesGroup);

  scene.add(group);

  enableShadow(group);
  // await sceneManager.init(sceneFile, group);
  console.log('sceneManager inited');
  (window as any).octree = octree;
  (window as any).allGroup = group;
  (window as any).sceneManager = sceneManager;
}

const meshMaterialMap = new Map<Mesh, Material | Material[]>();


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
