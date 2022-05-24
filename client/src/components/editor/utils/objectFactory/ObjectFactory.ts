import { Float32BufferAttribute, Material, Mesh, Vector3 } from "three";

const triMesh = new Mesh();

export function createMeshByTriangles(vertices: Vector3[], material?: Material) {

    const positions: number[] = [];

    vertices.forEach(v => {
        
        positions.push(v.x, v.y, v.z);

    });

    if (material) {

        triMesh.material = material;
    
    }

    triMesh.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));

    return triMesh;

}
