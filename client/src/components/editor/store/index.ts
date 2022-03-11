import { TextureType } from "../settings";

export interface TextureInfo {
    image: Blob;
    type: TextureType;
    width: number;
    height: number;
}

class SceneStorage {
    storage = new Map();
    cbList: ((key: string, value: any) => void)[] = [];

    constructor() {


    }

    onChange(cb: (key: string, value: any) => void) {
        this.cbList.push(cb);
    }

    getStorage(key: string, defaultValue: any) {

        let value = this.storage.get(key);

        if (!value) {

            this.storage.set(key, defaultValue);
            value = defaultValue;

        }

        return value;

    }


    setStorage(key: string, value: any) {

        this.storage.set(key, value);
        this.cbList.forEach(cb => {
            cb(key, value);
        });

    }


    saveTexture(name: string, texture: TextureInfo) {

        const t = this.getStorage('textures', {});

        t[name] = texture;

        this.setStorage('textures', t);

    }
    saveTextures(textures: {name: string, texture: TextureInfo}[]) {

        const tx = this.getStorage('textures', {});

        for (let t of textures) {

            tx[t.name] = t.texture;

        }

        this.setStorage('textures', tx);

    }
    deleteTexture(name: string) {


        const t = this.getStorage('textures', {});

        delete t[name];

        this.setStorage('textures', t);

    }
    getTexture(name: string) {

        const t = this.getStorage('textures', {});

        return t[name] as TextureInfo | undefined;

    }

    getTextureImage(name: string): Promise<HTMLImageElement> | null {

        const t = this.getTexture(name);

        if (t) {

            const img = new Image();
            return new Promise((resolve, reject) => {
                img.onload = function () {

                    resolve(img);

                }
                img.src = URL.createObjectURL(t.image);
            });

        }

        return null;

    }

    getAllTextures() {

        const t = this.getStorage('textures', {});

        return t as { [name: string]: TextureInfo };

    }
}

const sceneStorage = new SceneStorage();

(window as any).storage = sceneStorage;

export { sceneStorage };