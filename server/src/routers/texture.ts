import router from '../utils/router';
import fs from 'fs-extra';
import path from 'path';

interface Texture {
    type: string;
    filename: string;
}

const textureType: Record<string, string> = {
    'albedo': 'albedo',
    'ao': 'ao',
    'height': 'displace',
    'roughness': 'roughness',
    'normal': 'normal',
};

router.get('/gettextures', async (ctx, next) => {

    const texturePath = path.join(__dirname, '../../resources/textures');

    const files = await fs.readdir(texturePath);

    const textures: Texture[] = [];

    for (let file of files) {

        for (let key of Object.keys(textureType)) {
            if (file.includes(key)) {
                textures.push({
                    type: textureType[key],
                    filename: file,
                });
            }
        }

    }

    ctx.body = JSON.stringify(textures);

    await next();
});
