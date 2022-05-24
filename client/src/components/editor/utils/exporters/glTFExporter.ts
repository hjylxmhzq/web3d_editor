import { Object3D } from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";

export function exportGLTF(model: Object3D) {

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