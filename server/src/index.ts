import Koa from 'koa';
import cors from '@koa/cors';
import koaStatic from 'koa-static';
import path from 'path';
import fs from 'fs-extra';
import router from './utils/router';
import koaBody from 'koa-body';

function loadRouters() {
  const routerBase = path.join(__dirname, './routers');
  const routerModules = fs.readdirSync(routerBase);
  routerModules.forEach(m => {
    if (m.toLowerCase().endsWith('.js')) {
      console.log(`find router: ${m}`);
      require(path.join(routerBase, m));
    }
  });
}

loadRouters();

const app = new Koa();
app.use(cors());
app.use(koaStatic(path.join(__dirname, '../resources')));
app.use(koaBody());

const HOST = '0.0.0.0';
const PORT = 8999;

app.use(router.routes());

app.listen(PORT, HOST);

console.log(`server listening on ${HOST}:${PORT}`);