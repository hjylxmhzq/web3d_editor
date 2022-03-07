import { BufferGeometry, Color, Face, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from "three";

const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial({ color: new Color('red'), depthTest: false }));

const group = new Group();

group.add(mesh);

export function getTrianglesHighlightMesh() {

    return group;

}

export function updateHighlightTriangle(targetMesh: Mesh, face: Face) {

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

    const vertices: number[] = [];

    const index: number[] = [];

    let idx = 0;

    for (let vIdx of [i1, i2, i3]) {

        const x = positionAttr.getX(vIdx);
        const y = positionAttr.getY(vIdx);
        const z = positionAttr.getZ(vIdx);

        vertices.push(x, y, z);

        index.push(idx++);

    }

    mesh.geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    mesh.geometry.setIndex(index);

    group.position.set(0, 0, 0);
    group.scale.set(1, 1, 1);
    group.quaternion.identity();

    group.applyMatrix4(targetMesh.matrixWorld);
    mesh.geometry.computeVertexNormals();

    return mesh;

}