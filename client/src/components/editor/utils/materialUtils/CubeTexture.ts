import { CubeTexture, CubeTextureLoader, Texture } from "three";
import { config } from "../../../../configs";

let cached: Record<string, CubeTexture> = {};

export function loadCubeTexture(cubeTextureName: string) {

    if (cached[cubeTextureName]) {

        return cached[cubeTextureName];

    }

    const texture = new CubeTextureLoader().setPath(
        config.baseUrl + 'textures/cube/' + cubeTextureName + '/'
    ).load([
        'posx.jpg',
        'negx.jpg',
        'posy.jpg',
        'negy.jpg',
        'posz.jpg',
        'negz.jpg',
    ]);

    cached[cubeTextureName] = texture;

    return texture;
}