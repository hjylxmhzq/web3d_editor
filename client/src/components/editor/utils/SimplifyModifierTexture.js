import { BufferGeometry, Vector2, Vector3 } from "three";
import { Face3 } from "./Face3";
import { Geometry } from "./Geometry";
import { toBufferGeometry } from "./Geometry2BufferGeometry";

/*
 *  @author zz85 / http://twitter.com/blurspline / http://www.lab4games.net/zz85/blog
 *
 *  Simplification Geometry Modifier
 *    - based on code and technique
 *    - by Stan Melax in 1998
 *    - Progressive Mesh type Polygon Reduction Algorithm
 *    - http://www.melax.com/polychop/
 */

var globalGeometry;

var cb = new Vector3(),
  ab = new Vector3();

function pushIfUnique(array, object) {
  if (array.indexOf(object) === -1) array.push(object);
}

function removeFromArray(array, object) {
  var k = array.indexOf(object);
  if (k > -1) array.splice(k, 1);
}

function computeEdgeCollapseCost(u, v) {
  // if we collapse edge uv by moving u to v then how
  // much different will the model change, i.e. the "error".

  var edgelength = v.position.distanceTo(u.position);
  var curvature = 0;

  var sideFaces = [];
  var i,
    uFaces = u.faces,
    il = u.faces.size,
    face,
    sideFace;

  // find the "sides" triangles that are on the edge uv
  for (let face of u.faces) {

    if (face.hasVertex(v)) {
      sideFaces.push(face);
    }

  }

  // use the triangle facing most away from the sides
  // to determine our curvature term
  for (let face of u.faces) {
    var minCurvature = 1;

    for (var j = 0; j < sideFaces.length; j++) {
      sideFace = sideFaces[j];
      // use dot product of face normals.
      var dotProd = face.normal.dot(sideFace.normal);
      minCurvature = Math.min(minCurvature, (1.001 - dotProd) / 2);
    }

    curvature = Math.max(curvature, minCurvature);
  }

  // crude approach in attempt to preserve borders
  // though it seems not to be totally correct
  var borders = 0;
  if (sideFaces.length < 2) {
    // we add some arbitrary cost for borders,
    // borders += 10;
    curvature = 1;
  }

  var amt = edgelength * curvature + borders;

  return amt;
}

function computeEdgeCostAtVertex(v) {
  // compute the edge collapse cost for all edges that start
  // from vertex v.  Since we are only interested in reducing
  // the object by selecting the min cost edge at each step, we
  // only cache the cost of the least cost edge at this vertex
  // (in member variable collapse) as well as the value of the
  // cost (in member variable collapseCost).

  if (v.neighbors.size === 0) {
    // collapse if no neighbors.
    v.collapseNeighbor = null;
    v.collapseCost = -0.01;

    return;
  }

  v.collapseCost = 100000;
  v.collapseNeighbor = null;

  // search all neighboring edges for "least cost" edge
  for (let neighbor of v.neighbors) {
    var collapseCost = computeEdgeCollapseCost(v, neighbor);

    if (!v.collapseNeighbor) {
      v.collapseNeighbor = neighbor;
      v.collapseCost = collapseCost;
      v.minCost = collapseCost;
      v.totalCost = 0;
      v.costCount = 0;
    }

    v.costCount++;
    v.totalCost += collapseCost;

    if (collapseCost < v.minCost) {
      v.collapseNeighbor = neighbor;
      v.minCost = collapseCost;
    }
  }

  // we average the cost of collapsing at this vertex
  v.collapseCost = v.totalCost / v.costCount;
  // v.collapseCost = v.minCost;
}

function removeVertex(v, vertices) {
  console.assert(v.faces.size === 0);

  for (let n of v.neighbors) {
    n.neighbors.delete(v);
  }

  v.neighbors.clear();

  removeFromArray(vertices, v);
}

function removeFace(f, faces) {
  removeFromArray(faces, f);

  if (f.v1) removeFromArray(f.v1.faces, f);
  if (f.v2) removeFromArray(f.v2.faces, f);
  if (f.v3) removeFromArray(f.v3.faces, f);

  // TODO optimize this!
  var vs = [f.v1, f.v2, f.v3];
  var v1, v2;

  for (var i = 0; i < 3; i++) {
    v1 = vs[i];
    v2 = vs[(i + 1) % 3];

    if (!v1 || !v2) continue;
    v1.removeIfNonNeighbor(v2);
    v2.removeIfNonNeighbor(v1);
  }
}
let max = 100;
function collapse(vertices, faces, u, v, preserveTexture) {
  // u and v are pointers to vertices of an edge
  // Collapse the edge uv by moving vertex u onto v

  if (!v) {
    // u is a vertex all by itself so just delete it..
    removeVertex(u, vertices);
    return;
  }

  var i;
  var tmpVertices = [];

  for (let neighbor of u.neighbors) {
    tmpVertices.push(neighbor);
  }

  var moveToThisUvsValues = [];

  // delete triangles on edge uv:
  for (let face of u.faces) {
    if (face.hasVertex(v)) {
      if (preserveTexture) moveToThisUvsValues = getUVsOnVertex(face, v);
      faces.delete(face);
    }
  }

  if (preserveTexture) {
    for (let face of u.faces) {
      if (max > 0) {
        const dist1 = face.v1.position.distanceTo(face.v2.position);
        const dist2 = face.v2.position.distanceTo(face.v3.position);
        const dist3 = Math.sqrt(dist1 * dist1 + dist2 * dist2);
        const angles = getTriangleAnglesFromDistances(dist1, dist2, dist3);
        const anglesUV = getAnglesFromPoints(face.faceVertexUvs);
        max--;
      }
      var faceVerticeUVs = getUVsOnVertex(face, u);

      var verticeDistance = u.position.distanceTo(v.position);
      var size = globalGeometry.boundingSphere.radius * 2;
      var percentageChangeVertexShift = 100 / size * verticeDistance;

      var deltaX = Math.abs(100 * (moveToThisUvsValues.x - faceVerticeUVs.x));
      var deltaY = Math.abs(100 * (moveToThisUvsValues.y - faceVerticeUVs.y));
      var percentageChangeTextureCorrds = Math.max(deltaX, deltaY);

      // safety check from strange results:
      // if texture shift percentage is much higher than
      // vertex position shift in relation to object size
      if (
        Math.abs(percentageChangeTextureCorrds - percentageChangeVertexShift) >
        5
      ) {
        continue;
      }

      faceVerticeUVs.x = moveToThisUvsValues.x;
      faceVerticeUVs.y = moveToThisUvsValues.y;
    }
  }

  // update remaining triangles to have v instead of u
  for (let face of u.faces) {
    face.replaceVertex(u, v);
  }

  removeVertex(u, vertices);

  // recompute the edge collapse costs in neighborhood
  for (i = 0; i < tmpVertices.length; i++) {
    computeEdgeCostAtVertex(tmpVertices[i]);
  }
}

function getUVsOnVertex(face, vertex) {
  return face.faceVertexUvs[getVertexIndexOnFace(face, vertex)];
}

function getVertexIndexOnFace(face, vertex) {
  return [face.v1, face.v2, face.v3].indexOf(vertex);
}

function minimumCostEdge(vertices) {
  // O(n * n) approach. TODO optimize this

  var least = vertices[0];

  for (var i = 0; i < vertices.length; i++) {
    if (vertices[i].collapseCost < least.collapseCost) {
      least = vertices[i];
    }
  }

  return least;
}

// we use a triangle class to represent structure of face slightly differently

class Triangle {
  constructor(v1, v2, v3, a, b, c, fvuv, materialIndex) {
    this.a = a;
    this.b = b;
    this.c = c;

    this.v1 = v1;
    this.v2 = v2;
    this.v3 = v3;

    this.normal = new Vector3();
    this.faceVertexUvs = fvuv;
    this.materialIndex = materialIndex;

    this.computeNormal();

    v1.faces.add(this);
    v1.addUniqueNeighbor(v2);
    v1.addUniqueNeighbor(v3);

    if (v2 !== v1) {

      v2.faces.add(this);
      v2.addUniqueNeighbor(v1);
      v2.addUniqueNeighbor(v3);

    }

    if (v3 !== v2 && v3 !== v1) {

      v3.faces.add(this);
      v3.addUniqueNeighbor(v1);
      v3.addUniqueNeighbor(v2);

    }
  }
  computeNormal() {
    var vA = this.v1.position;
    var vB = this.v2.position;
    var vC = this.v3.position;

    cb.subVectors(vC, vB);
    ab.subVectors(vA, vB);
    cb.cross(ab).normalize();

    this.normal.copy(cb);
  }
  hasVertex(v) {
    return v === this.v1 || v === this.v2 || v === this.v3;
  }
  replaceVertex(oldv, newv) {
    if (oldv === this.v1)
      this.v1 = newv;
    else if (oldv === this.v2)
      this.v2 = newv;
    else if (oldv === this.v3)
      this.v3 = newv;

    oldv.faces.delete(this);
    newv.faces.add(this);

    oldv.removeIfNonNeighbor(this.v1);
    this.v1.removeIfNonNeighbor(oldv);

    oldv.removeIfNonNeighbor(this.v2);
    this.v2.removeIfNonNeighbor(oldv);

    oldv.removeIfNonNeighbor(this.v3);
    this.v3.removeIfNonNeighbor(oldv);

    this.v1.addUniqueNeighbor(this.v2);
    this.v1.addUniqueNeighbor(this.v3);

    this.v2.addUniqueNeighbor(this.v1);
    this.v2.addUniqueNeighbor(this.v3);

    this.v3.addUniqueNeighbor(this.v1);
    this.v3.addUniqueNeighbor(this.v2);

    this.computeNormal();
  }
}




class Vertex {
  constructor(v, id) {
    this.position = v;

    this.id = id; // old index id

    this.faces = new Set(); // faces vertex is connected
    this.neighbors = new Set(); // neighbouring vertices aka "adjacentVertices"


    // these will be computed in computeEdgeCostAtVertex()
    this.collapseCost = 0; // cost of collapsing this vertex, the less the better. aka objdist
    this.collapseNeighbor = null; // best candinate for collapsing
  }
  addUniqueNeighbor(vertex) {
    this.neighbors.add(vertex);
  }
  removeIfNonNeighbor(n) {
    var neighbors = this.neighbors;
    var faces = this.faces;

    var hasNeighbor = neighbors.has(n);
    if (!hasNeighbor === -1)
      return;
    for (let face of faces) {
      if (face.hasVertex(n))
        return;
    }

    neighbors.delete(n);
  }
}



/**
 * modify - will reduce vertices and faces count
 * mergeVertices might be needed prior
 * @param count int how many vertices to remove ie. 60% removal Math.round(geo.vertices.count * 0.6)
 **/

const lowerLimit = 51;
export function simplifyMesh(geometryRaw, percentage, preserveTexture) {

  console.time('simplify cost');

  let isBufferGeometry = false;
  let geometry = geometryRaw;

  if (
    geometry instanceof BufferGeometry &&
    !geometry.vertices &&
    !geometry.faces
  ) {
    if (geometry.attributes.position.count < lowerLimit * 3) {
      return geometry;
    }

    console.log("converting BufferGeometry to Geometry");
    geometry = new Geometry().fromBufferGeometry(geometry);
    console.log("converting finishes");
    isBufferGeometry = true;
  }

  globalGeometry = geometry;
  if (!globalGeometry.boundingSphere) {
    globalGeometry.computeBoundingSphere();
  }

  if (geometry.vertices.length < 50) {
    return geometryRaw;
  }

  geometry.mergeVertices();
  geometry.computeVertexNormals();

  var oldVertices = geometry.vertices; // Three Position
  var oldFaces = geometry.faces; // Three Face
  var oldFaceUVs = geometry.faceVertexUvs[0];

  // conversion
  var vertices = new Array(oldVertices.length); // Simplify Custom Vertex Struct
  var faces = new Set(oldFaces); // Simplify Custom Traignle Struct
  var faceUVs = []; // rebuild UVs

  var i, il, face;

  //
  // put data of original geometry in different data structures
  //

  // add vertices
  for (i = 0, il = oldVertices.length; i < il; i++) {
    vertices[i] = new Vertex(oldVertices[i], i);
  }

  if (preserveTexture && oldFaceUVs.length) {
    // add UVs
    for (i = 0; i < oldFaceUVs.length; i++) {
      const faceUV = oldFaceUVs[i];

      faceUVs.push([
        new Vector2(faceUV[0].x, faceUV[0].y),
        new Vector2(faceUV[1].x, faceUV[1].y),
        new Vector2(faceUV[2].x, faceUV[2].y)
      ]);
    }
  }

  // add faces
  for (i = 0, il = oldFaces.length; i < il; i++) {
    face = oldFaces[i];
    const newFace = new Triangle(
      vertices[face.a],
      vertices[face.b],
      vertices[face.c],
      face.a,
      face.b,
      face.c,
      faceUVs[i],
      face.materialIndex
    );
    faces.add(newFace);
  }

  // compute all edge collapse costs
  for (i = 0, il = vertices.length; i < il; i++) {
    computeEdgeCostAtVertex(vertices[i]);
  }

  var nextVertex;
  var z = Math.round(geometry.vertices.length * percentage);

  // console.time('z')
  // console.profile('zz');

  while (z--) {
    nextVertex = minimumCostEdge(vertices);
    if (!nextVertex) {
      console.log("no next vertex");
      break;
    }

    collapse(
      vertices,
      faces,
      nextVertex,
      nextVertex.collapseNeighbor,
      preserveTexture
    );
  }

  // console.profileEnd('zz');
  // console.timeEnd('z')

  // TODO convert to buffer geometry.
  var newGeo = new Geometry();
  if (oldFaceUVs.length) newGeo.faceVertexUvs[0] = [];

  for (i = 0; i < vertices.length; i++) {
    var v = vertices[i];
    newGeo.vertices.push(v.position);
  }
  for (let face of faces) {
    var tri = face;
    newGeo.faces.push(
      new Face3(
        vertices.indexOf(tri.v1),
        vertices.indexOf(tri.v2),
        vertices.indexOf(tri.v3),
        undefined,
        undefined,
        tri.materialIndex
      )
    );

    if (oldFaceUVs.length) newGeo.faceVertexUvs[0].push(face.faceVertexUvs);
  }

  newGeo.mergeVertices();
  newGeo.computeVertexNormals();
  newGeo.computeFaceNormals();
  newGeo.name = geometry.name;

  console.log(`face change from ${geometry.faces.length} to ${newGeo.faces.length}`);
  console.timeEnd('simplify cost');

  return isBufferGeometry ? toBufferGeometry(newGeo) : newGeo;
}

export default simplifyMesh;

function getTriangleAnglesFromDistances(a, b, c) {
  var A, B, C, R, s, pi, area;
  pi = Math.PI;

  s = (a + b + c) / 2;

  area = Math.sqrt(s * (s - a) * (s - b) * (s - c));

  R = a * b * c / (4 * area);

  A = 180 / pi * Math.asin(a / (2 * R));
  B = 180 / pi * Math.asin(b / (2 * R));
  C = 180 / pi * Math.asin(c / (2 * R));

  return [A, B, C];
}

function getAnglesFromPoints(uvs) {
  const pointA = uvs[0];
  const pointB = uvs[1];
  const pointC = uvs[2];

  const dist1 = Math.sqrt(
    Math.pow(pointA.x - pointB.x, 2) + Math.pow(pointA.y - pointB.y, 2)
  );
  const dist2 = Math.sqrt(
    Math.pow(pointB.x - pointC.x, 2) + Math.pow(pointB.y - pointC.y, 2)
  );
  const dist3 = Math.sqrt(dist1 * dist1 + dist2 * dist2);
  return getTriangleAnglesFromDistances(dist1, dist2, dist3);
}
