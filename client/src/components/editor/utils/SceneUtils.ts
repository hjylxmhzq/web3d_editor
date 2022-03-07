import { Intersection, Mesh, Object3D, Ray, Raycaster } from "three";

export function disableShadow(obj: Object3D) {

    obj.castShadow = false;
    obj.receiveShadow = false;
    
    for (let child of obj.children) {

        disableShadow(child);

    }

}

export function enableShadow(obj: Object3D) {

    obj.castShadow = true;
    obj.receiveShadow = true;

    for (let child of obj.children) {

        enableShadow(child);

    }

}

export function raycastMesh(obj: Object3D, raycaster: Raycaster, intersects: Intersection[]) {

    if (obj instanceof Mesh) {

        obj.raycast(raycaster, intersects);

    }

    for (let child of obj.children) {

        raycastMesh(child, raycaster, intersects);

    }

}