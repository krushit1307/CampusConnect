import * as THREE from 'three';

export interface ARPathPoint {
    x: number;
    y: number;
    z: number;
}

export function generateHolographicPath(start: ARPathPoint, end: ARPathPoint): THREE.Vector3[] {
    const startVector = new THREE.Vector3(start.x, start.y, start.z);
    const endVector = new THREE.Vector3(end.x, end.y, end.z);
    
    // Create a midpoint that arches upward to make the line "float"
    const midVector = new THREE.Vector3().addVectors(startVector, endVector).multiplyScalar(0.5);
    midVector.y += 1.5; 

    const curve = new THREE.QuadraticBezierCurve3(startVector, midVector, endVector);
    return curve.getPoints(50);
}
