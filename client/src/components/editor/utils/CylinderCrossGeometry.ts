import { DoubleSide, Group, Line, Line3, Matrix4, Mesh, MeshStandardMaterial, Plane, Quaternion, SphereBufferGeometry } from "three";
import { BufferGeometry, Color, Float32BufferAttribute, LineBasicMaterial, LineSegments, MeshBasicMaterial, Vector3 } from "three";


export function createCylinderCross(
    t1Start: Vector3 = new Vector3(-10, 0, -10),
    t1End: Vector3 = new Vector3(10, 0, 10),
    r1: number = 5,
    t2Start: Vector3 = new Vector3(0, 0, 3),
    t2End: Vector3 = new Vector3(0, 10, 10),
    r2: number = 3
) {

    const xAxis = new Vector3(1, 0, 0);
    const yAxis = new Vector3(0, 1, 0);
    const zAxis = new Vector3(0, 0, 1);

    if (r2 > r1) {

        // swap v1 & v2
        [t1Start, t2Start] = [t2Start, t1Start];
        [t1End, t2End] = [t2End, t1End];
        [r1, r2] = [r2, r1];

    }

    let t1Dir = t1End.clone().sub(t1Start).normalize();

    const rotateAxis = t1Dir.clone().cross(zAxis).normalize();
    const angleToZ = t1Dir.clone().angleTo(zAxis);
    const rotateMatrix1 = new Matrix4();
    rotateMatrix1.makeRotationAxis(rotateAxis, angleToZ);

    for (let v of [t1Start, t1End, t2Start, t2End]) {

        v.applyAxisAngle(rotateAxis, angleToZ);

    }

    t1Dir = t1End.clone().sub(t1Start).normalize();
    const t2Dir = t2End.clone().sub(t2Start).normalize();
    const crossDir = t2Dir.cross(new Vector3(0, 0, 1)).normalize();
    const angleToX = crossDir.angleTo(xAxis);
    const rotateMatrix2 = new Matrix4();
    rotateMatrix2.makeRotationAxis(zAxis, angleToX);

    for (let v of [t1Start, t1End, t2Start, t2End]) {

        v.applyAxisAngle(zAxis, 2 * Math.PI - angleToX);

    }

    const xzPlane = new Plane(yAxis, 0);

    const xzPlaneIntersect = new Vector3();
    xzPlane.intersectLine(new Line3(t2Start, t2End), xzPlaneIntersect);
    const offsetZ = -xzPlaneIntersect.z;
    const offsetX = -t1Start.x;
    const offsetY = -t1Start.y;

    const translateMatrix = new Matrix4().makeTranslation(offsetX, offsetY, offsetZ);

    for (let v of [t1Start, t1End, t2Start, t2End]) {

        v.applyMatrix4(translateMatrix);

    }

    const transform = rotateMatrix1.premultiply(rotateMatrix2).premultiply(translateMatrix);

    if (t2Start.z < t2End.z) {
        [t2Start, t2End] = [t2End, t2Start];
    }

    const e = t2Start.x;

    // segments of circle
    const seg = 100;

    const v1 = t1Start;
    const v2 = t1End;

    const tube1 = v1.clone().sub(v2);
    const tube1Len = tube1.length();
    tube1.normalize();

    const v3 = t2Start;
    const v4 = t2End;

    const tube2 = v3.clone().sub(v4);
    const tube2Len = tube2.length();
    tube2.normalize();

    const alpha = tube1.angleTo(tube2);

    const step = 2 * Math.PI / seg;

    function calCrossLine() {

        const lineVertices = [];

        const signY = 1;

        for (let rad = 0; rad < 2 * Math.PI; rad += step) {

            const x = -e + r2 * Math.cos(rad);

            const signZ = rad > Math.PI ? 1 : -1;

            const y = signY * Math.sqrt(r1 ** 2 - x ** 2);
            const z = (1 / Math.sin(alpha)) * ((signZ * Math.sqrt(r2 ** 2 - (x + e) ** 2) - y * Math.cos(alpha)));

            lineVertices.push(new Vector3(x, y, z));

        }

        return lineVertices;

    }

    const lineVertices = calCrossLine();

    const geometry = new BufferGeometry();

    const position = [];

    const index = [];

    const basicMaterial = new MeshStandardMaterial({ color: new Color(0xaaaaaa), side: DoubleSide, flatShading: false, wireframe: false });

    const plane = new Plane();

    plane.setFromNormalAndCoplanarPoint(tube2, new Vector3(0, 0, 0));


    for (let i = 0; i < lineVertices.length; i++) {

        const v1 = lineVertices[i];
        const dist1 = plane.distanceToPoint(v1);
        const v1Far = v1.clone().add(tube2.clone().multiplyScalar(tube2Len - dist1));

        const v2Idx = (i + 1) % lineVertices.length;

        const v2 = lineVertices[v2Idx];
        const dist2 = plane.distanceToPoint(v2);
        const v2Far = v2.clone().add(tube2.clone().multiplyScalar(tube2Len - dist2));

        const idx = position.length / 3;

        position.push(
            v1.x, v1.y, v1.z,
            v1Far.x, v1Far.y, v1Far.z,
            v2.x, v2.y, v2.z,
            v2Far.x, v2Far.y, v2Far.z,
        );

        index.push(idx + 2, idx + 1, idx, idx + 1, idx + 2, idx + 3);

    }

    function calZ(x: number) {

        const y = 1 * Math.sqrt(r1 ** 2 - x ** 2);
        const z1 = (1 / Math.sin(alpha)) * ((1 * Math.sqrt(r2 ** 2 - (x + e) ** 2) - y * Math.cos(alpha)));
        const z2 = (1 / Math.sin(alpha)) * ((-1 * Math.sqrt(r2 ** 2 - (x + e) ** 2) - y * Math.cos(alpha)));

        return [z1, z2].sort();

    }

    const t2Step = r2 * step / r1;

    for (let rad = 0; rad < 2 * Math.PI;) {

        let x1 = r1 * Math.cos(rad);
        let y1 = r1 * Math.sin(rad);

        let x2 = r1 * Math.cos(rad + step);
        let y2 = r1 * Math.sin(rad + step);

        let z1 = v1.z;
        let z2 = v2.z;

        if (x1 >= -e - r2 && x1 <= -e + r2 && y1 > 0
            && x2 >= -e - r2 && x2 <= -e + r2 && y2 > 0
        ) {

            if (x1 > -e + r2 && x2 <= -e + r2) {

                x2 = -e + r2 - Number.EPSILON;
                rad = Math.acos(x2 / r1);
                y2 = r1 * Math.sin(rad);

                let idx = position.length / 3;

                position.push(
                    x1, y1, z1,
                    x1, y1, z2,
                    x2, y2, z1,
                    x2, y2, z2,
                );

                index.push(idx, idx + 1, idx + 2, idx + 3, idx + 2, idx + 1);

            } else {

                rad += t2Step;


                const [z1Near, z1Far] = calZ(x1);

                const [z2Near, z2Far] = calZ(x2);

                let idx = position.length / 3;

                position.push(
                    x1, y1, z1,
                    x1, y1, z1Near,
                    x2, y2, z1,
                    x2, y2, z2Near,
                );

                index.push(idx + 2, idx + 1, idx, idx + 1, idx + 2, idx + 3);

                idx = position.length / 3;

                position.push(
                    x1, y1, z1Far,
                    x1, y1, z2,
                    x2, y2, z2Far,
                    x2, y2, z2,
                );

                index.push(idx + 2, idx + 1, idx, idx + 1, idx + 2, idx + 3);

            }

        } else {

            let idx = position.length / 3;

            position.push(
                x1, y1, z1,
                x1, y1, z2,
                x2, y2, z1,
                x2, y2, z2,
            );

            index.push(idx + 2, idx + 1, idx, idx + 1, idx + 2, idx + 3);

            rad += step;
        }

    }

    geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();

    const mesh = new Mesh(geometry, basicMaterial);

    mesh.applyMatrix4(transform.invert());

    return mesh;

}
