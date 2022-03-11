import { CanvasTexture, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneBufferGeometry, Texture, TextureLoader } from "three";
import { getCanvas } from "./canvas";


let mapSize = 5000;

const cvs = getCanvas(mapSize, mapSize, true);

const texture = new CanvasTexture(cvs);

const material = new MeshBasicMaterial({ map: texture });

const plane = new PlaneBufferGeometry(1000, 1000, 2, 2);

const planeMesh = new Mesh(plane, material);

planeMesh.rotateX(-0.5 * Math.PI);

export function updateBaseMapCenter(lng: number, lat: number) {



}

export function createBaseMapPlane(lng: number, lat: number, level: number) {

    const z = level;

    let x = Math.pow(2, z - 1) * (lng / 180 + 1);

    let y = Math.pow(2, z - 1) * (1 - (Math.log(Math.tan(Math.PI * lat / 180) + (1 / Math.cos(Math.PI * lat / 180))) / Math.PI))

    // const url = `https://a.tile.openstreetmap.org/${z}/${x >> 0}/${y >> 0}.png`;

    // const url = `http://shangetu1.map.bdimg.com/it/u=x=${x >> 0};y=${y >> 0};z=${z};v=009;type=sate&fm=46&udt=20130506`

    function urlFactory(x: number, y: number, z: number) {

        const url = `http://mt3.google.cn/vt/lyrs=s&hl=zh-CN&gl=cn&x=${x >> 0}&y=${y >> 0}&z=${z}`;
        return url;

    }

    x = x >> 0;
    y = y >> 0;

    let seg = 20;

    const sizePerTile = mapSize / seg;

    const callbacks: { radius: number; cb: () => void }[] = [];

    async function loadTiledMap() {

        const ctx = cvs.getContext('2d');

        if (!ctx) return;

        for (let i = 0; i < seg; i++) {

            for (let j = 0; j < seg; j++) {

                const nx = x + (i - seg / 2);
                const ny = y + (j - seg / 2);

                const url = urlFactory(nx, ny, z);

                const cb = async () => {
                    const image = await loadImage(url);
                    ctx?.drawImage(image, i * sizePerTile, j * sizePerTile, sizePerTile, sizePerTile);
                    texture.needsUpdate = true;
                    material.needsUpdate = true;
                }

                const radius = Math.pow(x - nx, 2) + Math.pow(y - ny, 2);

                callbacks.push({
                    radius,
                    cb,
                });

            }

        }
        
        callbacks.sort((a, b) => a.radius - b.radius);

        for (let cb of callbacks) {

            cb.cb();

        }

    }


    function loadImage(url: string): Promise<HTMLImageElement> {

        const image = document.createElement('img');
        image.crossOrigin = 'anonymous';
        return new Promise((resolve, reject) => {
            image.addEventListener('load', () => {
                resolve(image);
            });
            image.src = url;
        });

    }

    loadTiledMap();


    return planeMesh;

}