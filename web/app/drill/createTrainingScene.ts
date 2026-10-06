import * as THREE from "three";
import type { MutableRefObject } from "react";

export function createTrainingScene(
host: HTMLDivElement,
cameraRef: MutableRefObject<THREE.PerspectiveCamera | null>,
toolGroupRef: MutableRefObject<THREE.Group | null>,
muzzleFlashMatRef: MutableRefObject<THREE.MeshBasicMaterial | null>,
targetMeshesRef: MutableRefObject<THREE.Mesh[]>,
) {
  // --- AIMLABS HIGH-VISIBILITY FUTURISTIC TRAINING LAB ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#16222f");
  scene.fog = new THREE.FogExp2("#16222f", 0.018);

  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  camera.position.set(0, 1.65, 6);
  scene.add(camera);
  cameraRef.current = camera;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  host.appendChild(renderer.domElement);

  // Ambient & Directional Lighting
  scene.add(new THREE.AmbientLight(0xe1f0fc, 2.2));
  const mainLight = new THREE.DirectionalLight(0xffffff, 2.5);
  mainLight.position.set(-3, 10, 6);
  scene.add(mainLight);

  // Target Area Spotlight
  const spotLight = new THREE.SpotLight(0x00f0ff, 4.5, 45, Math.PI / 2.5, 0.3);
  spotLight.position.set(0, 9, -4);
  spotLight.target.position.set(0, 3, -22);
  scene.add(spotLight);
  scene.add(spotLight.target);

  // Dedicated Point Light for Weapon Visibility
  const gunLight = new THREE.PointLight(0xffffff, 3.5, 6);
  gunLight.position.set(0.3, 0.3, -0.2);
  camera.add(gunLight);

  // Floor (Clean Slate Training Floor with Cyan Grid Lines)
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x243342, roughness: 0.5, metalness: 0.4 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 46), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.02, -8);
  scene.add(floor);

  // Floor Laser Grid Lines
  const gridMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  for (const x of [-10, -5, 0, 5, 10]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 36), gridMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.015, -8);
    scene.add(line);
  }

  // Floor Range Distance Markers
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffa500 });
  for (const z of [-7, -13, -19]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(20, 0.1), markerMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.02, z);
    scene.add(line);
  }

  // Modern Lab Walls
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x202e3d, roughness: 0.7, metalness: 0.3 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(40, 14, 0.5), wallMaterial);
  backWall.position.set(0, 7, -24);
  scene.add(backWall);

  for (const x of [-18, 18]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 14, 40), wallMaterial);
    wall.position.set(x, 7, -8);
    scene.add(wall);
  }

  // Columns with LED Strips
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x2b3b4d, roughness: 0.4, metalness: 0.6 });
  const cyanLightMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const limeLightMat = new THREE.MeshBasicMaterial({ color: 0xb8ff43 });

  for (const x of [-14, 14]) {
    for (const z of [-6, -14, -22]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 13, 0.9), pillarMat);
      pillar.position.set(x, 6.5, z);
      scene.add(pillar);

      const sconce = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.5, 0.12), (x < 0 ? cyanLightMat : limeLightMat));
      sconce.position.set(x > 0 ? x - 0.46 : x + 0.46, 6.5, z);
      scene.add(sconce);
    }
  }

  // High-Visibility Shooting Target Recessed Frame (Wider for Arm/Wrist Gridshot)
  const framePanel = new THREE.Mesh(new THREE.BoxGeometry(32, 11, 0.2), new THREE.MeshStandardMaterial({ color: 0x1a2634, roughness: 0.4, metalness: 0.5 }));
  framePanel.position.set(0, 5.5, -23.8);
  scene.add(framePanel);

  const frameBorder = new THREE.Mesh(new THREE.BoxGeometry(32.5, 11.5, 0.08), cyanLightMat);
  frameBorder.position.set(0, 5.5, -23.9);
  scene.add(frameBorder);

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