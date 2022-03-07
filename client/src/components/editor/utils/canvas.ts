
const offscreenCanvas = document.createElement('canvas');

export function getCanvas(width?: number, height?: number) {

    if (!width || !height) {

        return offscreenCanvas;

    }

    offscreenCanvas.width = width;
    offscreenCanvas.height = height;

    return offscreenCanvas;

}

export function isCanvas(cvs: any) {

    return cvs instanceof HTMLCanvasElement;

}