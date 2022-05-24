
const offscreenCanvas = document.createElement('canvas');
const drawCanvas = document.createElement('canvas');

const ctx = offscreenCanvas.getContext('2d') as CanvasRenderingContext2D;
ctx.imageSmoothingEnabled = true;

const drawCtx = drawCanvas.getContext('2d') as CanvasRenderingContext2D;
drawCtx.imageSmoothingEnabled = true;

export function getCanvas(width?: number, height?: number, renew = false, clear = false, clearColor = 0xeeeeee) {

    if (renew) {
        const offscreenCanvas = document.createElement('canvas');

        if (!width || !height) {

            return offscreenCanvas;

        }

        if (clear) {
            const ctx = offscreenCanvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#' + clearColor.toString(16);
                ctx.fillRect(0, 0, width, height);
            }
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

export function getDrawCanvas(width?: number, height?: number, renew = false, clear = false, clearColor = 0xeeeeee) {


    if (!width || !height) {

        return drawCanvas;

    }

    drawCanvas.width = width;
    drawCanvas.height = height;

    if (clear) {
        const ctx = drawCanvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#' + clearColor.toString(16);
            ctx.fillRect(0, 0, width, height);
        }
    }

    return drawCanvas;

}

function exportCanvasToPNG(drawCanvas: boolean = false) {

    const canvas = drawCanvas ? getDrawCanvas() : getCanvas();
    canvas.toBlob((blob) => {

        if (blob) {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'texture';
            a.click();
        }

    });

}

(window as any).exportCanvasToPNG = exportCanvasToPNG;

export function isCanvas(cvs: any) {

    return cvs instanceof HTMLCanvasElement;

}