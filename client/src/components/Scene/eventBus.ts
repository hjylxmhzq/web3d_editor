import { Mesh, Camera, Scene } from 'three';
import { EventEmitter } from 'events';
import { CustomTransformControls } from './CustomTransformControls';

export const eventBus = new EventEmitter();

export enum EventType {
  ATTACH_TRANSFORM_OBJECT = 'transform_object',
  DETACH_TRANSFORM_OBJECT = 'detach_transform_object',
  TRANSFORM_START = 'transform_start',
  TRANSFORM_END = 'transform_end',
  TRANSFORM_MOVING = 'transform_moving',
}

export function initEventBus(camera: Camera, domEl: HTMLElement, scene: Scene) {
  const transformControls = new CustomTransformControls(camera, domEl);
  transformControls.setMode('translate');

  scene.add(transformControls);

  transformControls.addEventListener('mouseDown', (e) => {
    eventBus.emit(EventType.TRANSFORM_START, transformControls);
  });

  transformControls.addEventListener('mouseUp', (e) => {
    eventBus.emit(EventType.TRANSFORM_END, transformControls);
  });

  eventBus.on(EventType.ATTACH_TRANSFORM_OBJECT, (obj: Mesh, mode: string) => {
    if (mode) {
      transformControls.setMode(mode);
    }
    transformControls.enabled = true;
    transformControls.attach(obj);
  });

  eventBus.on(EventType.DETACH_TRANSFORM_OBJECT, () => {
    transformControls.enabled = false;
    transformControls.detach();
  });

}
