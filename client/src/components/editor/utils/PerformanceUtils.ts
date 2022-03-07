import { BufferGeometry, Camera, FrontSide, Matrix4, Mesh, Object3D, PerspectiveCamera, Raycaster, Vector2 } from "three";
import { CENTER, MeshBVH } from "three-mesh-bvh";
import { SimplifyModifier } from "./SimplifyModifier";
import { normalizeMousePosition } from "./common";

const simplifyModifier = new SimplifyModifier();

export function checkBVHPerformance(camera: PerspectiveCamera, modelMesh: Mesh) {

    const costList = [];
    const raycastCostList = [];

    const simplifyModifier = new SimplifyModifier();

    let face = 1000000;

    let i = 2;

    const raycaster = new Raycaster();

    const invMat = new Matrix4();

    // invMat.copy(modelMesh.matrixWorld).invert();

    const x = (document.documentElement.clientWidth / 2) >> 0;
    const y = (document.documentElement.clientHeight / 2) >> 0;

    let mouse = new Vector2(x, y);

    mouse = normalizeMousePosition(mouse);

    raycaster.setFromCamera(mouse, camera);

    const ray = raycaster.ray.clone();

    ray.applyMatrix4(invMat);

    const clientWidth = document.documentElement.clientWidth;

    const clientHeight = document.documentElement.clientHeight;

    console.log('center ', clientWidth / 2, clientHeight / 2);

    for (; face > 2000;) {
        // for (let i = 0; i < 8000; i += 500) {

        const geo = simplifyModifier.modify(modelMesh.geometry, i, false);

        if (!geo) {

            console.log('no geo, return');

            return;

        };
        face = geo.getAttribute('position').count || 0 / 3;

        // const geo = new SphereBufferGeometry(20, i, 6);
        // face = geo.getIndex()?.count || 0 / 3;
        const start = performance.now();
        const boundsTree = new MeshBVH(geo as any, { strategy: CENTER });
        const end = performance.now();

        let raycastCost = 0;
        const raycastStart = performance.now();

        for (let x = 10; x < clientWidth; x += 10) {

            for (let y = 10; y < clientHeight; y += 10) {


                let mouse = new Vector2(x, y);

                mouse = normalizeMousePosition(mouse);

                raycaster.setFromCamera(mouse, camera);

                invMat.copy(modelMesh.matrixWorld).invert();

                const ray = raycaster.ray;

                ray.applyMatrix4(invMat);


                const hit = boundsTree.raycast(ray, FrontSide);


                if (hit.length) {


                } else {

                    // console.log('not hit', x, y);

                }

            }
        }

        const raycastEnd = performance.now();

        raycastCost += raycastEnd - raycastStart;

        const cost = { time: end - start, face, raycastCost };

        console.log(cost);
        i += 500;

        costList.push(cost);
    }

    console.log(costList);

}



export function simulateSimplify(geo: BufferGeometry) {

    const timeList: any = [];

    let i = 0;

    function runner() {
        i += 0.1;
        if (i > 0.91) {
            console.log(timeList);
            return;
        }
        const startTime = performance.now();
        const geo1 = simplifyModifier.modify(geo, i, true);
        // const geo2 = simplifyModifierOrigin.modify(geo, i, true);
        // console.log(geo, geo1, geo2);
        const endTime = performance.now();
        const cost = (endTime - startTime) / 1000;
        timeList.push({ count: 1 - i, cost });
        console.log(`simplify: ${i} vertices, cost: ${cost}s`);
        requestAnimationFrame(runner);
    }

    runner();

}