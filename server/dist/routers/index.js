"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const scene_1 = require("./../services/scene");
const router_1 = __importDefault(require("../utils/router"));
router_1.default.get('/scene', async (ctx, next) => {
    const query = ctx.query['scenefile'];
    if (typeof query === 'string') {
        const graph = scene_1.sceneManager.getCurrentGraph(query);
        ctx.body = graph.getRoot();
    }
    ctx.state = 400;
    await next();
});
router_1.default.post('/scene', async (ctx, next) => {
    const action = ctx.request.body['payload'];
    const actiontype = ctx.request.body['actionType'];
    if (action && actiontype === 'transform') {
        const graphAction = action;
        const sceneFile = graphAction.sceneFile;
        const updateFrom = graphAction.updateFrom;
        const nodeId = graphAction.nodeId;
        const value = graphAction.value;
        if (!sceneFile || !updateFrom || !nodeId) {
            ctx.state = 400;
            return;
        }
        const graph = scene_1.sceneManager.getCurrentGraph(sceneFile);
        const changed = graph.transformNode(updateFrom, nodeId, value);
        ctx.body = { graph: graph.getRoot(), changeId: changed.id };
        return;
    }
    else {
        ctx.state = 400;
    }
    await next();
});
//# sourceMappingURL=index.js.map