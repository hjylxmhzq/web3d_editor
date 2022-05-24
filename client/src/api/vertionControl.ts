import axios from 'axios';
import { config } from '../configs';

export async function updateTilesVersion(currentScene: string, currentVersionTag: string, newVersionTag: string, newTilesetJSON: string, newB3dm: { [filename: string]: Uint8Array }) {

    const baseUrl = config.baseUrl;

    const formData = new FormData();

    formData.append('currentVersion', currentVersionTag);
    formData.append('tileset', newTilesetJSON);
    formData.append('newVersion', newVersionTag);
    formData.append('currentScene', currentScene);

    for (let filename in newB3dm) {

        formData.append('b3dm', new Blob([newB3dm[filename]]), filename);

    }

    const response = await axios.post(baseUrl + 'update_tiles_version', formData);

}

export async function mergeTilesVersions(
    currentScene: string,
    versionLeft: string,
    versionRight: string,
    versionMerge: string,
    mergedTilesetJSON: string,
) {

    const baseUrl = config.baseUrl;

    const response = await axios.post(baseUrl + 'merge_versions', {
        sceneName: currentScene,
        versionLeft,
        versionRight,
        versionMerge,
        tileset: mergedTilesetJSON,
    });

    return response;

}

export async function getAllScene(): Promise<string[]> {

    const baseUrl = config.baseUrl;

    const response = await axios.post(baseUrl + 'get_all_scene');

    const scenes = response.data.scenes;

    return scenes;

}


export interface Versions {
    nodes: {
        tagName: string;
    }[];
    links: {
        from: number,
        to: number,
    }[]
}

export async function getAllVersions(sceneName: string): Promise<Versions> {

    const baseUrl = config.baseUrl;

    const response = await axios.post(baseUrl + 'get_all_version', { sceneName: sceneName });

    const versions = response.data.versions;

    return versions;

}