import { xnew, xbasics } from '@mulsense/xnew';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as THREE from 'three';

const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vViewPos;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPos = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vViewPos;

  void main() {
    vec3 viewDir = normalize(vViewPos);
    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0);

    // アニメするスキャンライン
    float scan = sin(vPosition.y * 2.5 + uTime * 2.0) * 0.5 + 0.5;
    scan = pow(scan, 4.0);

    vec3 rimColor = vec3(0.0, 1.0, 1.0);
    vec3 color = mix(uColor, rimColor, fresnel) + scan * 0.4;
    float alpha = fresnel * 0.8 + 0.15 + scan * 0.2;

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

xnew(document.querySelector('#main'), Main);

function Main(unit) {
  const [width, height] = [800, 600];
  xnew.extend(xbasics.Screen, { width, height });

  // three setup
  xthree.initialize({ canvas: unit.canvas });
  xthree.camera.position.set(0, 0, +100);

  xnew.promise(unit).then(() => {
    unit.on('update', () => {
      xthree.renderer.render(xthree.scene, xthree.camera);
    });

    xnew(Contents);
  });
}

function Contents(unit) {
  xnew(Cube, { x: 0, y: 0, z: 0, size: 30 });
}

function Cube(unit, { x, y, z, size }) {
  const geometry = new THREE.BoxGeometry(size, size, size);
  const uniforms = {
    uTime:  { value: 0.0 },
    uColor: { value: new THREE.Color(0.05, 0.2, 0.6) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  const object = xthree.nest(new THREE.Mesh(geometry, material));
  object.position.set(x, y, z);
  object.rotation.x = Math.PI / 6;
  object.rotation.y = Math.PI / 6;
  unit.on('update', () => {

    uniforms.uTime.value += 0.016;
  });

  unit.on('finalize', () => {
    geometry.dispose();
    material.dispose();
  });
}