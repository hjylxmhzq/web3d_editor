import { v4 as uuidV4 } from 'uuid';
import { Matrix4 } from 'three';

class SceneManager {
  public graphMap = new Map<string, OperationGraph>();
  public currentGraph: OperationGraph | null = null;
  constructor() {

  }
  getCurrentGraph(sceneFile: string) {
    let currentGraph = this.graphMap.get(sceneFile);
    if (currentGraph) {
      this.currentGraph = currentGraph;
    } else {
      currentGraph = new OperationGraph(sceneFile);
      this.graphMap.set(sceneFile, currentGraph);
    }
    return currentGraph;
  }
}

class OperationGraph {
  public root = new GraphNode({ branch: 'root', nodeId: '', type: OperationType.root, value: null, changeType: GraphNodeChangeType.replace });
  public idMap = new Map<string, GraphNode>();
  public branchHeads = new Map<string, GraphNode>();
  constructor(public sceneFile: string) {
    this.idMap.set(this.root.id, this.root);
  }

  getById(id: string) {
    return this.idMap.get(id);
  }

  addToBranch(updateFrom: string, newNode: GraphNode) {
    this.idMap.set(newNode.id, newNode);
    const fromNode = this.idMap.get(updateFrom);
    if (!fromNode) {
      return null;
    }
    if (fromNode.next.length) {
      const count = fromNode.next.length;
      newNode.branch = fromNode.branch + `_b${count + 1}`;
      fromNode.next.push(newNode);
    } else {
      newNode.branch = fromNode.branch;
      fromNode.next.push(newNode);
    }
  }

  rebaseScene(branch: string) {

  }

  mergeBranch(fromBranch: string, toBranch: string) {

  }

  addNode(updateFrom: string, parentNodeId: string, mesh: MeshAttribs) {
    const newNode = new GraphNode({ branch: '', nodeId: parentNodeId, type: OperationType.add, value: mesh, changeType: GraphNodeChangeType.replace });
    this.addToBranch(updateFrom, newNode);
  }

  transformNode(updateFrom: string, nodeId: string, matrix: Matrix4) {
    const newNode = new GraphNode({ branch: '', nodeId, type: OperationType.transform, value: matrix, changeType: GraphNodeChangeType.replace });
    this.addToBranch(updateFrom, newNode);
    return newNode;
  }

  getRoot() {
    function helper(n: GraphNode) {
      const newN = { ...n, prev: [] };
      const next = n.next.map(helper);
      newN.next = next;
      return newN;
    }
    const root = helper(this.root);
    return this.root;
  }
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

export enum GraphNodeChangeType {
  diff = 'diff',
  replace = 'replace',
}

interface GraphNodeOptions {
  branch: string;
  nodeId: string;
  type: OperationType;
  value: GraphNodeValue;
  changeType: GraphNodeChangeType;
}

class GraphNode {
  public id = uuidV4();
  public next: GraphNode[] = [];
  public prev: GraphNode[] = [];
  public branch: string;
  public nodeId: string;
  public type: OperationType;
  public value: GraphNodeValue;
  public changeType: GraphNodeChangeType;
  constructor(
    options: GraphNodeOptions
  ) {
    this.changeType = options.changeType;
    this.branch = options.branch;
    this.nodeId = options.nodeId;
    this.type = options.type;
    this.value = options.value;
  }
}

type GraphNodeValue = MeshAttribs | Matrix4 | null;

export const sceneManager = new SceneManager();