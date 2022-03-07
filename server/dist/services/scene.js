"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sceneManager = exports.GraphNodeChangeType = exports.OperationType = void 0;
const uuid_1 = require("uuid");
class SceneManager {
    graphMap = new Map();
    currentGraph = null;
    constructor() {
    }
    getCurrentGraph(sceneFile) {
        let currentGraph = this.graphMap.get(sceneFile);
        if (currentGraph) {
            this.currentGraph = currentGraph;
        }
        else {
            currentGraph = new OperationGraph(sceneFile);
            this.graphMap.set(sceneFile, currentGraph);
        }
        return currentGraph;
    }
}
class OperationGraph {
    sceneFile;
    root = new GraphNode({ branch: 'root', nodeId: '', type: OperationType.root, value: null, changeType: GraphNodeChangeType.replace });
    idMap = new Map();
    branchHeads = new Map();
    constructor(sceneFile) {
        this.sceneFile = sceneFile;
        this.idMap.set(this.root.id, this.root);
    }
    getById(id) {
        return this.idMap.get(id);
    }
    addToBranch(updateFrom, newNode) {
        this.idMap.set(newNode.id, newNode);
        const fromNode = this.idMap.get(updateFrom);
        if (!fromNode) {
            return null;
        }
        if (fromNode.next.length) {
            const count = fromNode.next.length;
            newNode.branch = fromNode.branch + `_b${count + 1}`;
            fromNode.next.push(newNode);
        }
        else {
            newNode.branch = fromNode.branch;
            fromNode.next.push(newNode);
        }
    }
    rebaseScene(branch) {
    }
    mergeBranch(fromBranch, toBranch) {
    }
    addNode(updateFrom, parentNodeId, mesh) {
        const newNode = new GraphNode({ branch: '', nodeId: parentNodeId, type: OperationType.add, value: mesh, changeType: GraphNodeChangeType.replace });
        this.addToBranch(updateFrom, newNode);
    }
    transformNode(updateFrom, nodeId, matrix) {
        const newNode = new GraphNode({ branch: '', nodeId, type: OperationType.transform, value: matrix, changeType: GraphNodeChangeType.replace });
        this.addToBranch(updateFrom, newNode);
        return newNode;
    }
    getRoot() {
        function helper(n) {
            const newN = { ...n, prev: [] };
            const next = n.next.map(helper);
            newN.next = next;
            return newN;
        }
        const root = helper(this.root);
        return this.root;
    }
}
var OperationType;
(function (OperationType) {
    OperationType["root"] = "root";
    OperationType["transform"] = "transform";
    OperationType["delete"] = "delete";
    OperationType["add"] = "add";
    OperationType["mesh"] = "mesh";
})(OperationType = exports.OperationType || (exports.OperationType = {}));
var GraphNodeChangeType;
(function (GraphNodeChangeType) {
    GraphNodeChangeType["diff"] = "diff";
    GraphNodeChangeType["replace"] = "replace";
})(GraphNodeChangeType = exports.GraphNodeChangeType || (exports.GraphNodeChangeType = {}));
class GraphNode {
    id = (0, uuid_1.v4)();
    next = [];
    prev = [];
    branch;
    nodeId;
    type;
    value;
    changeType;
    constructor(options) {
        this.changeType = options.changeType;
        this.branch = options.branch;
        this.nodeId = options.nodeId;
        this.type = options.type;
        this.value = options.value;
    }
}
exports.sceneManager = new SceneManager();
//# sourceMappingURL=scene.js.map