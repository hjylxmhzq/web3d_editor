import { TilesRenderer } from "3d-tiles-renderer";
import { Box3, Mesh, Object3D, Vector3 } from "three";
import { updateTilesVersion } from "../../../../api/vertionControl";
import { sceneSettings } from "../../settings";
import { TilesGenerator } from "../exporters/3dtilesExporter";
import { sceneHistory } from "../editHisotry/SceneHistory";

const tg = new TilesGenerator();

export async function update3DTiles(currentScene: string, tilesRenderer: TilesRenderer, versionTag: string) {

    const objects = sceneHistory.getAllChangedObjects();
    const tiles = searchTileOfObjects(objects);

    if (tiles?.size) {

        let buffers: { [filename: string]: Uint8Array } = {};
        let finished = 0;
        sceneSettings.text.loading = 0;
        sceneSettings.text.loadingText = 'collecting changings...';
        for (let tile of Array.from(tiles)) {

            const buffer = await updateTile(tile);
            const originUri = tile.content.uri.split('/').pop().split('.').shift();
            tile.content.uri = `${originUri}_${versionTag}.b3dm`;
            buffers[tile.content.uri] = buffer;
            finished++;
            sceneSettings.text.loading = finished / tiles.size;

        }

        updateTileset(tilesRenderer.root);

        const tr = tilesRenderer as any;

        const json = generateNewTilesetJSON(tr.tileSets[tr.rootURL]);

        const currentVersion = sceneSettings.scene.currentTileVersion;

        sceneSettings.text.loading = 0.5;
        sceneSettings.text.loadingText = 'uploading changings...';
        
        await updateTilesVersion(currentScene, currentVersion, versionTag, json, buffers);
        
        sceneSettings.text.loading = 1;
        setTimeout(() => {
            sceneSettings.text.loading = -1;
        })

        return true;

    } else {

        return false;

    }

}

function generateNewTilesetJSON(tileset: any) {

    const ignoreKey = /parent|^_|cached/;

    const json = JSON.stringify(tileset, (k, v) => {

        if (k === 'uri') {

            return './' + v.split('/').pop();

        }

        if (ignoreKey.test(k)) {

            return undefined;

        } else {

            return v;

        }

    }, 2);

    return json;

}

function updateTileset(root: any) {

    update(root);

    function update(node: any) {

        const box = node.boundingVolume.box;
        const center = new Vector3(box[0], box[1], box[2]);
        const radiusX = box[3];
        const radiusY = box[7];
        const radiusZ = box[11];

        const minX = box[0] - box[3];
        const maxX = box[0] + box[3];
        const minY = box[1] - box[7];
        const maxY = box[1] + box[7];
        const minZ = box[2] - box[11];
        const maxZ = box[2] + box[11];

        if (!node.children.length) {

            return [minX, maxX, minY, maxY, minZ, maxZ];

        } else {

            let [nminX, nmaxX, nminY, nmaxY, nminZ, nmaxZ] = [minX, maxX, minY, maxY, minZ, maxZ];
            for (let child of node.children) {

                let [cminX, cmaxX, cminY, cmaxY, cminZ, cmaxZ] = update(child);
                if (cminX < nminX) {
                    nminX = cminX;
                }
                if (cmaxX > nmaxX) {
                    nmaxX = cmaxX;
                }
                if (cminY < nminY) {
                    nminY = cminY;
                }
                if (cmaxY > nmaxY) {
                    nmaxY = cmaxY;
                }
                if (cminZ < nminZ) {
                    nminZ = cminZ
                }
                if (cmaxZ > nmaxZ) {
                    nmaxZ = cmaxZ;
                }
            }


            let maxRadiusX = Math.max(Math.abs(center.x - nminX), Math.abs(center.x - nmaxX), radiusX);
            let maxRadiusY = Math.max(Math.abs(center.y - nminY), Math.abs(center.y - nmaxY), radiusY);
            let maxRadiusZ = Math.max(Math.abs(center.z - nminZ), Math.abs(center.z - nmaxZ), radiusZ);


            node.boundingVolume.box = [
                center.x, center.y, center.z,
                maxRadiusX, 0, 0,
                0, maxRadiusY, 0,
                0, 0, maxRadiusZ
            ];

            return [nminX, nmaxX, nminY, nmaxY, nminZ, nmaxZ];

        }

    }

}

async function updateTile(tile: any) {

    const tileGroup = tile.cached.scene;
    const box3 = new Box3();
    box3.setFromObject(tileGroup);
    const bv = tile.boundingVolume.box;
    const center = new Vector3(bv[0], bv[1], bv[2]);
    const radiusX = Math.abs(bv[3] - center.x);
    const radiusY = Math.abs(bv[7] - center.y);
    const radiusZ = Math.abs(bv[11] - center.z);
    let maxRadiusX = radiusX;
    let maxRadiusY = radiusY;
    let maxRadiusZ = radiusZ;

    const b3dm = await tg.genB3dm(tileGroup);

    for (let v of [box3.min, box3.max]) {

        const { x, y, z } = v;
        if (Math.abs(x - center.x) > maxRadiusX) {

            maxRadiusX = Math.abs(x - center.x);
            bv[3] = maxRadiusX;

        }
        if (Math.abs(y - center.y) > maxRadiusY) {

            maxRadiusY = Math.abs(y - center.y);
            bv[7] = maxRadiusY;

        }
        if (Math.abs(z - center.z) > maxRadiusZ) {

            maxRadiusZ = Math.abs(z - center.z);
            bv[11] = maxRadiusZ;

        }

    }

    return b3dm;

}

function searchTileOfObjects(objects: Set<Object3D>) {

    const objList = Array.from(objects) as any[];

    const tiles = new Set<any>();

    for (let obj of objList) {

        if (obj.tile) {
            tiles.add(obj.tile);
        }

    }

    return tiles;

}