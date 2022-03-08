import {
    Vector2
  } from 'three';
  
  
  // singleton
  let instance: SelectionBoxHelper;
  
  class SelectionBoxHelper {
  
    private _enabled = false;
    element: HTMLDivElement;
    startPoint: Vector2;
    pointTopLeft: Vector2;
    pointBottomRight: Vector2;
    isDown = false;
  
    static getinstance(domElement: HTMLElement, cssClassName: string) {
      if (!instance) {
        instance = new SelectionBoxHelper(domElement, cssClassName);
      }
      return instance;
    }
  
    constructor(public domElement: HTMLElement, cssClassName: string) {
      this.element = document.createElement('div');
      this.element.classList.add(cssClassName);
      this.element.style.position = 'fixed';
      this.element.style.zIndex = '999';
      this.element.style.backgroundColor = '#eeeeee85';
      this.element.style.border = '2px solid #eeeeeeee';
      this.element.style.pointerEvents = 'none';
      this.startPoint = new Vector2();
      this.pointTopLeft = new Vector2();
      this.pointBottomRight = new Vector2();
    }
  
    private attachEventListener() {
      this.domElement.addEventListener('pointerdown', this.onMousedown);
  
      this.domElement.addEventListener('pointermove', this.onMousemove);
  
      this.domElement.addEventListener('pointerup', this.onMouseup);
    }
  
    private detachEventListener() {
      this.domElement.removeEventListener('pointerdown', this.onMousedown);
  
      this.domElement.removeEventListener('pointermove', this.onMousemove);
  
      this.domElement.removeEventListener('pointerup', this.onMouseup);
    }
  
    private onMousedown = (event: PointerEvent) => {
      if (!this.enabled) {
        return;
      }
      this.isDown = true;
      this.onSelectStart(event);
    }
  
    private onMousemove = (event: PointerEvent) => {
      if (!this.enabled) {
        return;
      }
      if (this.isDown) {
        this.onSelectMove(event);
      }
    }
  
    private onMouseup = () => {
      if (!this.enabled) {
        return;
      }
      this.isDown = false;
      this.onSelectOver();
  
    }
  
    get enabled() {
      return this._enabled;
    }
  
    set enabled(v) {
      this._enabled = !!v;
      if (this._enabled === false) {
        this.detachEventListener();
        this.isDown = false;
        this.onSelectOver();
      } else {
        this.attachEventListener();
      }
    }
  
    onSelectStart(event: PointerEvent) {
  
      this.domElement.parentElement?.appendChild(this.element);
  
      this.element.style.left = event.clientX + 'px';
      this.element.style.top = event.clientY + 'px';
      this.element.style.width = '0px';
      this.element.style.height = '0px';
  
      this.startPoint.x = event.clientX;
      this.startPoint.y = event.clientY;
  
    }
  
    onSelectMove(event: PointerEvent) {
  
      this.pointBottomRight.x = Math.max(this.startPoint.x, event.clientX);
      this.pointBottomRight.y = Math.max(this.startPoint.y, event.clientY);
      this.pointTopLeft.x = Math.min(this.startPoint.x, event.clientX);
      this.pointTopLeft.y = Math.min(this.startPoint.y, event.clientY);
  
      this.element.style.left = this.pointTopLeft.x + 'px';
      this.element.style.top = this.pointTopLeft.y + 'px';
      this.element.style.width = (this.pointBottomRight.x - this.pointTopLeft.x) + 'px';
      this.element.style.height = (this.pointBottomRight.y - this.pointTopLeft.y) + 'px';
  
    }
  
    onSelectOver() {
  
      this.element.parentElement?.removeChild(this.element);
  
    }
  
  }
  
  export { SelectionBoxHelper };