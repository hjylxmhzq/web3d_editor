"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const router_1 = __importDefault(require("../utils/router"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const koa_multer_1 = __importDefault(require("koa-multer"));
const upload = (0, koa_multer_1.default)({ dest: 'uploads/' });
router_1.default.post('/update_tiles_version', upload.fields([{ name: 'b3dm' }]), async (ctx, next) => {
    const body = ctx.req.body;
    const fileFileds = ctx.req.files;
    const files = fileFileds['b3dm'];
    const currentVersion = body['currentVersion'];
    const currentScene = body['currentScene'];
    const newVersion = body['newVersion'];
    const tileset = body['tileset'];
    for (let file of files) {
        const absTarget = path_1.default.join(__dirname, '../../resources/3dtiles_scene', currentScene, file.originalname);
        const absSrc = path_1.default.join(__dirname, '../../', file.path);
        await fs_extra_1.default.move(absSrc, absTarget);
    }
    const tilesetFile = path_1.default.join(__dirname, '../../resources/3dtiles_scene', currentScene, `tileset_${newVersion}.json`);
    await fs_extra_1.default.writeFile(tilesetFile, tileset);
    await updateVersionFile(currentScene, currentVersion, newVersion);
    ctx.body = { status: 'Ok' };
    await next();
});
router_1.default.post('/get_all_version', async (ctx, next) => {
    const sceneName = ctx.request.body.sceneName;
    const versions = await getVersionByScene(sceneName);
    ctx.body = { versions };
    await next();
});
router_1.default.post('/get_all_scene', async (ctx, next) => {
    const sceneDir = path_1.default.join(__dirname, '../../resources/3dtiles_scene');
    const dirs = await fs_extra_1.default.readdir(sceneDir);
    ctx.body = { scenes: dirs };
    await next();
});
async function getVersionByScene(sceneName) {
    const versionFile = path_1.default.join(__dirname, '../../resources/3dtiles_scene', sceneName, 'versions.json');
    const existed = fs_extra_1.default.existsSync(versionFile);
    let versions;
    if (!existed) {
        versions = {
            nodes: [
                {
                    tagName: '',
                },
            ],
            links: [],
        };
        await fs_extra_1.default.writeFile(versionFile, JSON.stringify(versions, null, 2));
    }
    else {
        versions = JSON.parse((await fs_extra_1.default.readFile(versionFile)).toString());
    }
    return versions;
}
async function updateVersionFile(currentScene, fromNode, toNode) {
    const versionFile = path_1.default.join(__dirname, '../../resources/3dtiles_scene', currentScene, 'versions.json');
    const versions = await getVersionByScene(currentScene);
    const nodeNames = versions.nodes.map((n) => n.tagName);
    if (nodeNames.includes(toNode)) {
        console.error('dulplicate version: ', toNode);
        return;
    }
    versions.nodes.push({
        tagName: toNode,
    });
    nodeNames.push(toNode);
    const fromIndex = nodeNames.indexOf(fromNode);
    const toIndex = nodeNames.indexOf(toNode);
    if (fromIndex !== -1 && toIndex !== -1) {
        versions.links.push({
            from: fromIndex,
            to: toIndex,
        });
        await fs_extra_1.default.writeFile(versionFile, JSON.stringify(versions, null, 2));
    }
    else {
        console.error('cannot find version node');
    }
}
//# sourceMappingURL=version.js.map