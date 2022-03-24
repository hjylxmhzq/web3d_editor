import { DebugTilesRenderer, TilesRenderer } from "3d-tiles-renderer";
import { Box3, Matrix4, Mesh, Object3D, Quaternion, Sphere, Vector3 } from "three";
import { SceneInfo } from "..";

export function load3DTile(threeScene: SceneInfo, resource: string) {

    function rotationBetweenDirections(dir1: Vector3, dir2: Vector3) {

        const rotation = new Quaternion();
        const a = new Vector3().crossVectors(dir1, dir2);
        rotation.x = a.x;
        rotation.y = a.y;
        rotation.z = a.z;
        rotation.w = 1 + dir1.clone().dot(dir2);
        rotation.normalize();

        return rotation;

    }

    function moveToTile(tiles: any) {
        const box = new Box3();
        const sphere = new Sphere();
        const matrix = new Matrix4();

        let position = new Vector3();
        let distanceToEllipsoidCenter = 0;

        if (tiles.getOrientedBounds(box, matrix)) {

            position = new Vector3().setFromMatrixPosition(matrix);
            distanceToEllipsoidCenter = position.length();

        } else if (tiles.getBoundingSphere(sphere)) {

            position = sphere.center.clone();
            distanceToEllipsoidCenter = position.length();

        }

        const surfaceDirection = position.normalize();
        const up = new Vector3(0, 1, 0);
        const rotationToNorthPole = rotationBetweenDirections(surfaceDirection, up);

        tiles.group.quaternion.x = rotationToNorthPole.x;
        tiles.group.quaternion.y = rotationToNorthPole.y;
        tiles.group.quaternion.z = rotationToNorthPole.z;
        tiles.group.quaternion.w = rotationToNorthPole.w;

        tiles.group.position.y = -distanceToEllipsoidCenter;

    }
    const { camera, scene, renderer } = threeScene;
    // const tilesRenderer = new DebugTilesRenderer(resource);
    const tilesRenderer = new TilesRenderer(resource);
    // tilesRenderer.displayBoxBounds = true;
    tilesRenderer.maxDepth = 2;
    tilesRenderer.onLoadTileSet = () => {
        // moveToTile(tilesRenderer);
    }
    tilesRenderer.onLoadModel = (scene, tile) => {
        scene.traverse((m: Object3D) => {
            (m as any).tile = tile;
        });
    }
    tilesRenderer.stopAtEmptyTiles = false;
    tilesRenderer.setCamera(camera);
    tilesRenderer.setResolutionFromRenderer(camera, renderer);

    return tilesRenderer;
}