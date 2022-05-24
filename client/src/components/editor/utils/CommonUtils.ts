import { Object3D } from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";

export function normalizeMousePosition<T extends { x: number, y: number }>(mouse: T, clientWidth: number, clientHeight: number) {
    mouse.x = (mouse.x / clientWidth) * 2 - 1;
    mouse.y = - (mouse.y / clientHeight) * 2 + 1;
    return mouse;
}

(window as any).parseModel = function (model: Object3D) {

    const gltfExporter = new GLTFExporter();

    gltfExporter.parse(model, (parsed) => {
        console.log('parsed: ', parsed);
        const bf = parsed as ArrayBuffer;
        const blob = new Blob([bf], { type: 'application/octet-stream' });
        const anchor = document.createElement('a');
        anchor.download = 'model.glb';
        const url = URL.createObjectURL(blob);
        anchor.href = url;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
    }, { binary: true });
}


export interface InsertItem<T> {

    index: number;
    items: T[];

}

export function insertToArray<T>(arr: T[], insertList: InsertItem<T>[]) {

    insertList.sort((a, b) => b.index - a.index > 1 ? 1 : -1);

    const newArr: T[] = [];

    let oldIdx = 0;

    let nextInsert = insertList.pop();

    if (!nextInsert) {

        return arr.slice();

    }

    while (oldIdx < arr.length) {

        if (nextInsert && oldIdx === nextInsert.index) {

            newArr.push(...nextInsert.items);

            nextInsert = insertList.pop();

        } else {

            newArr.push(arr[oldIdx]);

            oldIdx++;

        }

    }

    while (nextInsert?.index === oldIdx) {

        newArr.push(...nextInsert.items);

        nextInsert = insertList.pop();

    }

    return newArr;

}

export function debounce(fn: (...args: any[]) => void, delay = 500) {

    let timer: number;

    return function (...args: any[]) {

        clearTimeout(timer);

        timer = window.setTimeout(() => {

            fn(...args);

        }, delay);

    }


}

export function nextTick() {
    return new Promise((resolve, reject) => {
        requestAnimationFrame(() => {
            resolve(undefined);
        });
    })
}