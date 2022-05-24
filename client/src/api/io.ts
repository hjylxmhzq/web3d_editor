import axios from "axios";
import { config } from "../configs";
import { TextureType } from "../components/Editor/settings";
import { TextureInfo } from "../components/Editor/store";

export async function loadOnlineTexture() {

    const res = await axios.get(config.baseUrl + 'gettextures')

    async function loadImage(imageName: string) {

        const res = await axios.get<Blob>(config.baseUrl + 'textures/' + imageName, {
            responseType: 'blob',
        });

        return res.data;

    }

    const textures: { image: Blob, name: string, type: TextureType }[] = [];

    for (let texture of res.data) {

        const blob = await loadImage(texture.filename);

        textures.push({
            image: blob, type: texture.type, name: texture.filename
        });

    }

    return textures;

}