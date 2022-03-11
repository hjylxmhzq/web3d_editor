
const offscreenCanvas = document.createElement('canvas');

export function getCanvas(width?: number, height?: number, renew = false, clear = false, clearColor = 0xeeeeee) {

    if (renew) {
        const offscreenCanvas = document.createElement('canvas');

        if (!width || !height) {

            return offscreenCanvas;

        }

        offscreenCanvas.width = width;
        offscreenCanvas.height = height;

        return offscreenCanvas;
    }

    if (!width || !height) {

        return offscreenCanvas;

    }

    offscreenCanvas.width = width;
    offscreenCanvas.height = height;

    if (clear) {
        const ctx = offscreenCanvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#' + clearColor.toString(16);
            ctx.fillRect(0, 0, width, height);
        }
    }

    return offscreenCanvas;

}

export function isCanvas(cvs: any) {

    return cvs instanceof HTMLCanvasElement;

}