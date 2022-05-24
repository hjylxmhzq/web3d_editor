import { Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D } from "three";
import { generateUUID } from "three/src/math/MathUtils";
import { TextureType } from "../../settings";
import { getCanvas } from "../sceneUtils/CanvasUtils";

export class SceneHistory {
    queue: HistoryItem[] = [];
    current: HistoryItem = new EmptyHistoryItem();
    head = this.current;
    objectMap = new Map<string, Object3D>();
    objectSet = new Set<Object3D>();
    attributeMap = new Map<string, Object3D>();

    constructor() {

        window.addEventListener('keydown', (e) => {

            if (e.key === 'z') {

                if (e.ctrlKey || e.metaKey) {

                    if (e.shiftKey) {

                        this.forward();

                    } else {

                        this.backward();

                    }

                }

            }
        });

    }

    getAllChangedObjects() {

        return this.objectSet;

    }

    addObject(obj: Object3D) {

        obj.updateMatrix();
        this.objectSet.add(obj);

    }

    getObject(uuid: string) {

        return this.objectMap.get(uuid);

    }

    addHisotryItem(item: HistoryItem) {
        this.current.next = item;
        item.prev = this.current;
        this.current = item;
    }

    addTransform(obj: Object3D, transform: Matrix4) {

        this.addObject(obj);
        const item = new TransformChange(transform, obj);
        this.addHisotryItem(item);

    }

    addInsertObject(obj: Object3D, parent: Object3D) {

        this.addObject(obj);

        const item = new InsertChange(obj, parent);
        this.addHisotryItem(item);

    }

    addRemoveObject(obj: Object3D, parent: Object3D) {

        this.addObject(obj);

        const item = new RemoveChange(obj, parent);
        this.addHisotryItem(item);

    }

    addTextureChange(obj: Mesh, material: MeshBasicMaterial | MeshStandardMaterial, beforemImage: ImageData, image: ImageData) {

        this.addObject(obj);
        const item = new TextureChange(obj, material, beforemImage, image, TextureType.albedo);
        this.addHisotryItem(item);

    }

    addDelta() {



    }

    async forward() {
        if (this.current.next) {

            this.current = this.current.next;

            await this.current.applyForward();

        }
    }

    async backward() {

        await this.current.applyBackward();

        if (this.current.prev) {

            this.current = this.current.prev;

        }
    }
}


enum OperationType {
    transform = 'transform',
    insert = 'insert',
    remove = 'remove',
    vertex = 'vertex',
    texture = 'texture',
    empty = 'empty'
}

abstract class HistoryItem {

    prev: HistoryItem | undefined;
    next: HistoryItem | undefined;

    constructor(public type: OperationType) {

    }

    abstract applyForward(): any;

    abstract applyBackward(): any;

}

class EmptyHistoryItem extends HistoryItem {

    constructor() {
        super(OperationType.empty)
    }

    applyBackward(): void {

    }

    applyForward(): void {

    }

}

class TransformChange extends HistoryItem {

    invertTransform: Matrix4;

    constructor(public transform: Matrix4, public object: Object3D) {

        super(OperationType.transform);
        this.invertTransform = transform.clone().invert();

    }

    applyBackward(): void {

        this.object.applyMatrix4(this.invertTransform);
        this.object.updateMatrixWorld();

    }

    applyForward(): void {

        this.object.applyMatrix4(this.transform);
        this.object.updateMatrixWorld();

    }

}

class InsertChange extends HistoryItem {

    constructor(public object: Object3D, public parent: Object3D) {

        super(OperationType.insert);

    }

    applyBackward(): void {

        this.parent.remove(this.object);

    }

    applyForward(): void {

        this.parent.add(this.object);

    }

}

class TextureChange extends HistoryItem {

    public diff: Uint8ClampedArray;
    public leftTop = [0, 0];
    public rightBottom = [0, 0];

    constructor(public object: Mesh, public material: MeshStandardMaterial | MeshBasicMaterial, beforeImage: ImageData, image: ImageData, public textureType: TextureType) {

        super(OperationType.texture);
        this.diff = this.createDiff(beforeImage, image);

    }

    createDiff(beforeImage: ImageData, image: ImageData) {

        const { data, width, height } = beforeImage;

        const diff = new Uint8ClampedArray(width * height * 4);

        let leftTop = [Infinity, Infinity];

        let rightBottom = [-Infinity, -Infinity];

        for (let i = 0; i < data.length; i += 4) {

            let y = i / 4 / width >> 0;
            let x = i / 4 % width;

            const lr = beforeImage.data[i];
            const rr = image.data[i];

            const lg = beforeImage.data[i + 1];
            const rg = image.data[i + 1];

            const lb = beforeImage.data[i + 2];
            const rb = image.data[i + 2];

            let sign = 0;
            let diffR = rr - lr;
            let diffG = rg - lg;
            let diffB = rb - lb;

            if ((diffR | diffG | diffB) !== 0) {
                if (x < leftTop[0] && y < leftTop[1]) {
                    leftTop = [x, y];
                }
                if (x > rightBottom[0] && y > rightBottom[1]) {
                    rightBottom = [x, y];
                }
            } else {
                continue;
            }

            if (diffR < 0) {
                sign |= 0b1;
                diffR = -diffR;
            }

            if (diffG < 0) {
                sign |= 0b10;
                diffG = -diffG;
            }

            if (diffB < 0) {
                sign |= 0b100;
                diffB = -diffB;
            }

            if ((diffR & diffG & diffB) > 10) {
                // debugger
            }

            diff[i] = diffR;
            diff[i + 1] = diffG;
            diff[i + 2] = diffB;
            diff[i + 3] = sign;

        }

        this.leftTop = leftTop;
        this.rightBottom = rightBottom;

        return diff;

    }

    applyDiff(image: ImageData, diff: Uint8ClampedArray, reverse = false) {

        const { data, width, height } = image;

        for (let i = 0; i < data.length; i += 4) {

            let diffR = diff[i];
            let diffG = diff[i + 1];
            let diffB = diff[i + 2];
            const sign = diff[i + 3];

            if (sign & 0b1) {
                diffR = -diffR;
            }

            if (sign & 0b10) {
                diffG = -diffG;
            }

            if (sign & 0b100) {
                diffB = -diffB;
            }

            if (diffR | diffG | diffB) {
                if (!reverse) {
                    data[i] = data[i] + diffR;
                    data[i + 1] = data[i + 1] + diffG;
                    data[i + 2] = data[i + 2] + diffB;
                    data[i + 3] = 255;
                } else {
                    data[i] = data[i] - diffR;
                    data[i + 1] = data[i + 1] - diffG;
                    data[i + 2] = data[i + 2] - diffB;
                    data[i + 3] = 255;
                }
            }

        }

        return data;

    }

    async applyBackward() {

        if (this.material.map) {

            const { width, height } = this.material.map.image;

            const cvs = getCanvas(width, height);
            const ctx = cvs.getContext('2d');
            if (ctx) {

                ctx.drawImage(this.material.map.image, 0, 0);
                const imageData = ctx.getImageData(0, 0, width, height);
                const newImageArray = this.applyDiff(imageData, this.diff, true);
                const newImageData = new ImageData(newImageArray, width, height);
                ctx.putImageData(newImageData, 0, 0, 0, 0, width, height);

            }

            const bitMap = await createImageBitmap(cvs);

            this.material.map.image = bitMap;
            this.material.map.needsUpdate = true;

        }

    }

    async applyForward() {

        if (this.material.map) {

            const { width, height } = this.material.map.image;

            const cvs = getCanvas(width, height);
            const ctx = cvs.getContext('2d');
            if (ctx) {

                ctx.drawImage(this.material.map.image, 0, 0);
                const imageData = ctx.getImageData(0, 0, width, height);
                const newImageArray = this.applyDiff(imageData, this.diff, false);
                const newImageData = new ImageData(newImageArray, width, height);
                ctx.putImageData(newImageData, 0, 0, 0, 0, width, height);

            }

            const bitMap = await createImageBitmap(cvs);

            this.material.map.image = bitMap;
            this.material.map.needsUpdate = true;

        }

    }

}

class RemoveChange extends HistoryItem {

    constructor(public object: Object3D, public parent: Object3D) {

        super(OperationType.insert);

    }

    applyBackward(): void {

        this.parent.add(this.object);

    }

    applyForward(): void {

        this.parent.remove(this.object);

    }

}

const sceneHistory = new SceneHistory();

(window as any).sceneHistory = sceneHistory;

export {
    sceneHistory,
}