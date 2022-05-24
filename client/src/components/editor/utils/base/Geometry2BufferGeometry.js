import { BufferAttribute, BufferGeometry, Float32BufferAttribute } from "three";
import { DirectGeometry } from "./DirectGeometry";

export function toBufferGeometry(geometry) {

    geometry = new DirectGeometry().fromGeometry( geometry );

    const newGeo = new BufferGeometry();

    var positions = new Float32Array(geometry.vertices.length * 3);
    newGeo.setAttribute('position', new BufferAttribute(positions, 3).copyVector3sArray(geometry.vertices));

    if (geometry.normals.length > 0) {

        var normals = new Float32Array(geometry.normals.length * 3);
        newGeo.setAttribute('normal', new BufferAttribute(normals, 3).copyVector3sArray(geometry.normals));

    }

    if (geometry.colors.length > 0) {

        var colors = new Float32Array(geometry.colors.length * 3);
        newGeo.setAttribute('color', new BufferAttribute(colors, 3).copyColorsArray(geometry.colors));

    }

    if (geometry.uvs.length > 0) {

        var uvs = new Float32Array(geometry.uvs.length * 2);
        newGeo.setAttribute('uv', new BufferAttribute(uvs, 2).copyVector2sArray(geometry.uvs));

    }

    if (geometry.uvs2.length > 0) {

        var uvs2 = new Float32Array(geometry.uvs2.length * 2);
        newGeo.setAttribute('uv2', new BufferAttribute(uvs2, 2).copyVector2sArray(geometry.uvs2));

    }

    // groups

    newGeo.groups = geometry.groups;

    // morphs

    for (var name in geometry.morphTargets) {

        var array = [];
        var morphTargets = geometry.morphTargets[name];

        for (var i = 0, l = morphTargets.length; i < l; i++) {

            var morphTarget = morphTargets[i];

            var attribute = new Float32BufferAttribute(morphTarget.data.length * 3, 3);
            attribute.name = morphTarget.name;

            array.push(attribute.copyVector3sArray(morphTarget.data));

        }

        newGeo.morphAttributes[name] = array;

    }

    // skinning

    if (geometry.skinIndices.length > 0) {

        var skinIndices = new Float32BufferAttribute(geometry.skinIndices.length * 4, 4);
        newGeo.setAttribute('skinIndex', skinIndices.copyVector4sArray(geometry.skinIndices));

    }

    if (geometry.skinWeights.length > 0) {

        var skinWeights = new Float32BufferAttribute(geometry.skinWeights.length * 4, 4);
        newGeo.setAttribute('skinWeight', skinWeights.copyVector4sArray(geometry.skinWeights));

    }

    //

    if (geometry.boundingSphere !== null) {

        newGeo.boundingSphere = geometry.boundingSphere.clone();

    }

    if (geometry.boundingBox !== null) {

        newGeo.boundingBox = geometry.boundingBox.clone();

    }

    return newGeo;

}