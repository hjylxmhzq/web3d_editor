import { Frustum, Matrix4, Mesh, Object3D, PerspectiveCamera, Vector3 } from "three";

const _frustum = new Frustum();

const _tmpPoint = new Vector3();

const _vecNear = new Vector3();
const _vecTopLeft = new Vector3();
const _vecTopRight = new Vector3();
const _vecDownRight = new Vector3();
const _vecDownLeft = new Vector3();

const _center = new Vector3();
const _vectemp1 = new Vector3();
const _vectemp2 = new Vector3();
const _vectemp3 = new Vector3();
const _matrix = new Matrix4();

export function rectCast(camera: PerspectiveCamera, startPoint: Vector3, endPoint: Vector3, obj: Object3D) {

    const collection: Mesh[] = [];

    updateFrustum(camera, startPoint, endPoint);

    searchChildInFrustum(_frustum, obj, collection);

    return collection;
}

function searchChildInFrustum(frustum: Frustum, object: Object3D, collection: Mesh[]) {


    if (object instanceof Mesh) {

        if (object.geometry.boundingSphere === null) object.geometry.computeBoundingSphere();

        _center.copy(object.geometry.boundingSphere.center);

        _center.applyMatrix4(object.matrixWorld);

        if (frustum.containsPoint(_center)) {

            collection.push(object);

        }

    }


    if (object.children.length > 0) {

        for (let x = 0; x < object.children.length; x++) {

            searchChildInFrustum(frustum, object.children[x], collection);

        }

    }

}



function updateFrustum(camera: PerspectiveCamera, startPoint: Vector3, endPoint: Vector3) {

    startPoint = startPoint;
    endPoint = endPoint;

    // Avoid invalid frustum

    if (startPoint.x === endPoint.x) {

        endPoint.x += Number.EPSILON;

    }

    if (startPoint.y === endPoint.y) {

        endPoint.y += Number.EPSILON;

    }

    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    if (camera.isPerspectiveCamera) {

        _tmpPoint.copy(startPoint);
        _tmpPoint.x = Math.min(startPoint.x, endPoint.x);
        _tmpPoint.y = Math.max(startPoint.y, endPoint.y);
        endPoint.x = Math.max(startPoint.x, endPoint.x);
        endPoint.y = Math.min(startPoint.y, endPoint.y);

        _vecNear.setFromMatrixPosition(camera.matrixWorld);
        _vecTopLeft.copy(_tmpPoint);
        _vecTopRight.set(endPoint.x, _tmpPoint.y, 0);
        _vecDownRight.copy(endPoint);
        _vecDownLeft.set(_tmpPoint.x, endPoint.y, 0);

        _vecTopLeft.unproject(camera);
        _vecTopRight.unproject(camera);
        _vecDownRight.unproject(camera);
        _vecDownLeft.unproject(camera);

        // const geometry = new BufferGeometry();
        // geometry.setAttribute('position', new Float32BufferAttribute([
        //   _vecNear.x, _vecNear.y, _vecNear.z,
        //   _vecTopLeft.x, _vecTopLeft.y, _vecTopLeft.z,
        //   _vecTopRight.x, _vecTopRight.y, _vecTopRight.z,
        //   _vecNear.x, _vecNear.y, _vecNear.z,
        //   _vecTopLeft.x, _vecTopLeft.y, _vecTopLeft.z,
        //   _vecDownLeft.x, _vecDownLeft.y, _vecDownLeft.z,
        //   _vecNear.x, _vecNear.y, _vecNear.z,
        //   _vecDownLeft.x, _vecDownLeft.y, _vecDownLeft.z,
        //   _vecDownRight.x, _vecDownRight.y, _vecDownRight.z,
        //   _vecNear.x, _vecNear.y, _vecNear.z,
        //   _vecTopRight.x, _vecTopRight.y, _vecTopRight.z,
        //   _vecDownRight.x, _vecDownRight.y, _vecDownRight.z,
        // ], 3));

        // const colorNear = new Color();
        // colorNear.setRGB(1, 0, 0);
        // const colorFar = new Color();
        // colorFar.setRGB(0, 0, 1);
        // geometry.setAttribute('color', new Float32BufferAttribute([
        //   colorNear.r, colorNear.g, colorNear.b, 0.5,
        //   colorFar.r, colorFar.g, colorFar.b, 0.5,
        //   colorFar.r, colorFar.g, colorFar.b, 0.5,
        //   colorNear.r, colorNear.g, colorNear.b, 0.5,
        //   colorFar.r, colorFar.g, colorFar.b, 0.5,
        //   colorFar.r, colorFar.g, colorFar.b, 0.5,
        //   colorNear.r, colorNear.g, colorNear.b, 0.5,
        //   colorFar.r, colorFar.g, colorFar.b, 0.5,
        //   colorFar.r, colorFar.g, colorFar.b, 0.5,
        //   colorNear.r, colorNear.g, colorNear.b, 0.5,
        //   colorFar.r, colorFar.g, colorFar.b, 0.5,
        //   colorFar.r, colorFar.g, colorFar.b, 0.5,
        // ], 4));
        // geometry.computeBoundingSphere();
        // const material = new MeshBasicMaterial({
        //   color: 0xaaaaaa,
        //   side: DoubleSide,
        //   vertexColors: true,
        //   opacity: 0.5
        // });
        // const mesh = new Mesh(geometry, material);
        // this.helperGroup.clear();
        // this.helperGroup.add(mesh);

        _vectemp1.copy(_vecTopLeft).sub(_vecNear);
        _vectemp2.copy(_vecTopRight).sub(_vecNear);
        _vectemp3.copy(_vecDownRight).sub(_vecNear);
        _vectemp1.normalize();
        _vectemp2.normalize();
        _vectemp3.normalize();

        _vectemp1.multiplyScalar(Number.MAX_VALUE);
        _vectemp2.multiplyScalar(Number.MAX_VALUE);
        _vectemp3.multiplyScalar(Number.MAX_VALUE);
        _vectemp1.add(_vecNear);
        _vectemp2.add(_vecNear);
        _vectemp3.add(_vecNear);

        const planes = _frustum.planes;

        planes[0].setFromCoplanarPoints(_vecNear, _vecTopLeft, _vecTopRight);
        planes[1].setFromCoplanarPoints(_vecNear, _vecTopRight, _vecDownRight);
        planes[2].setFromCoplanarPoints(_vecDownRight, _vecDownLeft, _vecNear);
        planes[3].setFromCoplanarPoints(_vecDownLeft, _vecTopLeft, _vecNear);
        planes[4].setFromCoplanarPoints(_vecTopRight, _vecDownRight, _vecDownLeft);
        planes[5].setFromCoplanarPoints(_vectemp3, _vectemp2, _vectemp1);
        planes[5].normal.multiplyScalar(- 1);

    } else {

        console.error('THREE.SelectionBox: Unsupported camera type.');

    }

}