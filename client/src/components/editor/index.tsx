import React, { useEffect, useRef, useState } from 'react';
import { AmbientLight, AxesHelper, Color, CubeTextureLoader, DirectionalLight, DirectionalLightHelper, Group, Matrix4, OrthographicCamera, PCFSoftShadowMap, PerspectiveCamera, PointLight, PointLightHelper, Scene, sRGBEncoding, Vector3, WebGLRenderer } from 'three';
import { config } from '../../configs';
import { useUpdate } from '../../hooks/common';
import { FlyOrbitControls } from '../Scene/FlyOrbitControls';
import Toolbar from '../Toolbar';
import Toolbox from './components/Toolbox';
import { scene } from './scene';
import { observe, sceneSettings } from './settings';
import { loadCubeTexture } from './utils/CubeTexture';
import './index.scss';


export default function GenComponnet() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {

    if (ref.current) {
      const sceneInfo = setupThreeJs(ref.current);
      (window as any).si = sceneInfo;
      scene(sceneInfo);
      return () => {

      }
    }

  }, []);

  return <div>
    <div
      className='toolbar-container'
      tabIndex={3}
    >
      <Toolbar />
    </div>
    <div style={{ position: 'absolute', width: '200px', right: 0, height: '100%', overflowY: 'auto' }}>
      <Toolbox />
    </div>
    <div style={{
      position: 'absolute',
      left: 0,
      right: 200,
      height: 23,
      bottom: 0,
      textAlign: 'left',
      padding: '0 10px',
      backgroundColor: '#eee',
      overflow: 'hidden'
    }}>
      <span>
        {
          sceneSettings.text.bottomBar
        }
      </span>
    </div>
    <div id="scene" ref={ref} style={{ width: '100%', height: '100vh' }}></div>
  </div>
}

export interface SceneInfo {
  scene: Scene,
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
  secondRenderer?: WebGLRenderer
}

function setupThreeJs(el: HTMLDivElement): SceneInfo {
  console.log('setup Three.js scene')
  const scene = new Scene();

  const ratio = window.innerWidth / window.innerHeight;
  const orcamRadius = 100
  // const camera = new OrthographicCamera(-orcamRadius * ratio, orcamRadius * ratio, orcamRadius, -orcamRadius, 0, 1000000);
  const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);

  camera.position.set(50, 50, 50);

  const renderer = new WebGLRenderer({
    alpha: true,
    logarithmicDepthBuffer: sceneSettings.scene.logarithmicDepthBuffer,
  });

  let secondRenderer: WebGLRenderer

  // renderer.setClearColor(0x000000, 0); // the default
  renderer.setClearColor(sceneSettings.scene.backgroundColor, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true;
  renderer.outputEncoding = sRGBEncoding;
  renderer.setSize(el.offsetWidth, el.offsetHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  // renderer.setClearColor(0x151c1f);
  renderer.domElement.tabIndex = 1;
  el.appendChild(renderer.domElement);

  let threeScene: SceneInfo = {
    scene,
    camera,
    renderer,
  };

  if (sceneSettings.scene.secondCamera) {
    secondRenderer = new WebGLRenderer({
      alpha: true,
      logarithmicDepthBuffer: sceneSettings.scene.logarithmicDepthBuffer,
    });
    secondRenderer.setClearColor(sceneSettings.scene.backgroundColor, 1);
    secondRenderer.shadowMap.enabled = true;
    secondRenderer.shadowMap.type = PCFSoftShadowMap;
    secondRenderer.shadowMap.autoUpdate = true;
    secondRenderer.outputEncoding = sRGBEncoding;
    secondRenderer.setSize(400, 300);
    secondRenderer.setPixelRatio(window.devicePixelRatio);
    secondRenderer.domElement.style.position = 'absolute';
    secondRenderer.domElement.style.top = '0px';
    secondRenderer.domElement.style.left = '0px';
    el.appendChild(secondRenderer.domElement);
    threeScene.secondRenderer = secondRenderer;
  }


  function loadBackground() {

  }

  if (sceneSettings.scene.showSkybox) {

    scene.background = loadCubeTexture(sceneSettings.scene.cubeTextureName);

  }

  (window as any).clickSim = function (x: number, y: number) {
    clickSim(x, y, renderer.domElement);
  }

  let lastLight: PointLight | DirectionalLight | null = null;
  let ambLight: AmbientLight;
  let lastLightHelper: PointLightHelper | DirectionalLightHelper | null = null;

  function updateLights(replace = false, updateShadowMap = false) {

    let light, lightHelper;

    if (replace || !lastLight || !lastLightHelper) {
      lightGroup.clear();
      // lights
      light = sceneSettings.scene.directionLight ?
        new DirectionalLight(0xffffff, sceneSettings.scene.lightIntensity)
        : new PointLight(0xffffff, sceneSettings.scene.lightIntensity);

      lightHelper = light instanceof DirectionalLight ?
        new DirectionalLightHelper(light, 10, new Color(0xaaaaaa))
        : new PointLightHelper(light, 10, new Color(0xaaaaaa));

      light.castShadow = true;

      light.shadow.mapSize.width = sceneSettings.scene.shadowMapResolution;
      light.shadow.mapSize.height = sceneSettings.scene.shadowMapResolution;

      ambLight = new AmbientLight(0xffffff, 1);

      lightGroup.clear();
      lightGroup.add(ambLight);
      lightGroup.add(light);

      lastLight = light;
      lastLightHelper = lightHelper;
    } else {
      light = lastLight;
      lightHelper = lastLightHelper;
    }

    const { lightAngle, lightDistance, lightIntensity, lightDirection, ambientLightIntensity, showLightHelper } = sceneSettings.scene;
    const lightPos = lightPositionFromAngle(new Vector3(1, 0, 0), lightAngle, lightDirection);
    light.position.copy(lightPos).multiplyScalar(lightDistance);
    light.intensity = lightIntensity;
    ambLight.intensity = ambientLightIntensity;
    if (light instanceof PointLight) {
      light.distance = lightDistance * 2;
    } else {
      light.lookAt(0, 0, 0);
    }

    if (showLightHelper) {
      lightGroup.add(lightHelper);
    } else {
      lightHelper.parent?.remove(lightHelper);
    }
    if (updateShadowMap) {

      if (light instanceof DirectionalLight) {

        light.shadow.camera.top = sceneSettings.scene.shadowMapResolution / 100;
        light.shadow.camera.bottom = -sceneSettings.scene.shadowMapResolution / 100;
        light.shadow.camera.left = -sceneSettings.scene.shadowMapResolution / 100;
        light.shadow.camera.right = sceneSettings.scene.shadowMapResolution / 100;
        light.shadow.camera.near = 0.5;
        light.shadow.camera.far = 5000;
        light.shadow.camera.updateProjectionMatrix();

      }

      light.shadow.mapSize.width = sceneSettings.scene.shadowMapResolution;
      light.shadow.mapSize.height = sceneSettings.scene.shadowMapResolution;
      light.shadow.map?.dispose();
      (light.shadow as any).map = null;

    }

  }

  const lightGroup = new Group();

  updateLights(true);

  scene.add(lightGroup);

  const axisHelper = new AxesHelper(500);

  observe(() => sceneSettings.scene.shadowMapResolution, (o, n) => {
    updateLights(false, true);
  });

  observe(() => sceneSettings.scene.directionLight, (o, n) => {
    updateLights(true, true);
  });

  observe(() => {
    const { lightAngle, lightDistance, lightIntensity, lightDirection, ambientLightIntensity, showLightHelper } = sceneSettings.scene;
  }, (o, n) => {
    updateLights();
  });

  observe(() => {
    let _1 = sceneSettings.scene.backgroundColor;
  }, (o, n) => {
    const backgroundColor = sceneSettings.scene.backgroundColor;
    renderer.setClearColor(backgroundColor, 1);
  });

  observe(() => {
    let _1 = sceneSettings.scene.showSkybox;
  }, (o, n) => {
    const showSkybox = sceneSettings.scene.showSkybox;;
    if (showSkybox) {
      scene.background = loadCubeTexture(sceneSettings.scene.cubeTextureName);
    } else {
      scene.background = null;
    }

  });

  observe(() => {
    let _1 = sceneSettings.scene.showAxisHelper;
    let _2 = sceneSettings.scene.showLightHelper;
  }, (o, n) => {

    const { showLightHelper, showAxisHelper } = sceneSettings.scene;

    if (!showAxisHelper) {
      axisHelper.parent?.remove(axisHelper);
    } else {
      scene.add(axisHelper);
    }

  });

  if (sceneSettings.scene.showAxisHelper) {

    scene.add(axisHelper);

  }

  return threeScene;
}

function lightPositionFromAngle(pos: Vector3, angle: number, direction: number) {

  const arc = angle / 180 * Math.PI;
  const dirArc = direction / 180 * Math.PI;

  const matrix1 = new Matrix4();
  const matrix2 = new Matrix4();

  matrix1.makeRotationZ(arc);
  matrix2.makeRotationY(dirArc);

  matrix2.multiply(matrix1);

  const v = pos.clone();

  v.applyMatrix4(matrix2);

  return v;

}

function clickSim(x: number, y: number, domEl: HTMLElement) {
  const evt1 = new MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y
  });

  const evt2 = new MouseEvent("mouseup", {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y
  });

  domEl.dispatchEvent(evt1);
  domEl.dispatchEvent(evt2);
}