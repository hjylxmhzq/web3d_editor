import { Color, LineBasicMaterial, LineSegments, Material, Matrix3, Matrix4, Mesh, Object3D, Plane, Sphere, Triangle, Vector3 } from "three";
import { CONTAINED, INTERSECTED, MeshBVH, NOT_INTERSECTED } from "three-mesh-bvh";
import { SceneSetting, sceneSettings } from "../settings";

export interface StrokeParameter {

	size: number;
	intensity: number;
	invert: boolean;
	brush: 'clay' | 'normal' | 'flatten';

}

const normalZ = new Vector3(0, 0, 1);
const _m3 = new Matrix3();
const _v3 = new Vector3();

export function createBrushHelper() {
	const brushSegments = [new Vector3(), new Vector3(0, 0, 1)];
	for (let i = 0; i < 50; i++) {

		const nexti = i + 1;
		const x1 = Math.sin(2 * Math.PI * i / 50);
		const y1 = Math.cos(2 * Math.PI * i / 50);

		const x2 = Math.sin(2 * Math.PI * nexti / 50);
		const y2 = Math.cos(2 * Math.PI * nexti / 50);

		brushSegments.push(
			new Vector3(x1, y1, 0),
			new Vector3(x2, y2, 0)
		);

	}

	const brush = new LineSegments();
	brush.geometry.setFromPoints(brushSegments);
	// (brush.material as Material).depthTest = false;
	// (brush.material as Material).needsUpdate = true;
	return brush;
}

export function performStroke(
	bvh: MeshBVH,
	point: Vector3,
	targetMesh: Mesh,
	brushObject: Object3D,
	brushOnly = false,
	accumulatedFields: any = {},
	params: typeof sceneSettings.sculpt
) {

	const {
		accumulatedTriangles = new Set<number>(),
		accumulatedIndices = new Set<number>(),
		accumulatedTraversedNodeIndices = new Set<number>(),
	} = accumulatedFields;

	const inverseMatrix = new Matrix4();
	inverseMatrix.copy(targetMesh.matrixWorld).invert();

	const sphere = new Sphere();
	sphere.center.copy(point).applyMatrix4(inverseMatrix);
	sphere.radius = params.size;

	// Collect the intersected vertices
	const indices = new Set<number>();
	const tempVec = new Vector3();
	const normal = new Vector3();
	const indexAttr = targetMesh.geometry.index;
	const posAttr = targetMesh.geometry.attributes.position;
	const normalAttr = targetMesh.geometry.attributes.normal;
	const triangles = new Set();
	if (!indexAttr) {

		console.error('geometry doesnt have index');
		return null;

	}
	bvh.shapecast({

		intersectsBounds: (box, isLeaf, score, depth, nodeIndex) => {

			accumulatedTraversedNodeIndices.add(nodeIndex);

			const intersects = sphere.intersectsBox(box);
			const { min, max } = box;
			if (intersects) {

				for (let x = 0; x <= 1; x++) {

					for (let y = 0; y <= 1; y++) {

						for (let z = 0; z <= 1; z++) {

							tempVec.set(
								x === 0 ? min.x : max.x,
								y === 0 ? min.y : max.y,
								z === 0 ? min.z : max.z
							);
							if (!sphere.containsPoint(tempVec)) {

								return INTERSECTED;

							}

						}

					}

				}

				return CONTAINED;

			}

			return intersects ? INTERSECTED : NOT_INTERSECTED;

		},

		intersectsTriangle: (tri, index, contained) => {

			const triIndex = index;
			triangles.add(triIndex);
			accumulatedTriangles.add(triIndex);

			const i3 = 3 * index;
			const a = i3 + 0;
			const b = i3 + 1;
			const c = i3 + 2;
			const va = indexAttr.getX(a);
			const vb = indexAttr.getX(b);
			const vc = indexAttr.getX(c);
			if (contained) {

				indices.add(va);
				indices.add(vb);
				indices.add(vc);

				accumulatedIndices.add(va);
				accumulatedIndices.add(vb);
				accumulatedIndices.add(vc);

			} else {

				if (sphere.containsPoint(tri.a)) {

					indices.add(va);
					accumulatedIndices.add(va);

				}

				if (sphere.containsPoint(tri.b)) {

					indices.add(vb);
					accumulatedIndices.add(vb);

				}

				if (sphere.containsPoint(tri.c)) {

					indices.add(vc);
					accumulatedIndices.add(vc);

				}

			}

			return false;

		}

	});

	// Compute the average normal at this point
	const localPoint = new Vector3();
	localPoint.copy(point).applyMatrix4(inverseMatrix);

	const planePoint = new Vector3();
	let totalPoints = 0;
	indices.forEach(index => {

		tempVec.fromBufferAttribute(normalAttr, index);
		normal.add(tempVec);

		// compute the average point for cases where we need to flatten
		// to the plane.
		if (!brushOnly) {

			totalPoints++;
			tempVec.fromBufferAttribute(posAttr, index);
			planePoint.add(tempVec);

		}

	});

	normal.normalize();

	_m3.getNormalMatrix(targetMesh.matrixWorld);
	_v3.copy( normal ).applyMatrix3( _m3 ).normalize();

	brushObject.quaternion.setFromUnitVectors(normalZ, _v3);

	if (totalPoints) {

		planePoint.multiplyScalar(1 / totalPoints);

	}

	// Early out if we just want to adjust the brush
	if (brushOnly) {

		return;

	}

	// perform vertex adjustment
	const targetHeight = params.intensity * 0.0001;
	const plane = new Plane();
	plane.setFromNormalAndCoplanarPoint(normal, planePoint);

	indices.forEach(index => {

		tempVec.fromBufferAttribute(posAttr, index);

		// compute the offset intensity
		const dist = tempVec.distanceTo(localPoint);
		const negated = params.invert ? - 1 : 1;
		let intensity = 1.0 - (dist / params.size);

		// offset the vertex
		if (params.brush === 'clay') {

			intensity = Math.pow(intensity, 3);
			const planeDist = plane.distanceToPoint(tempVec);
			const clampedIntensity = negated * Math.min(intensity * 4, 1.0);
			tempVec.addScaledVector(normal, clampedIntensity * targetHeight - negated * planeDist * clampedIntensity * 0.3);

		} else if (params.brush === 'normal') {

			intensity = Math.pow(intensity, 2);
			tempVec.addScaledVector(normal, negated * intensity * targetHeight);

		} else if (params.brush === 'flatten') {

			intensity = Math.pow(intensity, 2);

			const planeDist = plane.distanceToPoint(tempVec);
			tempVec.addScaledVector(normal, - planeDist * intensity * params.intensity * 0.01 * 0.5);

		}

		posAttr.setXYZ(index, tempVec.x, tempVec.y, tempVec.z);
		normalAttr.setXYZ(index, 0, 0, 0);

	});

	// If we found vertices
	if (indices.size) {

		posAttr.needsUpdate = true;

		updateNormals(accumulatedTriangles, accumulatedIndices);

		bvh.refit(accumulatedTraversedNodeIndices);

	}

	function updateNormals(triangles: Set<number>, indices: Set<number>) {

		const tempVec = new Vector3();
		const tempVec2 = new Vector3();
		const indexAttr = targetMesh.geometry.index;
		const posAttr = targetMesh.geometry.attributes.position;
		const normalAttr = targetMesh.geometry.attributes.normal;

		if (!indexAttr) {

			console.error('geometry doesnt have index attr');
			return null;

		}
		// accumulate the normals in place in the normal buffer
		const triangle = new Triangle();
		triangles.forEach(tri => {

			const tri3 = tri * 3;
			const i0 = tri3 + 0;
			const i1 = tri3 + 1;
			const i2 = tri3 + 2;

			const v0 = indexAttr.getX(i0);
			const v1 = indexAttr.getX(i1);
			const v2 = indexAttr.getX(i2);

			triangle.a.fromBufferAttribute(posAttr, v0);
			triangle.b.fromBufferAttribute(posAttr, v1);
			triangle.c.fromBufferAttribute(posAttr, v2);
			triangle.getNormal(tempVec2);

			if (indices.has(v0)) {

				tempVec.fromBufferAttribute(normalAttr, v0);
				tempVec.add(tempVec2);
				normalAttr.setXYZ(v0, tempVec.x, tempVec.y, tempVec.z);

			}

			if (indices.has(v1)) {

				tempVec.fromBufferAttribute(normalAttr, v1);
				tempVec.add(tempVec2);
				normalAttr.setXYZ(v1, tempVec.x, tempVec.y, tempVec.z);

			}

			if (indices.has(v2)) {

				tempVec.fromBufferAttribute(normalAttr, v2);
				tempVec.add(tempVec2);
				normalAttr.setXYZ(v2, tempVec.x, tempVec.y, tempVec.z);

			}

		});

		// normalize the accumulated normals
		indices.forEach(index => {

			tempVec.fromBufferAttribute(normalAttr, index);
			tempVec.normalize();
			normalAttr.setXYZ(index, tempVec.x, tempVec.y, tempVec.z);

		});

		normalAttr.needsUpdate = true;

	}

}