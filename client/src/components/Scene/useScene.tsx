import { RefObject, useEffect, useState } from 'react';
import { Scene, PerspectiveCamera, WebGLRenderer, Vector3, AxesHelper, Sphere, sRGBEncoding, DirectionalLight, AmbientLight, Raycaster, Vector2, Object3D, Box3, Mesh, PointLight, PointLightHelper, Light, DirectionalLightHelper, PCFSoftShadowMap } from 'three';
import { FlyOrbitControls } from './FlyOrbitControls';
import * as THREE from 'three';
import { TilesRenderer, DebugTilesRenderer } from '3d-tiles-renderer';
import EventEmitter from 'events';
import { EditControls, moveToTile, HighlightControls, SelectionControls, GlobalVar, mergeMeshes } from './utils';
import { CustomTransformControls } from './CustomTransformControls';
import { initEventBus } from './eventBus';
import keyboardStatus from './keyboardStatus';

(window as any).THREE = THREE;

export enum RENDER_EVENT {
  beforedestroy = 'beforedestroy',
  render = 'render'
}

const renderEvent = new EventEmitter();
let highlightControls: HighlightControls;
let selectioinControls: SelectionControls;
let editControls: EditControls;
let transformControls: CustomTransformControls;
let flyOrbitControls: FlyOrbitControls;

const raycaster = new Raycaster();
const mouse = new Vector2();

interface SceneInfo {
  scene: Scene,
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
}

function setupThreeJs(el: HTMLCanvasElement): SceneInfo {
  console.log('setup Three.js scene')
  const scene = new Scene();
  const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 40000);
  camera.position.set(400, 400, 400);
  const renderer = new WebGLRenderer();
  renderer.outputEncoding = sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.setSize(el.offsetWidth, el.offsetHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x151c1f);
  renderer.shadowMap.type = PCFSoftShadowMap;
  // renderer.setClearColor(0xffffff);
  renderer.domElement.tabIndex = 1;
  el.appendChild(renderer.domElement);
  let threeScene = {
    scene,
    camera,
    renderer,
  }

  // lights
  const light = new DirectionalLight(0xffffff);
  light.position.set(100, 100, 100);
  light.castShadow = true;
  const d = 1000;

  light.shadow.camera.left = - d;
  light.shadow.camera.right = d;
  light.shadow.camera.top = d;
  light.shadow.camera.bottom = - d;
  light.shadow.mapSize.width = 10000;
  light.shadow.mapSize.height = 10000;
  scene.add(light);
  console.log('light ', light);

  const ph = new DirectionalLightHelper(light, 20);
  scene.add(ph);

  const ambLight = new AmbientLight(0xffffff, 0.2);
  // scene.add(ambLight);

  flyOrbitControls = new FlyOrbitControls(camera, renderer.domElement);
  flyOrbitControls.screenSpacePanning = false;
  flyOrbitControls.minDistance = 1;
  flyOrbitControls.maxDistance = 2000;

  const axisHelper = new AxesHelper(500);
  scene.add(axisHelper);
  return threeScene;
}

function load3DTile(threeScene: SceneInfo, resource: string) {
  const { camera, scene, renderer } = threeScene;
  const tilesRenderer = new DebugTilesRenderer(resource);
  // tilesRenderer.displayBoxBounds = true;
  tilesRenderer.maxDepth = 2;
  tilesRenderer.onLoadTileSet = () => {
    moveToTile(tilesRenderer);
  }
  tilesRenderer.onLoadModel = (scene, tile) => {
    scene.traverse(m => {
      if (m instanceof Mesh) {
        m.receiveShadow = true;
      }
    })
  }
  tilesRenderer.stopAtEmptyTiles = false;
  tilesRenderer.setCamera(camera);
  tilesRenderer.setResolutionFromRenderer(camera, renderer);
  threeScene.scene.add(tilesRenderer.group);
  GlobalVar.set('tilesRenderer', tilesRenderer);

  function onRender() {
    // The camera matrix is expected to be up to date
    // before calling tilesRenderer.update
    camera.updateMatrixWorld();
    tilesRenderer.update();
  }

  (window as any).tr = tilesRenderer;

  renderEvent.on('render', onRender);
  return tilesRenderer;
}

export default function useScene(ref: RefObject<HTMLCanvasElement>) {
  let [boxSelectionEnabled, setBoxSelectionEnabled] = useState(false);
  let [sceneInfo, setSceneInfo] = useState<SceneInfo>();

  useEffect(() => {

    if (!ref.current) {
      console.warn('cannot get reference of canvas container');
      return;
    }

    const threeScene = setupThreeJs(ref.current);
    (window as any).ts = threeScene;

    setSceneInfo(threeScene);
    // const tilesRenderer = load3DTile(threeScene, 'http://127.0.0.1:8999/3dtiles/3dtile_octree/tileset.json');
    const tilesRenderer = load3DTile(threeScene, 'http://127.0.0.1:8999/3dtiles/test_data3/tileset.json');

    const { scene, camera, renderer } = threeScene;

    selectioinControls = new SelectionControls(tilesRenderer, threeScene.camera);
    highlightControls = new HighlightControls(camera);
    editControls = new EditControls(flyOrbitControls, camera, renderer);

    initEventBus(camera, renderer.domElement, scene);

    scene.add(editControls.helperGroup);

    let lastMesh: Mesh[] = [];

    selectioinControls.onSelect((intersects: any[]) => {
      if (intersects.length) {
        const mesh = intersects[0].object;
        if (!lastMesh.includes(mesh)) {
          if (!keyboardStatus.ctrl) {
            highlightControls.clear();
            editControls.detach();
            // highlightControls.highlightBBox(mesh);
            editControls.attach(mesh);
            for (let m of lastMesh) {
              m.visible = true;
            }
            lastMesh = [mesh];
          } else {
            highlightControls.clear();
            // editControls.detach();
            lastMesh.push(mesh);
            for (let m of lastMesh) {
              m.visible = false;
            }
            editControls.attach(mesh);
          }
        }
      } else {
        highlightControls.clear();
        editControls.detach();
      }
    });

    scene.add(highlightControls.group);
    scene.add(editControls.group);

    function renderLoop() {
      requestAnimationFrame(renderLoop);
      threeScene.renderer.render(threeScene.scene, threeScene.camera);
      renderEvent.emit('render');
    }

    renderLoop();

    function onDestroy() {
      threeScene.renderer.domElement.remove();
      selectioinControls.destroy();
      highlightControls.clear();
    }
    renderEvent.on(RENDER_EVENT.beforedestroy, onDestroy);
    return () => {
      renderEvent.emit(RENDER_EVENT.beforedestroy);
      renderEvent.removeAllListeners();
    };

  }, []);

  useEffect(() => {

    editControls.boxSelectionEnabled = boxSelectionEnabled;
    flyOrbitControls.enabled = !boxSelectionEnabled

  }, [boxSelectionEnabled]);

  return { sceneInfo, setBoxSelectionEnabled, boxSelectionEnabled };
}