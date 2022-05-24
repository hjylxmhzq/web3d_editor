import { Matrix4, Object3D, Mesh } from 'three';
import { v4 as uuidV4 } from 'uuid';
import axios from 'axios';
import EventEmitter from 'events';

class SceneManager extends EventEmitter {
  public graphRoot: GraphNode | undefined;
  public sceneFile: string = '';
  public currentNode: GraphNode | undefined;
  public scene: Object3D = new Object3D();
  public sceneMap = new Map<string, Mesh>();
  public changedNode = new Map<GraphNode, Mesh>();
  constructor() {
    super();
  }
  get baseUrl() {
    return new URL('http://localhost:8999/scene');
  }
  async init(sceneFile: string, scene: Object3D) {
    this.scene = scene;
    this.sceneFile = sceneFile;
    const url = this.baseUrl;
    url.searchParams.set('scenefile', sceneFile);
    const res = await axios.get(url.href);
    this.graphRoot = res.data;
    this.currentNode = this.graphRoot;
    scene.traverse(o => {
      if (o instanceof Mesh) {
        this.sceneMap.set(o.name, o);
      }
    });
    this.emit('graphChange', this.graphRoot);
    this.emit('inited', this.graphRoot);
  }
  forwardToNode(nodeId: string) {
    const arr = this.branchToArray(nodeId);
    console.log(arr);
    if (!arr) {
      return;
    }
    this.resetToBase();
    for (let change of arr) {
      const mesh = this.sceneMap.get(change.nodeId);
      mesh && this.modifyMesh(change, mesh);
    }
    this.setCurrentNode(nodeId);
    console.log(arr);
  }
  modifyMesh(node: GraphNode, mesh: Mesh) {
    if (!mesh?.userData.originMatrix) {
      mesh.userData.originMatrix = mesh?.matrix.clone();
    }
    this.changedNode.set(node, mesh);
    if (node.type === 'transform') {
      const elements = node.value as number[];
      const matrix = new Matrix4();
      matrix.elements = elements;
      matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    }
  }
  branchToArray(id: string) {
    if (!this.graphRoot) {
      console.error('scene manager has not been initialized');
      return;
    }
    const arr: GraphNode[] = [];
    function s(n: GraphNode): boolean {
      if (n.id === id) {
        arr.push(n);
        return true;
      } else {
        for (const child of n.next) {
          const ret = s(child);
          if (ret) {
            arr.push(n);
            return true;
          }
        }
      }
      return false;
    }
    s(this.graphRoot);
    arr.reverse();
    return arr;
  }
  search(id: string) {
    if (!this.graphRoot) {
      console.error('scene manager has not been initialized');
      return;
    }
    function s(n: GraphNode): GraphNode | null {
      if (n.id === id) {
        return n;
      } else {
        for (const child of n.next) {
          const ret = s(child);
          if (ret) {
            return ret;
          }
        }
      }
      return null;
    }
    return s(this.graphRoot);
  }
  setCurrentNode(id: string) {
    const n = this.search(id);
    if (n) {
      this.currentNode = n;
    } else {
      console.error('can not find node with id: ' + id);
    }
  }
  resetToBase() {
    for (let [node, mesh] of Array.from(this.changedNode)) {
      mesh.userData.originMatrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    }
  }
  async addTransformNode(updateFrom: string, nodeId: string, afterMatrix: Matrix4) {
    const mesh = this.sceneMap.get(nodeId);
    if (!mesh) return;
    const url = this.baseUrl;
    const options: UpdateOptions = {
      sceneFile: this.sceneFile,
      updateFrom,
      nodeId,
      value: afterMatrix.elements,
    };
    const res = await axios.post(url.href, {
      actionType: 'transform',
      payload: options,
    });
    if (!mesh?.userData.originMatrix) {
      mesh.userData.originMatrix = mesh?.matrix.clone();
    }
    this.graphRoot = res.data.graph;
    const changeId = res.data.changeId;
    const node = this.search(changeId);
    node && this.changedNode.set(node, mesh);
    this.setCurrentNode(changeId);
    this.emit('graphChange', this.graphRoot);
  }
}

interface UpdateOptions {
  sceneFile: string;
  updateFrom: string;
  nodeId: string;
  value: GraphNodeValue;
}


export interface MeshAttribs {
  matrix: Matrix4;
  geometryAttribs: GeometryAttribs;
  textureAttribs: TextureAttribs;
}

export interface TextureAttribs {
  image?: Buffer[] | string[];
  color?: number;
}

export interface GeometryAttribs {
  [attribName: string]: {
    itemSize: number,
    array: number[],
  }
}

export enum OperationType {
  root = 'root',
  transform = 'transform',
  delete = 'delete',
  add = 'add',
  mesh = 'mesh',
}

interface GraphNodeOptions {
  branch: string;
  nodeId: string;
  type: OperationType;
  value: GraphNodeValue;
}

export class GraphNode {
  public id = uuidV4();
  public next: GraphNode[] = [];
  public prev: GraphNode[] = [];
  public branch: string;
  public nodeId: string;
  public type: OperationType;
  public value: GraphNodeValue;
  public name: string = '';
  constructor(
    options: GraphNodeOptions
  ) {
    this.branch = options.branch;
    this.nodeId = options.nodeId;
    this.type = options.type;
    this.value = options.value;
  }
}

type GraphNodeValue = MeshAttribs | Matrix4 | number[] | null;
export const sceneManager = new SceneManager();
(window as any).sceneManager = sceneManager;