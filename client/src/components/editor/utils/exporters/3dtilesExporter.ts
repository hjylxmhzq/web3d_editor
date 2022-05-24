import { EventDispatcher, Group, Matrix4, Mesh, MeshBasicMaterial } from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";
import { Octree, OctreeNode } from "../spatialIndex/Octree";

let dirHandle: any = null;

export async function initFileSystem() {

    // open file picker, destructure the one element returned array
    dirHandle = await (window as any).showDirectoryPicker({
        excludeAcceptAllOption: true,
        types: [
            {
                description: 'all',
                accept: {
                    '*/*': ['.json', '.b3dm', '.jpeg', '.jpg']
                }
            },
        ],
        multiple: true,
    });

    const fileHandle = await dirHandle.getFileHandle('temp.json', { create: true });
    await dirHandle.removeEntry('temp.json');
    console.log(fileHandle);

}

interface LocalFile {
    name: string;
    blob: Blob;
}

export async function saveToLocal(files: LocalFile[], onProgress?: (finished: number, total: number) => void) {

    if (!dirHandle) {
        console.error('initFileSystem should be called before save');
        return;
    }

    console.log(dirHandle);

    let idx = 0;

    for (let file of files) {
        console.log('write ' + file.name);
        const fileHandle = await dirHandle.getFileHandle(file.name, { create: true });
        const ws = await fileHandle.createWritable();
        await ws.write(file.blob);
        await ws.close();
        idx++;
        onProgress && onProgress(idx, files.length);
    }

    // const url = URL.createObjectURL(blob);
    // const anchor = document.createElement('a');
    // anchor.href = url;
    // anchor.download = filename;
    // anchor.style.display = 'none';
    // document.body.append(anchor);
    // anchor.click();
    // anchor.remove();
}

interface TileNode {
    boundingVolume: {
        box: number[];
    };
    children: TileNode[];
    content?: {
        uri: string;
    };
    geometricError: number;
    refine: 'ADD' | 'REPLACE'
}


export class TilesGenerator extends EventDispatcher {
    fileList: LocalFile[] = [];
    finished = false;
    objectCount = 0;
    finishedObjectCount = 0;

    constructor() {
        super();
    }

    collectFile(file: Blob, filename: string) {
        this.fileList.push({
            name: filename,
            blob: file,
        });
    }

    async gen3dTile(octree: Octree) {

        this.fileList = [];
        this.finished = false;

        this.objectCount = octree.objects.length;
        const tileRoot = await this.processNode(octree.root);

        const tileset = {
            "asset": {
                "gltfUpAxis": "Z",
                "version": "1.0"
            },
            "root": tileRoot,
        };

        console.log(tileset);

        const tilesetBlob = new Blob([JSON.stringify(tileset)], { type: 'application/octet-stream' });

        this.collectFile(tilesetBlob, 'tileset.json');

        this.finished = true;
    }

    async processNode(ocNode: OctreeNode, parent?: TileNode) {

        const ocNodeId = this.getB3dmFilename(ocNode);

        console.log('process start: ', ocNodeId);

        const center = ocNode.position;

        const radius = ocNode.radius;

        const boundingVolumeBox: number[] = [
            center.x, center.y, center.z,
            radius, 0, 0,
            0, radius, 0,
            0, 0, radius,
        ];

        const uri = '';

        const geometricError = ocNode.objects.length ? 0 : 0;

        const children: TileNode[] = [];

        const tileNode: TileNode = {
            children,
            boundingVolume: { box: boundingVolumeBox },
            geometricError,
            refine: 'ADD'
        };

        let maxRadiusX = radius;
        let maxRadiusY = radius;
        let maxRadiusZ = radius;

        if (ocNode.objects.length) {
            const group = new Group();

            group.name = 'OctreeNode'

            for (let obj of ocNode.objects) {

                this.finishedObjectCount++;

                const obj3d = obj.object;

                const obj3dCloned = obj3d.clone() as Mesh;

                obj3dCloned.uuid = obj3d.uuid;

                // if (obj3d.parent) {

                //     obj3d.parent.updateMatrixWorld();

                //     const matrixWorld = obj3d.parent.matrixWorld as Matrix4;

                //     if (!isIdentityMatrix(matrixWorld)) {

                //         obj3dCloned.applyMatrix4(matrixWorld);

                //     }

                // }

                obj3d.updateMatrixWorld();

                const matrixWorld = obj3d.matrixWorld as Matrix4;

                matrixWorld.decompose(obj3dCloned.position, obj3dCloned.quaternion, obj3dCloned.scale);
                obj3dCloned.updateMatrixWorld();

                obj3dCloned.geometry.computeBoundingBox();
                const box = obj3dCloned.geometry.boundingBox;
                if (box) {
                    box.applyMatrix4(matrixWorld);
                    for (let v of [box.min, box.max]) {
                        const { x, y, z } = v;
                        if (Math.abs(x - center.x) > maxRadiusX) {

                            maxRadiusX = Math.abs(x - center.x);

                        }
                        if (Math.abs(y - center.y) > maxRadiusY) {

                            maxRadiusY = Math.abs(y - center.y);

                        }
                        if (Math.abs(z - center.z) > maxRadiusZ) {

                            maxRadiusZ = Math.abs(z - center.z);

                        }
                    }
                }

                group.children.push(obj3dCloned);

                this.dispatchEvent({ type: 'progress' });
            }

            if (maxRadiusX !== radius) {
                tileNode.boundingVolume.box[3] = maxRadiusX;
            }
            if (maxRadiusY !== radius) {
                tileNode.boundingVolume.box[7] = maxRadiusY;
            }
            if (maxRadiusZ !== radius) {
                tileNode.boundingVolume.box[11] = maxRadiusZ;
            }
            const filename = ocNodeId + '.b3dm';

            const b3dm = await this.genB3dm(group);

            const blob = new Blob([b3dm], { type: 'application/octet-stream' });

            tileNode.content = {
                uri: './' + filename
            }

            this.collectFile(blob, filename);

        }

        parent && parent.children.push(tileNode);

        const nodesByIndex = ocNode.nodesByIndex as Record<string, OctreeNode>;

        console.log('process end: ', ocNodeId);

        for (let octant in nodesByIndex) {
            await this.processNode(nodesByIndex[octant], tileNode);
        }

        return tileNode;
    }

    getB3dmFilename(ocNode: OctreeNode) {

        let curNode = ocNode;
        let name = `${curNode.indexOctant === undefined ? 'root' : curNode.indexOctant}`;

        while (curNode.parent) {
            curNode = curNode.parent;
            name = `${curNode.indexOctant === undefined ? 'root' : curNode.indexOctant}` + '_' + name;
        }

        return name;
    }

    genB3dm(group: Group) {

        return new Promise<Uint8Array>((resolve, reject) => {

            const gltfExporter = new GLTFExporter();

            gltfExporter.parse(group, (parsed: any) => {

                const featureTableJson = {
                    BATCH_LENGTH: 0
                };

                const b3dm = this.glbToB3dm(new Uint8Array(parsed), featureTableJson);

                resolve(b3dm);

            }, { binary: true });

        });

    }

    glbToB3dm(glbBuffer: Uint8Array, featureTableJson: Record<string, any>, featureTableBinary?: Uint8Array, batchTableJson?: Record<string, any>, batchTableBinary?: Uint8Array) {

        var headerByteLength = 28;
        var featureTableJsonBuffer = this.getJsonBufferPadded(featureTableJson, headerByteLength);
        var featureTableBinaryBuffer = this.getBufferPadded(featureTableBinary);
        var batchTableJsonBuffer = this.getJsonBufferPadded(batchTableJson);
        var batchTableBinaryBuffer = this.getBufferPadded(batchTableBinary);

        var byteLength = headerByteLength + featureTableJsonBuffer.length + featureTableBinaryBuffer.length + batchTableJsonBuffer.length + batchTableBinaryBuffer.length + glbBuffer.length;
        var header = new Uint8Array(headerByteLength);
        var dataView = new DataView(header.buffer);

        const encoder = new TextEncoder()
        const magic = encoder.encode('b3dm');
        const magicUint32 = new Uint32Array(magic.buffer);

        dataView.setUint32(0, magicUint32[0], true);                    // magic
        dataView.setUint32(4, 1, true);                                 // version
        dataView.setUint32(8, byteLength, true);                        // byteLength - length of entire tile, including header, in bytes
        dataView.setUint32(12, featureTableJsonBuffer.length, true);    // featureTableJSONByteLength - length of feature table JSON section in bytes.
        dataView.setUint32(16, featureTableBinaryBuffer.length, true);  // featureTableBinaryByteLength - length of feature table binary section in bytes.
        dataView.setUint32(20, batchTableJsonBuffer.length, true);      // batchTableJSONByteLength - length of batch table JSON section in bytes. (0 for basic, no batches)
        dataView.setUint32(24, batchTableBinaryBuffer.length, true);    // batchTableBinaryByteLength - length of batch table binary section in bytes. (0 for basic, no batches)

        return this.concatArrayBuffer([header, featureTableJsonBuffer, featureTableBinaryBuffer, batchTableJsonBuffer, batchTableBinaryBuffer, glbBuffer]);
    }

    getJsonBufferPadded(json?: Object, byteOffset: number = 0) {
        // Check for undefined or empty
        if (!json || Object.keys(json).length === 0) {
            return Buffer.alloc(0);
        }

        var string = JSON.stringify(json);

        var boundary = 8;
        var byteLength = Buffer.byteLength(string);
        var remainder = (byteOffset + byteLength) % boundary;
        var padding = (remainder === 0) ? 0 : boundary - remainder;
        var whitespace = '';
        for (var i = 0; i < padding; ++i) {
            whitespace += ' ';
        }
        string += whitespace;
        const encoder = new TextEncoder()
        const buf = encoder.encode(string)
        return buf;
    }

    getBufferPadded(buffer?: Uint8Array, byteOffset: number = 0) {
        if (!buffer) {
            return new Uint8Array();
        }

        var boundary = 8;
        var byteLength = buffer.length;
        var remainder = (byteOffset + byteLength) % boundary;
        var padding = (remainder === 0) ? 0 : boundary - remainder;
        var emptyBuffer = new Uint8Array(padding);
        return this.concatArrayBuffer([buffer, emptyBuffer]);

    }

    concatArrayBuffer(u8Arr: Uint8Array[]) {
        let totalLength = 0;

        for (let u8 of u8Arr) {

            totalLength += u8.length;

        }

        const newU8 = new Uint8Array(totalLength);
        let lastIndex = 0;

        for (let u8 of u8Arr) {

            newU8.set(u8, lastIndex);
            lastIndex += u8.length;

        }

        return newU8;
    }

}

function equalArray(array1: number[], array2: number[]) {

    return (array1.length === array2.length) && array1.every(function (element, index) {

        return element === array2[index];

    });

}

function isIdentityMatrix(matrix: Matrix4) {

    return equalArray(matrix.elements, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

}