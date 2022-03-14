import earcut from 'earcut';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, FrontSide, Group, Matrix4, Mesh, MeshStandardMaterial, RepeatWrapping, Texture, Vector2, Vector3 } from "three";
import { sceneSettings } from '../settings';
import { getCanvas } from './canvas';
import { loadCubeTexture } from './CubeTexture';
import { projectFromLonLat } from './projections';


export function parseGeoJson(jsonStr: string, center: Vector2) {

  const json = JSON.parse(jsonStr);

  const group = new Group();

  if (json.type === 'FeatureCollection') {

    const features = json.features;

    for (let feature of features) {

      if (feature.type === 'Feature' && feature.geometry?.type === 'Polygon') {

        const mesh = buildBuildingFeature(feature, 1, center);

        if (mesh) {

          group.add(mesh);

        }

      } else if (feature.type === 'Feature' && feature.geometry?.type === 'Point') {


      } else {

        console.log('unknown feature', feature);

      }

    }

  } else {

    console.log('GeoJson has no feature collection field');

  }

  group.scale.z = -1;
  group.updateMatrixWorld();

  console.log('geojson group', group);

  return group;

}

function getCenter(coords: [number, number][]) {

  let minX = Infinity;
  let maxX = -Infinity;

  let minY = Infinity;
  let maxY = -Infinity;

  for (let [x, y] of coords) {

    if (x < minX) {
      minX = x;
    } else if (x > maxX) {
      maxX = x;
    }

    if (y < minY) {
      minY = y;
    } else if (y > maxY) {
      maxY = y;
    }

  }

  const center = new Vector2((minX + maxX) / 2, (minY + maxY) / 2);

  return center;

}


function buildBuildingFeature(feature: any, floorHeight = 1, center = new Vector2(0, 0)) {

  const geometry = feature.geometry;

  const floors = parseInt(feature.properties.height || '1');
  const height = floors * floorHeight;

  if (geometry.type === 'Polygon') {

    const positions = [];

    const index = [];

    let idx = 0;

    const geo = new BufferGeometry();

    const geoCoords = geometry.coordinates.map((coords: [number, number][]) => {

      return coords.map(([lon, lat]) => {

        let [x, y] = projectFromLonLat(lon, lat);
        return [x, y];

      });

    });

    let uvRepeatX = 100;
    // let uvRepeatY = floorHeight * 3;
    let uvRepeatY = 100;

    let inited = false;
    let offset: Vector2 = new Vector2();
    let curCenter: Vector2 = new Vector2();

    let uvs: number[] = [];

    for (let coords of geoCoords) {


      if (!inited) {

        inited = true;
        curCenter = getCenter(coords);
        offset = curCenter.clone().sub(center);
        curCenter.multiplyScalar(-1);

      }

      coords.forEach((coord: [number, number]) => {

        coord[0] += curCenter.x;
        coord[1] += curCenter.y;

      });

      let count = 0;
      let start = idx;

      let sumEdgeLength = 0;

      const v1 = new Vector2();
      const v2 = new Vector2();

      for (let i = 0; i < coords.length - 1; i++) {

        const p1 = coords[i];
        const p2 = coords[i + 1];

        v1.x = p1[0];
        v1.y = p1[1];
        v2.x = p2[0];
        v2.y = p2[1];

        const dis = v1.distanceTo(v2);
        sumEdgeLength += dis;

        uvs.push(
          (sumEdgeLength - dis) / uvRepeatX, 0,
          sumEdgeLength / uvRepeatX, 0,
          (sumEdgeLength - dis) / uvRepeatX, height / uvRepeatY,
          sumEdgeLength / uvRepeatX, height / uvRepeatY,
        );

        positions.push(
          p1[0], 0, p1[1],
          p2[0], 0, p2[1],
          p1[0], height, p1[1],
          p2[0], height, p2[1],
        )

        index.push(
          idx, idx + 2, idx + 1,
          idx + 2, idx + 3, idx + 1,
        )

        count += 6;
        idx += 4;

      }

      geo.addGroup(start, count, 0);

    }

    const data = earcut.flatten(geoCoords);
    const triangles = earcut(data.vertices, data.holes, data.dimensions);

    let count = 0;

    for (let i = 0; i < triangles.length; i += 3) {

      const a = triangles[i];
      const b = triangles[i + 1];
      const c = triangles[i + 2];

      const v1x = data.vertices[a * 2];
      const v1y = data.vertices[a * 2 + 1];

      const v2x = data.vertices[b * 2];
      const v2y = data.vertices[b * 2 + 1];

      const v3x = data.vertices[c * 2];
      const v3y = data.vertices[c * 2 + 1];

      positions.push(
        v1x, height, v1y,
        v3x, height, v3y,
        v2x, height, v2y,
      );

      uvs.push(
        0, 0,
        0, 0,
        0, 0,
      );

      let idx = (positions.length / 3) - 3;

      index.push(idx, idx + 1, idx + 2);

      count += 3;

    }

    const lastGroup = geo.groups[geo.groups.length - 1];

    geo.addGroup(lastGroup.start + lastGroup.count, count, 1);

    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geo.setIndex(index);

    geo.computeVertexNormals();

    const mesh = new Mesh(geo);

    const wallMaterial = new MeshStandardMaterial({
      color: 0x999999,
    });
    const roofMaterial = new MeshStandardMaterial({
      color: 0x999999,
    });

    mesh.material = [wallMaterial, roofMaterial];

    const strToColor = (colorStr: string) => {

      if (colorStr.startsWith('#')) {
        return Number('0x' + colorStr.substring(1));
      } else {
        return colorStr;
      }

    }

    if (feature.properties['building:colour']) {

      const colorStr = feature.properties['building:colour'];
      const color = strToColor(colorStr);
      (mesh.material as MeshStandardMaterial[])[0].color = new Color(color);

    }
    if (feature.properties['roof:colour']) {

      const colorStr = feature.properties['roof:colour'];
      const color = strToColor(colorStr);
      (mesh.material as MeshStandardMaterial[])[1].color = new Color(color);

    }

    mesh.userData = feature.properties;

    if (offset) {

      const translateMatrix = new Matrix4();
      translateMatrix.makeTranslation(offset.x, 0, offset.y);
      mesh.applyMatrix4(translateMatrix);

    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;

  }

}