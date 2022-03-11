import { BufferGeometry, Color, Face, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from "three";
import { getIndexArray } from "./GeometryUtils";

const mesh = new Mesh(
    new BufferGeometry(),
    new MeshBasicMaterial({ color: new Color('red'), depthTest: true, transparent: true, opacity: 0.5 })
);

export function getTrianglesHighlightMesh() {

    return mesh;

}

export function updateHighlightTriangle(targetMesh: Mesh, faceIndexSet: Set<number>) {

    const indexAttr = getIndexArray(targetMesh);
    let normalAttr = targetMesh.geometry.getAttribute('normal');

    if (!normalAttr) {

        targetMesh.geometry.computeVertexNormals();
        normalAttr = targetMesh.geometry.getAttribute('normal');

    }

    const positionAttr = targetMesh.geometry.getAttribute('position');

    const vertices: number[] = [];

    const index: number[] = [];

    let idx = 0;

    faceIndexSet.forEach(faceIndex => {

        const i1 = indexAttr[faceIndex * 3];
        const i2 = indexAttr[faceIndex * 3 + 1];
        const i3 = indexAttr[faceIndex * 3 + 2];

        for (let vIdx of [i1, i2, i3]) {

            let x = positionAttr.getX(vIdx);
            let y = positionAttr.getY(vIdx);
            let z = positionAttr.getZ(vIdx);

            const nx = normalAttr.getX(vIdx);
            const ny = normalAttr.getY(vIdx);
            const nz = normalAttr.getZ(vIdx);

            const n = new Vector3(nx, ny, nz);

            n.normalize().multiplyScalar(0.001);

            x += n.x;
            y += n.y;
            z += n.z;

            vertices.push(x, y, z);

            index.push(idx++);

        }

    })

    mesh.geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    mesh.geometry.setIndex(index);

    targetMesh.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.updateMatrixWorld();
    mesh.geometry.computeVertexNormals();

    return mesh;

}