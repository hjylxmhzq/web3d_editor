import { sceneManager } from './../services/scene';
import router from '../utils/router';

router.get('/scene', async (ctx, next) => {
  const query = ctx.query['scenefile'];
  if (typeof query === 'string') {
    const graph = sceneManager.getCurrentGraph(query);
    ctx.body = graph.getRoot();
  }
  ctx.state = 400;
  await next();
});

router.post('/scene', async (ctx, next) => {
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
    const graph = sceneManager.getCurrentGraph(sceneFile);
    const changed = graph.transformNode(updateFrom, nodeId, value);
    ctx.body = { graph: graph.getRoot(), changeId: changed.id};
    return;
  } else {
    ctx.state = 400;
  }
  await next();
});
