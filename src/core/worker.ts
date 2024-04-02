import * as THREE from "three";

const rayList = [
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 0, -1),
]

export const ctx: Worker = self as any;
ctx.addEventListener('message', (event: MessageEvent) => {
    const { centerPoint, mesh, gridSize } = event.data;
    const isInside = calculatePositions(centerPoint, mesh, gridSize);
    self.postMessage({ isInside });
});

function calculatePositions(point: THREE.Vector3, mesh: any, gridSize: number): boolean {
    for (let ray of rayList) {
        const rayCaster = new THREE.Raycaster();
        rayCaster.set(point, ray);
        let rayCasterIntersects = rayCaster.intersectObject(mesh, false);
        if (rayCasterIntersects.length > 0 && rayCasterIntersects[0].distance <= gridSize) return true;
    }
    return false;
}