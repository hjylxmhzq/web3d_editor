import { CanvasTexture, ClampToEdgeWrapping, Color, Face, Material, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, RepeatWrapping, Sphere, SphereBufferGeometry, Texture, Triangle, Vector2, Vector3 } from "three";
import { CONTAINED, INTERSECTED, MeshBVH, NOT_INTERSECTED } from "three-mesh-bvh";
import { customMouseEvent } from "../../Scene/customMouseEvent";
import { sceneSettings } from "../settings";
import { getCanvas, getDrawCanvas, isCanvas } from "./canvas";
import { GeoStaticUtils } from "./GeometryUtils";
import { MaterialStaticUtils } from "./MaterialUtils";
import { minMax } from "./MathUtilities";
import { sceneHistory } from "./SceneHistory";


const _v2 = new Vector2();

type PaintParams = typeof sceneSettings.paint;

const brushGeometry = new SphereBufferGeometry(1, 40, 40);
const brushMaterial = new MeshStandardMaterial({
    color: 0xEC407A,
    roughness: 0.75,
    metalness: 0,
    transparent: true,
    opacity: 0.5,
    premultipliedAlpha: true,
    emissive: 0xEC407A,
    emissiveIntensity: 0.5,
});

const brushMesh = new Mesh(brushGeometry, brushMaterial);

export function createPaintBrushMesh() {

    return brushMesh;

}

export function performPaint(bvh: MeshBVH, point: Vector3, targetMesh: Mesh, brushMesh: Mesh, params: PaintParams) {

    brushMesh.position.copy(point);
    brushMesh.visible = true;

    const inverseMatrix = new Matrix4();
    inverseMatrix.copy(targetMesh.matrixWorld).invert();

    const sphere = new Sphere();
    sphere.center.copy(brushMesh.position).applyMatrix4(inverseMatrix);
    sphere.radius = params.size;

    const indices: number[] = [];
    const tempVec = new Vector3();
    bvh.shapecast({

        intersectsBounds: box => {

            const intersects = sphere.intersectsBox(box);
            const { min, max } = box;
            if (intersects) {

                for (let x = 0; x <= 1; x++) {

                    for (let y = 0; y <= 1; y++) {

                        for (let z = 0; z <= 1; z++) {

                            tempVec.set(
                                x === 0 ? min.x : max.x,
                                y === 0 ? min.y : max.y,
                                z === 0 ? min.z : max.z
                            );
                            if (!sphere.containsPoint(tempVec)) {

                                return INTERSECTED;

                            }

                        }

                    }

                }

                return CONTAINED;

            }

            return intersects ? INTERSECTED : NOT_INTERSECTED;

        },

        intersectsTriangle: (tri: any, i, contained) => {

            if (contained || tri.intersectsSphere(sphere)) {

                const i3 = 3 * i;
                indices.push(i3, i3 + 1, i3 + 2);

            }

            return false;

        }

    });


    const color = new Color(params.color);

    let { r, g, b } = color;

    const uvAttr = targetMesh.geometry.getAttribute('uv');

    if (!uvAttr || params.verticeColor) {

        const colorAttr = targetMesh.geometry.getAttribute('color');
        const indexAttr = targetMesh.geometry.getIndex();

        if (!indexAttr) {

            throw new Error('geometry is not indexed');

        }

        if (!colorAttr) {

            return;

        }

        for (let i = 0, l = indices.length; i < l; i++) {

            const i2 = indexAttr.getX(indices[i]);
            colorAttr.setX(i2, (r * 255) >> 0);
            colorAttr.setY(i2, (g * 255) >> 0);
            colorAttr.setZ(i2, (b * 255) >> 0);

        }

        colorAttr.needsUpdate = true;

    }

}

let pending = false;
let lastMaterial: MeshStandardMaterial | MeshBasicMaterial | null = null;
let lastMesh: Mesh | null = null;
let begin = true;

export function getLastMaterial() {

    return lastMaterial;

}

async function restoreBitMapTexture() {

    if (lastMaterial && lastMaterial.map && isCanvas(lastMaterial.map.image)) {

        pending = true;


        const bitmap = await createImageBitmap(lastMaterial.map.image, {
            imageOrientation: lastMaterial.map.flipY ? 'flipY' : 'none',
        });

        lastMaterial.map.image && (lastMaterial.map.image = bitmap);

        lastMaterial.map.needsUpdate = true;

        lastMaterial.needsUpdate = true;

        lastMaterial = null;

        pending = false;

    }

}

function updateTextureHistory() {
    
    if (lastMesh && lastMaterial && lastMaterial.map && isCanvas(lastMaterial.map.image)) {

        const { width, height } = lastMaterial.map.image;

        const cvs = getCanvas();
        const curCtx = cvs.getContext('2d') as CanvasRenderingContext2D;

        const ctx = beforeImage.getContext('2d') as CanvasRenderingContext2D;
        const beforeImageData = ctx.getImageData(0, 0, width, height);
        const curImageData = curCtx.getImageData(0, 0, width, height);

        sceneHistory.addTextureChange(lastMesh, lastMaterial, beforeImageData, curImageData);
    
    }

}


customMouseEvent.onMouseUp(() => {
    
    updateTextureHistory();
    restoreBitMapTexture();
    begin = true;

});

const lastPos = new Vector3();
const lastUVPos = new Vector2();
let beforeImage = getCanvas(1000, 1000, true);

export async function performPaintOnPoint(point: Vector3, face: Face, targetMesh: Mesh, params: PaintParams) {

    if (pending) {

        return;

    }

    const materialIndex = face.materialIndex;

    let material = targetMesh.material;

    if (!Array.isArray(material)) {

        material = [material];

    }

    const m = material[materialIndex] as MeshStandardMaterial | MeshBasicMaterial;

    if (lastMaterial && m !== lastMaterial) {

        restoreBitMapTexture();
        return;

    }

    if (m !== lastMaterial) {

        lastMesh = targetMesh;
        if (m.map?.image) {

            beforeImage.width = m.map.image.width;
            beforeImage.height = m.map.image.height;

            setTimeout(() => {
                const ctx = beforeImage.getContext('2d');
                m.map && ctx?.drawImage(m.map.image, 0, 0);
            }, 0);

        }

    }

    if (lastPos.distanceTo(point) < 0.001) {

        return;

    }

    if (!m.map) {

        m.map = new Texture();

    }

    if (m.map && m.map.image) {

        const inverseMatrix = new Matrix4();
        inverseMatrix.copy(targetMesh.matrixWorld).invert();

        point = point.clone().applyMatrix4(inverseMatrix);

        const indexAttr = targetMesh.geometry.getIndex();
        const uvAttr = targetMesh.geometry.getAttribute('uv');

        if (!indexAttr) {

            throw new Error('geometry is not indexed');

        }

        if (!uvAttr) return;

        const positionAttr = targetMesh.geometry.getAttribute('position');

        const i1 = face.a;
        const i2 = face.b;
        const i3 = face.c;

        const vertices: Vector3[] = [];

        const uvs: Vector2[] = [];

        for (let vIdx of [i1, i2, i3]) {

            const x = positionAttr.getX(vIdx);
            const y = positionAttr.getY(vIdx);
            const z = positionAttr.getZ(vIdx);

            let u = uvAttr.getX(vIdx);
            let v = uvAttr.getY(vIdx);

            uvs.push(new Vector2(u, v));

            vertices.push(new Vector3(x, y, z));

        }

        const tri = new Triangle(vertices[0], vertices[1], vertices[2]);

        tri.getUV(point, uvs[0], uvs[1], uvs[2], _v2);

        GeoStaticUtils.resolveWrapUV(_v2, m.map.wrapS, m.map.wrapT);

        let image = m.map.image as ImageBitmap;

        const { width, height } = image;

        if (m.map) {

            if (isCanvas(m.map.image)) {


                const ctx = m.map.image.getContext('2d') as CanvasRenderingContext2D;
                const drawCanvas = getDrawCanvas();
                const drawCtx = drawCanvas.getContext('2d') as CanvasRenderingContext2D;

                if (ctx && drawCtx) {

                    // const avgDis3D = point.distanceTo(vertices[0]) + point.distanceTo(vertices[1]) + point.distanceTo(vertices[2]);
                    // const avgDis2D = _v2.distanceTo(uvs[0]) + _v2.distanceTo(uvs[1]) + _v2.distanceTo(uvs[2]);

                    if (m.map.wrapS === RepeatWrapping && m.map.wrapT === RepeatWrapping) {

                        for (let uv of uvs) {

                            GeoStaticUtils.resolveWrapUV(uv, m.map.wrapS, m.map.wrapT);

                        }

                    }

                    // const size = params.size / avgDis3D * avgDis2D;

                    const size = params.size * 10;

                    let radius = size >> 0;

                    if (m.map.flipY) {

                        _v2.y = 1 - _v2.y;

                    }

                    const x = _v2.x * width >> 0, y = _v2.y * height >> 0;

                    if (begin || lastUVPos.distanceTo(_v2) > 0.5) {

                        drawCtx.beginPath();
                        begin = false;

                        if (!sceneSettings.paint.closePath) {

                            drawCtx.moveTo(x, y);

                        }

                    }

                    if (sceneSettings.paint.closePath) {

                        drawCtx.fillStyle = '#' + sceneSettings.paint.color.toString(16);
                        drawCtx.arc(x, y, 1, 0, 2 * Math.PI);
                        drawCtx.fill();

                    } else {

                        drawCtx.strokeStyle = '#' + sceneSettings.paint.color.toString(16);
                        drawCtx.lineWidth = radius * 2;
                        drawCtx.lineTo(x, y);
                        drawCtx.stroke();

                    }

                    ctx.drawImage(drawCanvas, 0, 0, width, height);

                }

            } else {

                pending = true;
                if (m.map.flipY) {
                    image = await createImageBitmap(image, { imageOrientation: 'flipY' });
                }
                const cvs = getCanvas(width, height);
                getDrawCanvas(width, height);
                const ctx = cvs.getContext('2d');
                ctx?.drawImage(image, 0, 0, width, height);
                m.map.image = cvs;
                pending = false;

                if (lastMaterial && m !== lastMaterial) {

                    restoreBitMapTexture();
                    return;

                }
            }

            lastMaterial = m;
            m.map.needsUpdate = true;
            m.needsUpdate = true;

            lastPos.copy(point);
            lastUVPos.copy(_v2);

        }

    } else {

        // create an empty texture

        const size = 1024;
        const cvs = getCanvas(size, size);
        const ctx = cvs.getContext('2d');

        if (ctx) {

            ctx.clearRect(0, 0, size, size);

            pending = true;

            const imgBitMap = await createImageBitmap(cvs);

            pending = false;

            m.map.image = imgBitMap;

            m.map.needsUpdate = true;

            m.needsUpdate = true;

        }

    }

}