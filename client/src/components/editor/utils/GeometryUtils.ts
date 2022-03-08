import { BufferGeometry, ClampToEdgeWrapping, Color, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Material, Matrix4, Mesh, Object3D, Quaternion, RepeatWrapping, Vector2, Vector3, Wrapping } from "three";
import { mergeBufferGeometries } from "three/examples/jsm/utils/BufferGeometryUtils";
import { generateUUID } from "three/src/math/MathUtils";
import simplifyMesh from "./SimplifyModifierTexture";
import Delaunator from 'delaunator';


let _v0 = new Vector3();
let _v1 = new Vector3();
let _v2 = new Vector3();
let _v3 = new Vector3();

export function mergeMesh(model: Object3D) {
    model.traverse(m => {
        const materials = [];
        const geos = [];
        const meshes = [];
        let matrix = null;
        for (let i = 0; i < m.children.length; i++) {
            const c = m.children[i];
            if (!matrix) {
                matrix = c.matrix;
            }
            if (c instanceof Mesh) {
                materials.push(c.material);
                geos.push(c.geometry);
                meshes.push(c);
            }
        }

        if (meshes.length) {

            const newGeo = mergeBufferGeometries(geos, true);
            const newMesh = new Mesh(newGeo, materials);
            matrix && (newMesh.matrix = matrix);
            newMesh.matrixWorldNeedsUpdate = true;

            for (let c of meshes) {

                m.remove(c);

            }

            const simplifiedGeo = simplifyMesh(newGeo, 0.1, true);

            newMesh.geometry = simplifiedGeo;

            m.add(newMesh);
        }

    });
}

export function mergeMeshesInGroup(model: Object3D, useGroup = true) {

    model.traverse(m => {

        m.name = generateUUID();

        if (!(m instanceof Mesh)) {

            const childAllMesh = m.children.every(m => {

                return m instanceof Mesh;

            });

            if (childAllMesh) {

                const allGeo: BufferGeometry[] = [];

                const allMaterial: Material[] = [];

                const allMesh: Mesh[] = [];

                m.children.forEach((m: any) => {

                    allGeo.push(m.geometry);

                    allMaterial.push(m.material);

                    allMesh.push(m);

                });

                const newGeo = mergeBufferGeometries(allGeo, useGroup);

                const newMesh = new Mesh(newGeo, allMaterial);

                for (let c of allMesh) {

                    m.remove(c);

                }

                newMesh.name = generateUUID();

                m.add(newMesh);

            }

        }

    });

    console.log('model merged');

}


export function dulplicateMesh(mesh: Mesh, n: number) {

    const group = new Group();

    for (let i = -n; i <= n; i++) {

        for (let j = -n; j <= n; j++) {

            const newModel = mesh.clone(true);
            newModel.position.set(i * 25, 0, j * 25);
            group.add(newModel);

        }
    }

    return group;
}


export function getPoints(mesh: Mesh) {
    let pointsArray = mesh.geometry.attributes.position.array;
    let itemSize = mesh.geometry.attributes.position.itemSize;

    let points = [];

    for (let i = 0; i < pointsArray.length; i += itemSize) {
        points.push(new Vector3(pointsArray[i], pointsArray[i + 1], pointsArray[i + 2]));
    }

    return points;
}

export function getAllPoints(mesh: Mesh) {
    const index = mesh.geometry.getIndex();
    let pointsArray = mesh.geometry.attributes.position.array;
    let itemSize = mesh.geometry.attributes.position.itemSize;

    let points = [];

    if (index) {
        const ia = index.array;
        for (let i = 0; i < ia.length; i++) {
            const p1 = ia[i];
            points.push(new Vector3(
                pointsArray[p1 * itemSize],
                pointsArray[p1 * itemSize + 1],
                pointsArray[p1 * itemSize + 2],
            ));
        }
    } else {
        return getPoints(mesh);
    }

    return points;
}

export function splitTriangles(geo: BufferGeometry) {

    const uvs: number[] = [];
    const index: number[] = [];
    const position: number[] = [];
    const color: number[] = [];

    const posAttr = geo.getAttribute('position');
    const colorAttr = geo.getAttribute('color');

    const indexAttr = geo.getIndex();

    if (!indexAttr) {

        const index = getIndexArray(geo);
        geo.setIndex(Array.from(index));
        return;

    }

    for (let i = 0; i < indexAttr.count; i++) {

        const vIdx = indexAttr.getX(i);

        const x = posAttr.getX(vIdx);
        const y = posAttr.getY(vIdx);
        const z = posAttr.getZ(vIdx);

        position.push(x, y, z);


        if (colorAttr) {

            const x = colorAttr.getX(vIdx);
            const y = colorAttr.getY(vIdx);
            const z = colorAttr.getZ(vIdx);

            if (colorAttr.itemSize === 4) {

                const w = colorAttr.getW(vIdx);

                color.push(x, y, z, w);

            } else {

                color.push(x, y, z);

            }

        }

        index.push(i);

    }

    geo.setAttribute('position', new Float32BufferAttribute(position, 3));

    geo.deleteAttribute('uv');

    if (color.length) {

        geo.setAttribute('color', new Float32BufferAttribute(color, 3));

    }

    const groupCount = index.length / 3000 >> 0;

    const countPerGroup = index.length / groupCount >> 0;

    for (let i = 0; i < groupCount; i++) {

        if (i === groupCount - 1) {

            geo.addGroup(i * countPerGroup, index.length - i * countPerGroup, 0);
            break;
        }

        geo.addGroup(i * countPerGroup, countPerGroup, 0);

    }

    geo.setIndex(index);

    geo.deleteAttribute('normal');

    geo.computeVertexNormals();

    return geo;

}


export function getIndexArray(geo: Mesh | BufferGeometry) {

    if (geo instanceof Mesh) {

        geo = geo.geometry;

    }

    let index = geo.getIndex()?.array;
    if (!index) {

        index = Array.from({ length: geo.getAttribute('position').count });
        for (let i = 0; i < index.length; i++) {

            (index as any)[i] = i;

        }

    }

    return index;
}

let lastMesh: Mesh | null = null;
let lastGroup: Group | null = null;

export function refitMeshEdge() {

    if (lastMesh && lastGroup) {

        lastMesh.updateMatrixWorld();
        lastMesh.matrixWorld.decompose(lastGroup.position, lastGroup.quaternion, lastGroup.scale);

    }

}

export function createMeshEdge(mesh: Mesh, depthTest = false, color: Color = new Color(0x00ffff)) {

    lastMesh = mesh;

    const indexArr = getIndexArray(mesh);

    let normal = mesh.geometry.getAttribute('normal');
    let position = mesh.geometry.getAttribute('position');

    if (!normal) {
        mesh.geometry.computeVertexNormals();
        normal = mesh.geometry.getAttribute('normal');
    }

    const geometry = new BufferGeometry();
    const array = [];

    for (let i = 0; i < indexArr.length; i += 3) {

        const vs: Vector3[] = [];

        for (let j = i; j < i + 3; j++) {

            const vIdx = indexArr[j];

            const x = position.getX(vIdx);
            const y = position.getY(vIdx);
            const z = position.getZ(vIdx);

            const nx = normal.getX(vIdx);
            const ny = normal.getY(vIdx);
            const nz = normal.getZ(vIdx);

            const n = new Vector3(nx, ny, nz).normalize().multiplyScalar(0.01);
            const v = new Vector3(x, y, z);

            v.add(n);

            vs.push(v);

        }

        for (let j = 0; j < vs.length; j++) {

            const j1 = (j + 1) % vs.length;

            array.push(
                vs[j].x, vs[j].y, vs[j].z,
                vs[j1].x, vs[j1].y, vs[j1].z,
            );

        }

    }

    geometry.setAttribute('position', new Float32BufferAttribute(array, 3));
    const material = new LineBasicMaterial({ color, depthTest, transparent: true, opacity: 0.5 });
    material.linewidth = 2;
    const line = new LineSegments(geometry, material);
    function emptyRaycast() { }

    const group = new Group();
    lastGroup = group;
    group.raycast = emptyRaycast;
    mesh.updateMatrixWorld();
    mesh.matrixWorld.decompose(group.position, group.quaternion, group.scale);
    group.renderOrder = 999;
    group.add(line);

    return group;

}


class Vertex {

    faces: Set<Triangle> = new Set();

    uv: Vector2 = new Vector2();

    joinPoints: Set<Vertex> = new Set();

    id: number = 0;

    constructor(public x: number, public y: number, public z: number) {

    }

    searchJointFaces() {

        const faces = new Set(this.faces);

        for (let p of Array.from(this.joinPoints)) {

            for (let f of Array.from(p.faces)) {

                faces.add(f);

            }

        }

        return faces;

    }
}


class Triangle {

    materialIndex: number = -1;

    id = 0;

    constructor(public v1: Vertex, public v2: Vertex, public v3: Vertex) {

        for (let v of [v1, v2, v3]) {

            v.faces.add(this);

            for (let vv of Array.from(v.joinPoints)) {

                vv.faces.add(this);

            }

        }

    }

    removeSelfFromJointVertices() {

        const { v1, v2, v3 } = this;

        for (let v of [v1, v2, v3]) {

            v.faces.delete(this);

            for (let vv of Array.from(v.joinPoints)) {

                vv.faces.delete(this);

            }

        }

    }

    getNormal() {

        const { v1, v2, v3 } = this;

        const vc1 = new Vector3(v1.x, v1.y, v1.z);
        const vc2 = new Vector3(v2.x, v2.y, v2.z);
        const vc3 = new Vector3(v3.x, v3.y, v3.z);

        const target = new Vector3();

        GeoStaticUtils.getNormal(vc1, vc2, vc3, target);

        return target;

    }

    searchJointFace() {

        const { v1, v2, v3 } = this;

        const faces = new Set<Triangle>();

        for (let v of [v1, v2, v3]) {

            const _faces = v.searchJointFaces();

            for (let f of Array.from(_faces)) {

                faces.add(f);

            }

        }

        return faces;

    }

    getUV(point: Vector3) {

        const { v1, v2, v3 } = this;

        const vc1 = new Vector3(v1.x, v1.y, v1.z);
        const vc2 = new Vector3(v2.x, v2.y, v2.z);
        const vc3 = new Vector3(v3.x, v3.y, v3.z);

        const uv1 = v1.uv;
        const uv2 = v2.uv;
        const uv3 = v3.uv;

        const target = new Vector2();

        GeoStaticUtils.getUV(point, vc1, vc2, vc3, uv1, uv2, uv3, target);

        return target;

    }

}

export class GeometryOperator {

    faces: Triangle[] = [];

    vertices: Vertex[] = [];

    hasUV = false;

    hasGroup = false;

    constructor(public geo: BufferGeometry) {

        this.hasGroup = !!geo.groups.length;

        const faces: Triangle[] = [];

        const vertices: Vertex[] = [];

        const position = geo.getAttribute('position');

        const uv = geo.getAttribute('uv');

        this.hasUV = !!uv;

        let index = geo.getIndex()?.array;

        if (!index) {

            console.warn('no index found in geometry');

            index = Array.from({ length: position.count }).map((_, i) => i);

        }

        const hashTable: Record<string, Vertex[]> = {};

        for (let i = 0; i < position.count; i++) {

            const x = position.getX(i);
            const y = position.getY(i);
            const z = position.getZ(i);

            const vertex = new Vertex(x, y, z);

            vertices.push(vertex);

            if (uv) {

                const x = uv.getX(i);
                const y = uv.getY(i);

                vertex.uv = new Vector2(x, y);

            }

            const key = this.hashKey(x, y, z);

            if (hashTable[key]) {

                for (let v of hashTable[key]) {

                    v.joinPoints.add(vertex);

                    vertex.joinPoints.add(v);

                }

                hashTable[key].push(vertex);

            } else {

                hashTable[key] = [vertex];

            }

        }

        for (let i = 0; i < index.length; i += 3) {

            const a = index[i];
            const b = index[i + 1];
            const c = index[i + 2];

            const va = vertices[a];
            const vb = vertices[b];
            const vc = vertices[c];

            const face = new Triangle(va, vb, vc);

            face.id = Math.floor(i / 3);

            if (this.hasGroup) {

                const groupId = this.searchIndexGroup(i);

                const g = this.geo.groups[groupId];

                face.materialIndex = g.materialIndex || 0;

            }

            faces.push(face);

        }

        this.faces = faces;

        this.vertices = vertices;

    }

    searchIndexGroup(index: number) {

        const groups = this.geo.groups;

        for (let i = 0; i < groups.length; i++) {

            const g = groups[i];

            if (index >= g.start && index < g.start + g.count) {

                return i;

            }

        }

        console.warn('can not find correct group id');

        return 0;

    }


    rebuild() {

        const index = [];

        const newVertices: Vertex[] = [];

        const verticesSet = new Set();

        const faces = this.faces.slice();

        if (this.hasGroup) {

            faces.sort((f1, f2) => {

                return f1.materialIndex - f2.materialIndex;

            });

        }

        let groups: typeof this.geo.groups = [];

        for (let face of faces) {

            if (this.hasGroup) {

                const groupId = face.materialIndex;

                if (groups[groupId]) {

                    groups[groupId].count += 3;

                } else {

                    if (groupId === 0) {

                        groups[groupId] = {
                            start: 0,
                            count: 3,
                            materialIndex: groupId
                        }

                    } else {

                        groups[groupId] = {
                            start: groups[groupId - 1].start + groups[groupId - 1].count,
                            count: 3,
                            materialIndex: groupId
                        }

                    }

                }

            }


            const { v1, v2, v3 } = face;

            for (let v of [v1, v2, v3]) {

                if (verticesSet.has(v)) {

                    index.push(v.id);

                } else {

                    newVertices.push(v);

                    verticesSet.add(v);

                    v.id = newVertices.length - 1;

                    index.push(newVertices.length - 1);

                }

            }

        }

        const position = [];

        const uv = [];

        for (let v of newVertices) {

            position.push(v.x, v.y, v.z);

            if (this.hasUV) {

                uv.push(v.uv.x, v.uv.y);

            }

        }

        const newGeo = new BufferGeometry();

        newGeo.setAttribute('position', new Float32BufferAttribute(position, 3));

        if (this.hasUV) {

            newGeo.setAttribute('uv', new Float32BufferAttribute(uv, 2));

        }

        newGeo.setIndex(index);

        newGeo.computeVertexNormals();

        if (this.hasGroup) {

            for (let g of groups) {

                newGeo.addGroup(g.start, g.count, g.materialIndex);

            }

        }

        return newGeo;

    }


    addFace(face: Triangle) {

        if (this.hasGroup && face.materialIndex === -1) {

            console.error('face should have materialIndex in grouped geometry');

        }

        face.id = this.faces.length;

        this.faces.push(face);

    }

    removeFace(face: Triangle) {

        const id = face.id;

        this.faces.splice(id, 1);

        for (let i = id; i < this.faces.length; i++) {

            this.faces[i].id--;

        }

    }

    addLoopFaceInFace(faceIndex: number) {

        const face = this.faces[faceIndex];

        const { v1, v2, v3 } = face;

        const vc1 = GeoStaticUtils.vertexToVector3(v1);
        const vc2 = GeoStaticUtils.vertexToVector3(v2);
        const vc3 = GeoStaticUtils.vertexToVector3(v3);

        const mid12 = new Vector3().addVectors(vc1, vc2).multiplyScalar(0.5);
        const mid23 = new Vector3().addVectors(vc2, vc3).multiplyScalar(0.5);
        const mid31 = new Vector3().addVectors(vc3, vc1).multiplyScalar(0.5);

        const vl = [];

        for (let nv of [mid12, mid23, mid31]) {

            const newVertex = new Vertex(nv.x, nv.y, nv.z);
            this.vertices.push(newVertex);

            vl.push(newVertex);

            if (this.hasUV) {

                newVertex.uv = face.getUV(nv);

            }

        }

        const face1 = new Triangle(v1, vl[0], vl[2]);
        const face2 = new Triangle(v2, vl[1], vl[0]);
        const face3 = new Triangle(v3, vl[2], vl[1]);
        const face4 = new Triangle(vl[0], vl[1], vl[2]);

        for (let f of [face1, face2, face3, face4]) {

            f.materialIndex = face.materialIndex;

            this.addFace(f);

        }

        face.removeSelfFromJointVertices();

        this.removeFace(face);

    }

    addVerticeInFace(faceIndex: number, point: Vector3) {

        const face = this.faces[faceIndex];

        face.removeSelfFromJointVertices();

        this.removeFace(face);

        const newVertex = new Vertex(point.x, point.y, point.z);

        this.vertices.push(newVertex);

        const { v1, v2, v3 } = face;


        if (this.hasUV) {

            newVertex.uv = face.getUV(point);

        }

        const face1 = new Triangle(v1, v2, newVertex);
        const face2 = new Triangle(v2, v3, newVertex);
        const face3 = new Triangle(v3, v1, newVertex);

        for (let f of [face1, face2, face3]) {

            f.materialIndex = face.materialIndex;

            this.addFace(f);

        }

    }


    removeAllJointFacesByFace(faceIndex: number) {

        const face = this.faces[faceIndex];

        const _faces = Array.from(face.searchJointFace());

        this.reTriangulation(_faces, [face.v1, face.v2, face.v3]);

        for (let f of _faces) {

            f.removeSelfFromJointVertices();

            this.removeFace(f);

        }

    }


    removeAllJointFacesByFaceVertex(faceIndex: number, vertexIndex: number) {

        const face = this.faces[faceIndex];

        const { v1, v2, v3 } = face;

        const vertex = ([v1, v2, v3])[vertexIndex % 3];

        const _faces = vertex.searchJointFaces();

        for (let f of Array.from(_faces)) {

            f.removeSelfFromJointVertices();

            this.removeFace(f);

        }

    }


    reTriangulation(removedFaces: Triangle[], removedVertices: Vertex[]) {

        const allVertices: Vertex[] = [];

        const faceAvgNormal = new Vector3();

        for (let f of removedFaces) {

            faceAvgNormal.add(f.getNormal());

            const { v1, v2, v3 } = f;

            for (let v of [v1, v2, v3]) {


                if (removedVertices.indexOf(v) === -1) {

                    allVertices.push(v);

                }

            }

        }

        faceAvgNormal.normalize();

        const rotateMatrix = new Matrix4();

        const quaternion = new Quaternion();

        const yDirection = new Vector3(0, 1, 0);

        quaternion.setFromUnitVectors(faceAvgNormal, yDirection);

        rotateMatrix.makeRotationFromQuaternion(quaternion);

        const hashTable: Record<string, Vertex[]> = {};

        const uniqueVertices: Vertex[] = [];

        for (let v of allVertices) {

            const key = this.hashKey(v.x, v.y, v.z);

            if (hashTable[key]) {

                hashTable[key].push(v);

            } else {

                uniqueVertices.push(v);

                hashTable[key] = [];

            }

        }

        const coords: number[] = [];

        for (let v of uniqueVertices) {

            const vc = new Vector3(v.x, v.y, v.z);

            vc.applyMatrix4(rotateMatrix);

            coords.push(vc.x, vc.z);

        }

        const delaunay = new Delaunator(coords);

        for (let i = 0; i < delaunay.triangles.length; i += 3) {

            const a = delaunay.triangles[i];
            const b = delaunay.triangles[i + 1];
            const c = delaunay.triangles[i + 2];

            const v1 = uniqueVertices[a];
            const v2 = uniqueVertices[b];
            const v3 = uniqueVertices[c];

            const sharedFace = this.findSharedFace(v1, v2, v3);

            const face = new Triangle(v1, v2, v3);

            if (sharedFace) {

                face.materialIndex = sharedFace.materialIndex;

            } else {

                face.materialIndex = v1.faces.values().next().value.materialIndex;

            }

            this.addFace(face);

        }

    }

    findSharedFace(v1: Vertex, v2: Vertex, v3: Vertex) {

        for (let f of Array.from(v1.faces)) {

            if (v2.faces.has(f) && v3.faces.has(f)) {

                return f;

            }

        }

        return null;

    }


    removeFromArray<T>(arr: T[], obj: T) {

        const index = arr.indexOf(obj);

        if (index !== -1) {

            arr.splice(index);

            return true;

        }

        console.warn('remove an obj which is not exist in array');

        return false;

    }


    hashKey(x: number, y: number, z: number) {

        const tolerance = 1e-4;

        const decimalShift = Math.log10(1 / tolerance);
        const shiftMultiplier = Math.pow(10, decimalShift);

        const hash = `${~ ~(x * shiftMultiplier)},${~ ~(y * shiftMultiplier)},${~ ~(z * shiftMultiplier)}`;

        return hash;

    }



}


export const GeoStaticUtils = {

    resolveWrapUV(uv: Vector2, wrapS: Wrapping, wrapT: Wrapping) {


        if (wrapS === ClampToEdgeWrapping) {

            if (uv.x > 1) {
                uv.x = 1;
            } else if (uv.x < 0) {
                uv.x = 0;
            }

        } else if (wrapS === RepeatWrapping) {

            if (uv.x > 1) {
                uv.x %= 1;
            } else if (uv.x < 0) {
                uv.x %= 1;
                uv.x += 1;
            }

        }

        if (wrapT === ClampToEdgeWrapping) {

            if (uv.y > 1) {
                uv.y = 1;
            } else if (uv.y < 0) {
                uv.y = 0;
            }

        } else if (wrapT === RepeatWrapping) {

            if (uv.y > 1) {
                uv.y %= 1;
            } else if (uv.y < 0) {
                uv.y %= 1;
                uv.y += 1;
            }

        }

    },

    midpoint2D(a: number, b: number) {

        return (Math.abs(b - a) / 2) + Math.min(a, b);

    },

    vertexToVector3(v: Vertex) {

        return new Vector3(v.x, v.y, v.z);

    },

    getBarycoord(point: Vector3, a: Vector3, b: Vector3, c: Vector3, target: Vector3) {

        _v0.subVectors(c, a);
        _v1.subVectors(b, a);
        _v2.subVectors(point, a);

        const dot00 = _v0.dot(_v0);
        const dot01 = _v0.dot(_v1);
        const dot02 = _v0.dot(_v2);
        const dot11 = _v1.dot(_v1);
        const dot12 = _v1.dot(_v2);

        const denom = (dot00 * dot11 - dot01 * dot01);

        // collinear or singular triangle
        if (denom === 0) {

            // arbitrary location outside of triangle?
            // not sure if this is the best idea, maybe should be returning undefined
            return target.set(- 2, - 1, - 1);

        }

        const invDenom = 1 / denom;
        const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

        // barycentric coordinates must always sum to 1
        return target.set(1 - u - v, v, u);

    },

    getUV(point: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, uv1: Vector2, uv2: Vector2, uv3: Vector2, target: Vector2) {

        this.getBarycoord(point, p1, p2, p3, _v3);

        target.set(0, 0);
        target.addScaledVector(uv1, _v3.x);
        target.addScaledVector(uv2, _v3.y);
        target.addScaledVector(uv3, _v3.z);

        return target;

    },

    getNormal(a: Vector3, b: Vector3, c: Vector3, target: Vector3) {

        target.subVectors(c, b);
        _v0.subVectors(a, b);
        target.cross(_v0);

        const targetLengthSq = target.lengthSq();
        if (targetLengthSq > 0) {

            return target.multiplyScalar(1 / Math.sqrt(targetLengthSq));

        }

        return target.set(0, 0, 0);

    }
}