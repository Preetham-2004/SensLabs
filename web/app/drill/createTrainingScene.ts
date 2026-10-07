import * as THREE from "three";
import type { MutableRefObject } from "react";

export function createTrainingScene(
host: HTMLDivElement,
cameraRef: MutableRefObject<THREE.PerspectiveCamera | null>,
toolGroupRef: MutableRefObject<THREE.Group | null>,
muzzleFlashMatRef: MutableRefObject<THREE.MeshBasicMaterial | null>,
targetMeshesRef: MutableRefObject<THREE.Mesh[]>,
) {
  // --- Minimal enclosed practice room ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#091522");
  scene.fog = new THREE.FogExp2("#091522", 0.012);

  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  camera.position.set(0, 1.65, 5.5);
  scene.add(camera);
  cameraRef.current = camera;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  host.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xa8c7e2, 1.35));
  const mainLight = new THREE.DirectionalLight(0xd9efff, 1.8);
  mainLight.position.set(-3, 11, 4);
  scene.add(mainLight);

  const spotLight = new THREE.SpotLight(0x76dfff, 3.2, 42, Math.PI / 2.8, 0.5);
  spotLight.position.set(0, 10, -5);
  spotLight.target.position.set(0, 2.5, -24);
  scene.add(spotLight);
  scene.add(spotLight.target);

  // Dedicated Point Light for Weapon Visibility
  const gunLight = new THREE.PointLight(0xffffff, 3.5, 6);
  gunLight.position.set(0.3, 0.3, -0.2);
  camera.add(gunLight);

  const roomWidth = 34;
  const roomDepth = 40;
  const roomCenterZ = -13;
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x14283b, roughness: 0.82, metalness: 0.08 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.02, roomCenterZ);
  scene.add(floor);

  // A restrained two-metre floor grid gives the room depth without competing with targets.
  const floorGrid = new THREE.GridHelper(roomWidth, 17, 0x65b4c5, 0x35556c);
  floorGrid.position.set(0, 0.012, roomCenterZ);
  const floorGridMaterials = Array.isArray(floorGrid.material) ? floorGrid.material : [floorGrid.material];
  floorGridMaterials.forEach((material) => {
    material.transparent = true;
    material.opacity = 0.48;
    material.depthWrite = false;
  });
  scene.add(floorGrid);

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x101f30, roughness: 0.9, metalness: 0.03 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 14, 0.4), wallMaterial);
  backWall.position.set(0, 7, -33);
  scene.add(backWall);

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 14, roomDepth), wallMaterial);
    wall.position.set(side * (roomWidth / 2), 7, roomCenterZ);
    scene.add(wall);
  }

  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(roomWidth, 0.3, roomDepth),
    new THREE.MeshStandardMaterial({ color: 0x0c1826, roughness: 0.95, metalness: 0.02 }),
  );
  ceiling.position.set(0, 14, roomCenterZ);
  scene.add(ceiling);

  // Fine wall seams echo the floor grid and keep the room visually quiet.
  const wallGridMaterial = new THREE.LineBasicMaterial({ color: 0x315066, transparent: true, opacity: 0.44 });
  const backGridPoints: THREE.Vector3[] = [];
  for (let x = -16; x <= 16; x += 4) {
    backGridPoints.push(new THREE.Vector3(x, 0, -32.78), new THREE.Vector3(x, 13.8, -32.78));
  }
  for (let y = 2; y < 14; y += 2) {
    backGridPoints.push(new THREE.Vector3(-17, y, -32.78), new THREE.Vector3(17, y, -32.78));
  }
  const backGrid = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(backGridPoints), wallGridMaterial);
  scene.add(backGrid);

  for (const side of [-1, 1]) {
    const points: THREE.Vector3[] = [];
    const x = side * 16.78;
    for (let z = -31; z <= 5; z += 4) {
      points.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 13.8, z));
    }
    for (let y = 2; y < 14; y += 2) {
      points.push(new THREE.Vector3(x, y, -33), new THREE.Vector3(x, y, 7));
    }
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), wallGridMaterial));
  }

  // Thin cyan-white strips trace the room's upper corners, as in a clean aim range.
  const edgeLightMaterial = new THREE.MeshBasicMaterial({ color: 0x9be9f2 });
  for (const side of [-1, 1]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, roomDepth), edgeLightMaterial);
    edge.position.set(side * 16.72, 13.78, roomCenterZ);
    scene.add(edge);
  }
  const backEdge = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.045, 0.045), edgeLightMaterial);
  backEdge.position.set(0, 13.78, -32.72);
  scene.add(backEdge);

  const centerLaneMaterial = new THREE.MeshBasicMaterial({ color: 0x72cedb, transparent: true, opacity: 0.52 });
  const centerLane = new THREE.Mesh(new THREE.PlaneGeometry(0.045, roomDepth), centerLaneMaterial);
  centerLane.rotation.x = -Math.PI / 2;
  centerLane.position.set(0, 0.02, roomCenterZ);
  scene.add(centerLane);

  // --- Original low-poly sidearm and gloved forearm view model ---
  const tool = new THREE.Group();
  tool.position.set(0.38, -0.39, -0.72);
  tool.rotation.set(-0.07, -0.055, -0.025);
  camera.add(tool);
  toolGroupRef.current = tool;

  const slideMat = new THREE.MeshStandardMaterial({ color: 0x3b424a, roughness: 0.42, metalness: 0.62 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x252c34, roughness: 0.58, metalness: 0.4 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x171c22, roughness: 0.9, metalness: 0.05 });
  const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x35404c, roughness: 0.95, metalness: 0.02 });
  const sleeveSeamMat = new THREE.MeshStandardMaterial({ color: 0x46515c, roughness: 0.9, metalness: 0.02 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x252b32, roughness: 0.88, metalness: 0.02 });
  const sightMat = new THREE.MeshStandardMaterial({ color: 0x965b52, roughness: 0.48, metalness: 0.35 });
  const muzzleFlashMat = new THREE.MeshBasicMaterial({ color: 0xffd27b, transparent: true, opacity: 0 });
  muzzleFlashMatRef.current = muzzleFlashMat;

  const addWeaponPart = (
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  ) => {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(...position);
    part.rotation.set(...rotation);
    tool.add(part);
    return part;
  };

  // Compact slide and frame, with a short exposed barrel and simple iron sights.
  addWeaponPart(new THREE.BoxGeometry(0.17, 0.14, 0.5), slideMat, [0, 0.12, -0.3]);
  addWeaponPart(new THREE.BoxGeometry(0.15, 0.035, 0.4), frameMat, [0, 0.205, -0.29]);
  addWeaponPart(new THREE.BoxGeometry(0.15, 0.085, 0.31), frameMat, [0, 0.035, -0.19]);
  addWeaponPart(new THREE.CylinderGeometry(0.032, 0.032, 0.22, 10), slideMat, [0, 0.13, -0.63], [Math.PI / 2, 0, 0]);
  addWeaponPart(new THREE.BoxGeometry(0.045, 0.045, 0.035), frameMat, [0, 0.22, -0.5]);
  addWeaponPart(new THREE.BoxGeometry(0.05, 0.045, 0.035), sightMat, [0, 0.22, -0.1]);

  // Serrations and a modest safety detail make the blocky sidearm readable up close.
  for (const side of [-1, 1]) {
    for (let index = 0; index < 4; index += 1) {
      addWeaponPart(
      new THREE.BoxGeometry(0.008, 0.075, 0.012),
      frameMat,
      [side * 0.087, 0.12, -0.015 - index * 0.035],
      [0, 0, -0.12],
      );
    }
  }
  addWeaponPart(new THREE.BoxGeometry(0.018, 0.022, 0.035), sightMat, [0.093, 0.045, -0.13]);

  // Trigger guard and trigger.
  addWeaponPart(new THREE.TorusGeometry(0.067, 0.012, 6, 14), frameMat, [0.078, -0.045, -0.13], [0, Math.PI / 2, 0]);
  addWeaponPart(new THREE.CapsuleGeometry(0.009, 0.06, 3, 6), sightMat, [0.073, -0.04, -0.13], [0, 0, -0.18]);

  // Textured rubber grip slopes down and back toward the hand.
  addWeaponPart(new THREE.BoxGeometry(0.14, 0.29, 0.16), gripMat, [0, -0.16, 0.055], [-0.2, 0, 0]);
  for (let index = 0; index < 5; index += 1) {
    addWeaponPart(new THREE.BoxGeometry(0.145, 0.009, 0.012), frameMat, [0, -0.07 - index * 0.043, 0.139], [-0.2, 0, 0]);
  }

  // Forearm sleeve: a tapered-looking low-poly capsule running in from the lower-right.
  const armStart = new THREE.Vector3(0.33, -0.62, 0.34);
  const wrist = new THREE.Vector3(0.015, -0.19, 0.085);
  const armDirection = wrist.clone().sub(armStart);
  const sleeve = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.145, Math.max(armDirection.length() - 0.29, 0.02), 5, 10),
  sleeveMat,
  );
  sleeve.position.copy(armStart).add(wrist).multiplyScalar(0.5);
  sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), armDirection.normalize());
  tool.add(sleeve);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.075, 10), sleeveSeamMat);
  cuff.position.copy(wrist);
  cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), armDirection);
  tool.add(cuff);

  // Gloved palm and curled fingers wrap around the pistol grip.
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), gloveMat);
  palm.position.set(0, -0.15, 0.15);
  palm.scale.set(0.105, 0.105, 0.075);
  tool.add(palm);
  for (let index = 0; index < 4; index += 1) {
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.07, 3, 7), gloveMat);
    finger.position.set(-0.052 + index * 0.035, -0.205, 0.205);
    finger.rotation.z = 0.16;
    tool.add(finger);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.11, 3, 7), gloveMat);
  thumb.position.set(0.095, -0.105, 0.09);
  thumb.rotation.set(-0.2, 0.15, -0.5);
  tool.add(thumb);

  // Muzzle Flash
  const flashMesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), muzzleFlashMat);
  flashMesh.position.set(0, 0.13, -0.76);
  tool.add(flashMesh);

  // --- POOL OF 3 CLEAN TARGET SPHERES (WITHOUT OUTLINES) ---
  const targetMaterial = new THREE.MeshStandardMaterial({
    color: 0x02c9f4,
    emissive: 0x00b0d0,
    emissiveIntensity: 2.2,
    roughness: 0.15,
    metalness: 0.1,
  });

  const targetMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.48, 32, 24), targetMaterial);
    sphere.visible = false;
    scene.add(sphere);
    targetMeshes.push(sphere);
  }
  targetMeshesRef.current = targetMeshes;
  return { scene, camera, renderer };
}
