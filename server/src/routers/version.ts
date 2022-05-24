import router from '../utils/router';
import fs from 'fs-extra';
import path from 'path';
import multer, { File, MulterIncomingMessage } from 'koa-multer';

const upload = multer({ dest: 'uploads/' });

interface Versions {
    nodes: {
        tagName: string;
    }[];
    links: {
        from: number,
        to: number,
    }[]
}

router.post('/update_tiles_version', upload.fields([{ name: 'b3dm' }]), async (ctx, next) => {
    const body = (ctx.req as MulterIncomingMessage).body;
    const fileFileds = (ctx.req as MulterIncomingMessage).files as unknown as { [filename: string]: File[] };

    const files = fileFileds['b3dm'];

    const currentVersion = body['currentVersion'];
    const currentScene = body['currentScene'];
    const newVersion = body['newVersion'];
    const tileset = body['tileset'];

    for (let file of files) {

        const absTarget = path.join(__dirname, '../../resources/3dtiles_scene', currentScene, file.originalname);
        const absSrc = path.join(__dirname, '../../', file.path);
        await fs.move(absSrc, absTarget);

    }

    const tilesetFile = path.join(__dirname, '../../resources/3dtiles_scene', currentScene, `tileset_${newVersion}.json`);
    await fs.writeFile(tilesetFile, tileset);

    await updateVersionFile(currentScene, currentVersion, newVersion);

    ctx.body = { status: 'Ok' };

    await next();
});

router.post('/get_all_version', async (ctx, next) => {

    const sceneName = ctx.request.body.sceneName;

    const versions = await getVersionByScene(sceneName);

    ctx.body = { versions };

    await next();

});

router.post('/merge_versions', async (ctx, next) => {

    const sceneName = ctx.request.body.sceneName;
    const versionLeft = ctx.request.body.versionLeft;
    const versionRight = ctx.request.body.versionRight;
    const versionMerge = ctx.request.body.versionMerge;
    const tileset = ctx.request.body.tileset;
    
    console.log(versionLeft, versionRight, versionMerge, tileset);

    const tilesetFile = path.join(__dirname, '../../resources/3dtiles_scene', sceneName, `tileset_${versionMerge}.json`);
    await fs.writeFile(tilesetFile, tileset);
    const result = await mergeVersions(sceneName, versionLeft, versionRight, versionMerge);

    ctx.body = { sucess: result };

    await next();

});

router.post('/get_all_scene', async (ctx, next) => {

    const sceneDir = path.join(__dirname, '../../resources/3dtiles_scene');

    const dirs = await fs.readdir(sceneDir);

    ctx.body = { scenes: dirs };

    await next();

});

async function getVersionByScene(sceneName: string) {

    const versionFile = path.join(__dirname, '../../resources/3dtiles_scene', sceneName, 'versions.json');
    const existed = fs.existsSync(versionFile);
    let versions: Versions;
    if (!existed) {
        versions = {
            nodes: [
                {
                    tagName: '',
                },
            ],
            links: [],
        };
        await fs.writeFile(versionFile, JSON.stringify(versions, null, 2));
    } else {
        versions = JSON.parse((await fs.readFile(versionFile)).toString());
    }

    return versions;

}

async function mergeVersions(currentScene: string, leftNode: string, rightNode: string, newNode: string) {


    const versionFile = path.join(__dirname, '../../resources/3dtiles_scene', currentScene, 'versions.json');

    const versions = await getVersionByScene(currentScene);

    versions.nodes.push({
        tagName: newNode,
    });

    const newVersionIndex = versions.nodes.length - 1;

    const leftIndex = versions.nodes.findIndex(v => v.tagName === leftNode);
    const rightIndex = versions.nodes.findIndex(v => v.tagName === rightNode);

    if (leftIndex !== -1 && rightIndex !== -1) {

        versions.links.push({
            from: leftIndex,
            to: newVersionIndex,
        }, {
            from: rightIndex,
            to: newVersionIndex,
        });

        await fs.writeFile(versionFile, JSON.stringify(versions, null, 2));

        return true;

    } else {

        return false;

    }

}

async function updateVersionFile(currentScene: string, fromNode: string, toNode: string) {

    const versionFile = path.join(__dirname, '../../resources/3dtiles_scene', currentScene, 'versions.json');

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

        await fs.writeFile(versionFile, JSON.stringify(versions, null, 2));
    } else {

        console.error('cannot find version node');

    }

}