import { CanvasTexture, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, Object3D, PerspectiveCamera, Plane, PlaneBufferGeometry, Raycaster, Texture, TextureLoader, Vector3 } from "three";
import { getCanvas } from "./canvas";

export function updateBaseMapCenter(lng: number, lat: number) {



}

function getResolution(lat: number, level: number) {

    return (Math.cos(lat * Math.PI / 180) * 2 * Math.PI * 6378137) / (256 << level);
    // return 156543.03 * Math.pow(2, -level);

}

function googleMapUrlFactory(x: number, y: number, z: number) {

    const url = `http://mt3.google.cn/vt/lyrs=s&hl=zh-CN&gl=cn&x=${x >> 0}&y=${y >> 0}&z=${z}`;
    return url;

}

function bingMapUrlFactory(lng: number, lat: number, z: number) {

    const EarthRadius = 6378137;
    const MinLatitude = -85.05112878;
    const MaxLatitude = 85.05112878;
    const MinLongitude = -180;
    const MaxLongitude = 180;

    function getMapSize(levelOfDetail: number) {

        return 256 << levelOfDetail;

    }

    function clip(n: number, minValue: number, maxValue: number) {

        return Math.min(Math.max(n, minValue), maxValue);

    }

    function latLongToPixelXY(latitude: number, longitude: number, levelOfDetail: number) {
        latitude = clip(latitude, MinLatitude, MaxLatitude);
        longitude = clip(longitude, MinLongitude, MaxLongitude);

        let x = (longitude + 180) / 360;
        let sinLatitude = Math.sin(latitude * Math.PI / 180);
        let y = 0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI);

        let mapSize = getMapSize(levelOfDetail);
        let pixelX = clip(x * mapSize + 0.5, 0, mapSize - 1);
        let pixelY = clip(y * mapSize + 0.5, 0, mapSize - 1);

        return [pixelX, pixelY];
    }

    function pixelXYToTileXY(pixelX: number, pixelY: number) {

        const tileX = pixelX / 256;
        const tileY = pixelY / 256;

        return [tileX, tileY];
    }

    function TileXYToQuadKey(x: number, y: number, z: number) {

        let quadKey = '';
        for (let i = z; i > 0; i--) {
            let digit = 0;
            let mask = 1 << (i - 1);
            if ((x & mask) != 0) {
                digit++;
            }
            if ((y & mask) != 0) {
                digit++;
                digit++;
            }
            quadKey += digit;
        }


    }



    const url = `https://ecn.t1.tiles.virtualearth.net/tiles/a0131.jpeg?g=${''}`;
}

export class BaseMap extends Object3D {

    group = new Group();
    raycaster = new Raycaster();
    plane = new Plane(new Vector3(0, 1, 0));
    constructor(public camera: PerspectiveCamera, public centerLon: number, public centerLat: number, public level: number) {

        super();
        this.group.rotateX(-0.5 * Math.PI);
        this.add(this.group);

    }

    update() {

        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        const intersect = new Vector3();
        this.raycaster.ray.intersectPlane(this.plane, intersect);
        console.log(intersect);
        return true;

    }

}

export function createBaseMapPlane(lng: number, lat: number, level: number) {

    const z = level;

    const resolution = getResolution(lat, z) + 0.15;

    const tileCount = 40;

    const sizePerTile = 256;

    let mapSize = sizePerTile * tileCount;

    const cvs = getCanvas(mapSize, mapSize, true);

    const texture = new CanvasTexture(cvs);

    const material = new MeshBasicMaterial({ map: texture });

    let planeSize = mapSize * resolution;

    const plane = new PlaneBufferGeometry(planeSize, planeSize, 1, 1);

    const planeMesh = new Mesh(plane, material);

    planeMesh.rotateX(-0.5 * Math.PI);

    let x = Math.pow(2, z - 1) * (lng / 180 + 1);

    let y = Math.pow(2, z - 1) * (1 - (Math.log(Math.tan(Math.PI * lat / 180) + (1 / Math.cos(Math.PI * lat / 180))) / Math.PI))

    // const url = `https://a.tile.openstreetmap.org/${z}/${x >> 0}/${y >> 0}.png`;

    // const url = `http://shangetu1.map.bdimg.com/it/u=x=${x >> 0};y=${y >> 0};z=${z};v=009;type=sate&fm=46&udt=20130506`

    const rx = x % 1;
    const ry = y % 1;

    x = x >> 0;
    y = y >> 0;

    let seg = tileCount;

    const callbacks: { radius: number; cb: () => void }[] = [];

    async function loadTiledMap() {

        const ctx = cvs.getContext('2d');

        if (!ctx) return;

        for (let i = 0; i < seg; i++) {

            for (let j = 0; j < seg; j++) {

                const nx = x + (i - seg / 2);
                const ny = y + (j - seg / 2);

                const url = googleMapUrlFactory(nx, ny, z);

                const cb = async () => {
                    const image = await loadImage(url);
                    ctx?.drawImage(image, (i - rx) * sizePerTile, (j - ry) * sizePerTile, sizePerTile, sizePerTile);
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