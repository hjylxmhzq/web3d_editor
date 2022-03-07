"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const koa_1 = __importDefault(require("koa"));
const cors_1 = __importDefault(require("@koa/cors"));
const koa_static_1 = __importDefault(require("koa-static"));
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const router_1 = __importDefault(require("./utils/router"));
const koa_body_1 = __importDefault(require("koa-body"));
function loadRouters() {
    const routerBase = path_1.default.join(__dirname, './routers');
    const routerModules = fs_extra_1.default.readdirSync(routerBase);
    routerModules.forEach(m => {
        if (m.toLowerCase().endsWith('.js')) {
            console.log(`find router: ${m}`);
            require(path_1.default.join(routerBase, m));
        }
    });
}
loadRouters();
const app = new koa_1.default();
app.use((0, cors_1.default)());
app.use((0, koa_static_1.default)(path_1.default.join(__dirname, '../resources')));
app.use((0, koa_body_1.default)());
const HOST = '0.0.0.0';
const PORT = 8999;
app.use(router_1.default.routes());
app.listen(PORT, HOST);
console.log(`server listening on ${HOST}:${PORT}`);
//# sourceMappingURL=index.js.map