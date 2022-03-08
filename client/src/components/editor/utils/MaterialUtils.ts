import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Vector2 } from "three";
import { generateUUID } from "three/src/math/MathUtils";
import { sceneStorage, TextureInfo } from "../store";
import { getCanvas } from "./canvas";
import { getIndexArray, splitTriangles } from "./GeometryUtils";

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

    createGridUVs(mesh: Mesh) {

        const geometry = mesh.geometry;

        splitTriangles(geometry);

        const indexArr = getIndexArray(mesh);

        const triCount = indexArr.length / 3 >> 0;

        const rectPerRow = Math.sqrt(triCount / 2) >> 0;

        const rectEdgeLen = 1 / rectPerRow;

        let uv1 = new Vector2();
        let uv2 = new Vector2();
        let uv3 = new Vector2();

        let uvs: number[] = [];

        for (let i = 0; i < triCount; i++) {

            const row = (i + 1) / (rectPerRow * 2) >> 0;

            const line = i % (rectPerRow * 2) >> 1;

            if (i % 2 === 0) {

                uv1.set(line * rectEdgeLen, row * rectEdgeLen);
                uv2.set(line * rectEdgeLen, row * rectEdgeLen + rectEdgeLen);
                uv3.set(line * rectEdgeLen + rectEdgeLen, row * rectEdgeLen + rectEdgeLen);

            } else {

                uv1.set(line * rectEdgeLen, row * rectEdgeLen);
                uv2.set(line * rectEdgeLen + rectEdgeLen, row * rectEdgeLen + rectEdgeLen);
                uv3.set(line * rectEdgeLen + rectEdgeLen, row * rectEdgeLen);

            }

            uvs.push(uv1.x, uv1.y, uv2.x, uv2.y, uv3.x, uv3.y);

        }

        geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));

        return geometry;

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

