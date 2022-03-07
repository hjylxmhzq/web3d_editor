import React, { useEffect, useRef, useState } from 'react';
import { AmbientLight, AxesHelper, Color, DirectionalLight, DirectionalLightHelper, Matrix4, OrthographicCamera, PCFSoftShadowMap, PerspectiveCamera, PointLight, PointLightHelper, Scene, sRGBEncoding, Vector3, WebGLRenderer } from 'three';
import { useUpdate } from '../../hooks/common';
import { FlyOrbitControls } from '../Scene/FlyOrbitControls';
import Toolbar from '../Toolbar';
import Toolbox from './components/Toolbox';
import { scene } from './scene';
import { observe, sceneSettings } from './settings';


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
    <div style={{ position: 'absolute', width: '150px', left: 0 }}>
      <Toolbar />
    </div>
    <div style={{ position: 'absolute', width: '200px', right: 0, height: '100%', overflowY: 'auto' }}>
      <Toolbox />
    </div>
    <div id="scene" ref={ref} style={{ width: '100vw', height: '100vh' }}></div>
  </div>
}

export interface SceneInfo {
  scene: Scene,
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
}

function setupThreeJs(el: HTMLDivElement): SceneInfo {
  console.log('setup Three.js scene')
  const scene = new Scene();

  const ratio = window.innerWidth / window.innerHeight;
  const orcamRadius = 100
  // const camera = new OrthographicCamera(-orcamRadius * ratio, orcamRadius * ratio, orcamRadius, -orcamRadius, 0, 1000000);
  const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 4000);

  camera.position.set(50, 50, 50);
  const renderer = new WebGLRenderer({
    alpha: true,
  });
  // renderer.setClearColor(0x000000, 0); // the default
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true;
  renderer.outputEncoding = sRGBEncoding;
  renderer.setSize(el.offsetWidth, el.offsetHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  // renderer.setClearColor(0x151c1f);
  renderer.domElement.tabIndex = 1;
  el.appendChild(renderer.domElement);
  let threeScene = {
    scene,
    camera,
    renderer,
  };


  (window as any).clickSim = function (x: number, y: number) {
    clickSim(x, y, renderer.domElement);
  }

  // lights
  const light = new PointLight(0xffffff, sceneSettings.scene.lightIntensity);
  const lightHelper = new PointLightHelper(light, 20, new Color(0xaaaaaa));

  const { lightAngle, lightDistance, lightIntensity, lightDirection, ambientLightIntensity } = sceneSettings.scene;
  const lightPos = lightPositionFromAngle(lightAngle, lightDistance);
  light.position.copy(lightPos).multiplyScalar(lightDistance);
  light.castShadow = true;
  scene.add(light);

  const ambLight = new AmbientLight(0xffffff, sceneSettings.scene.ambientLightIntensity);
  scene.add(ambLight);

  const axisHelper = new AxesHelper(500);

  light.shadow.mapSize.width = sceneSettings.scene.shadowMapResolution;
  light.shadow.mapSize.height = sceneSettings.scene.shadowMapResolution;

  observe(() => sceneSettings.scene.shadowMapResolution, (o, n) => {
    const res = sceneSettings.scene.shadowMapResolution;

    light.shadow.mapSize.width = res;
    light.shadow.mapSize.height = res;
    light.shadow.map?.dispose();
    (light.shadow.map as any) = null;
  });

  observe(() => {
    const { lightAngle, lightDistance, lightIntensity, lightDirection, ambientLightIntensity } = sceneSettings.scene;
  }, (o, n) => {

    const { lightAngle, lightDistance, lightDirection, lightIntensity, ambientLightIntensity } = sceneSettings.scene;
    ambLight.intensity = ambientLightIntensity;
    const lightPos = lightPositionFromAngle(lightAngle, lightDirection);
    light.distance = lightDistance * 2;
    light.intensity = lightIntensity;
    light.position.copy(lightPos).multiplyScalar(lightDistance);
  });

  observe(() => {
    let _1 = sceneSettings.scene.backgroundColor;
  }, (o, n) => {
    const backgroundColor = sceneSettings.scene.backgroundColor;
    renderer.setClearColor(backgroundColor, 1);
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

    if (showLightHelper) {
      scene.add(lightHelper);
    } else {
      lightHelper.parent?.remove(lightHelper);
    }

  });

  if (sceneSettings.scene.showAxisHelper) {

    scene.add(axisHelper);

  }

  if (sceneSettings.scene.showLightHelper) {

    scene.add(lightHelper);

  }

  return threeScene;
}

function lightPositionFromAngle(angle: number, direction: number) {

  const arc = angle / 180 * Math.PI;
  const dirArc = direction / 180 * Math.PI;

  const matrix1 = new Matrix4();
  const matrix2 = new Matrix4();

  matrix1.makeRotationZ(arc);
  matrix2.makeRotationY(dirArc);

  matrix2.multiply(matrix1);

  const v = new Vector3(1, 0, 0);

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