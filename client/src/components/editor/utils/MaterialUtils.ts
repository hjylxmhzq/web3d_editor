import { Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D } from "three";
import { generateUUID } from "three/src/math/MathUtils";
import { sceneStorage, TextureInfo } from "../store";
import { getCanvas } from "./canvas";

export const MaterialStaticUtils = {
    getFirstMaterial(mesh: Mesh, index = 0) {

        let m = mesh.material;

        if (!m) {

            return null;

        }

        if (!Array.isArray(m)) {

            m = [m];

        }

        return m[index] as MeshBasicMaterial | MeshStandardMaterial;

    },
    getAllMaterial(mesh: Mesh, index = 0) {

        let m = mesh.material;

        if (!m) {

            return [];

        }

        if (!Array.isArray(m)) {

            m = [m];

        }

        return m as MeshBasicMaterial[] | MeshStandardMaterial[];

    },

    getTexture(mesh: Mesh) {

        const m = this.getFirstMaterial(mesh);

        if (m) {

            return m.map;

        }

        return null;

    },

    async collectTextures(obj: Object3D) {

        let collections: { name: string, texture: TextureInfo }[] = [];

        await collect(obj);

        sceneStorage.saveTextures(collections);

        async function collect(obj: Object3D) {
            if (obj instanceof Mesh) {

                let mList = obj.material;

                if (mList) {

                    if (!Array.isArray(mList)) {
                        mList = [mList];
                    }

                    for (let m of mList) {

                        if (m instanceof MeshBasicMaterial || m instanceof MeshStandardMaterial) {
                            const img = m.map?.image
                            if (img instanceof ImageBitmap) {
                                const cvs = getCanvas(img.width, img.height);
                                const ctx = cvs.getContext('2d');
                                if (ctx) {
                                    ctx.drawImage(img, 0, 0, img.width, img.height);
                                    const blob = await canvasToBlob(cvs);
                                    const name = m.uuid || generateUUID();
                                    collections.push({ name, texture: { type: 'albedo', image: blob, width: img.width, height: img.height } });
                                }
                            }
                        }

                    }

                }

            }

            for (let child of obj.children) {

                await collect(child);

            }

        }

    }
}

function canvasToBlob(cvs: HTMLCanvasElement) {

    return new Promise<Blob>((resolve, reject) => {
        cvs.toBlob((blob) => {
            if (!blob) {
                reject();
                return;
            }
            resolve(blob);
        });
    })

}