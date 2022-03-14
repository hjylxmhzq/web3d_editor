import { CubeTexture, CubeTextureLoader } from "three";
import { config } from "../../../configs";

let texture: CubeTexture;
let lastCubeTextureName = '';

export function loadCubeTexture(cubeTextureName: string) {
    
    if (texture && cubeTextureName === lastCubeTextureName) {
        
        return texture;

    }

    texture = new CubeTextureLoader().setPath(
        config.baseUrl + 'textures/cube/' + cubeTextureName + '/'
    ).load([
        'posx.jpg',
        'negx.jpg',
        'posy.jpg',
        'negy.jpg',
        'posz.jpg',
        'negz.jpg',
    ]);

    return texture;
}