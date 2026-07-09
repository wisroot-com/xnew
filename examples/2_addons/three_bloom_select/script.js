import { xnew, xbasics } from '@mulsense/xnew';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const BLOOM_SCENE = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_SCENE);

xnew(document.querySelector('#main'), Main);

function Main(unit) {
  const [width, height] = [800, 600];
  xnew.extend(xbasics.Screen, { width, height });

  // three setup
  xthree.initialize({ canvas: unit.canvas });
  xthree.camera.position.set(0, 0, 20);
  xthree.camera.lookAt(0, 0, 0);
  xthree.scene.background = new THREE.Color(0x151729);
  xthree.renderer.toneMapping = THREE.NeutralToneMapping;

  const pmrem = new THREE.PMREMGenerator(xthree.renderer);
  xthree.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const renderer = xnew(Renderer);
  xnew(Controller);
  xnew(document.body, Panel);
  xnew(Contents);

  unit.on('update', () => {
    renderer.render();
  });
}

function Contents() {
  for (let i = 0; i < 50; i++) {
    xnew(Sphere)
  }
}

function Sphere(unit) {
  const color = new THREE.Color();
  color.setHSL(Math.random(), 0.7, Math.random() * 0.2 + 0.05);

  const geometry = new THREE.IcosahedronGeometry(1, 15);
  const material = new THREE.MeshStandardMaterial({ color: color, roughness: 1, metalness: 1 });
  const sphere = xthree.nest(new THREE.Mesh(geometry, material));
  sphere.position.set(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
  sphere.position.normalize().multiplyScalar(Math.random() * 4.0 + 2.0);
  sphere.scale.setScalar(Math.random() * Math.random() + 0.5);

  if (Math.random() < 0.25) sphere.layers.enable(BLOOM_SCENE);
}

function Renderer(unit) {
  const renderScene = new RenderPass(xthree.scene, xthree.camera);

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(xthree.canvas.width, xthree.canvas.height), 1.5, 0.4, 0.85);
  bloomPass.threshold = 0;
  bloomPass.strength = 1;
  bloomPass.radius = 0.5;

  const bloomRenderTarget = new THREE.WebGLRenderTarget(xthree.canvas.width, xthree.canvas.height, { type: THREE.HalfFloatType });
  const bloomComposer = new EffectComposer(xthree.renderer, bloomRenderTarget);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(renderScene);
  bloomComposer.addPass(bloomPass);
  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform sampler2D baseTexture;
    uniform sampler2D bloomTexture;
    uniform float bloomStrength;
    varying vec2 vUv;
    void main() {
      gl_FragColor = ( texture2D( baseTexture, vUv ) + texture2D( bloomTexture, vUv ) * bloomStrength );
    }
  `;

  const mixPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture },
        bloomStrength: { value: bloomPass.strength }
      },
      vertexShader,
      fragmentShader,
      defines: {}
    }), 'baseTexture'
  );
  mixPass.needsSwap = true;
  const outputPass = new OutputPass();

  const finalRenderTarget = new THREE.WebGLRenderTarget(xthree.canvas.width, xthree.canvas.height, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(xthree.renderer, finalRenderTarget);
  composer.addPass(renderScene);
  composer.addPass(mixPass);
  composer.addPass(outputPass);
  const darkMaterial = new THREE.MeshBasicMaterial({ color: 'black' });
  const materials = {};

  return {
    get bloom() { return bloomPass; },
    get mix() { return mixPass; },
    render() {
      xthree.scene.traverse((object) => {
        // if the object is in the bloom layer, render it with the original material,
        //  otherwise render it with the dark material
        if (object.isMesh && bloomLayer.test(object.layers) === false) {
          materials[object.uuid] = object.material;
          object.material = darkMaterial;
        }
      });
      bloomComposer.render();
      xthree.scene.traverse((object) => {
        // restore the original material
        if (materials[object.uuid]) {
          object.material = materials[object.uuid];
          delete materials[object.uuid];
        }
      });

      // render the entire scene, then render bloom scene on top
      composer.render();
    },
  };
}

function Controller(unit) {
  const controls = new OrbitControls(xthree.camera, xthree.renderer.domElement);
  controls.maxPolarAngle = Math.PI * 0.5;
  controls.minDistance = 1;
  controls.maxDistance = 100;

  const raycaster = new THREE.Raycaster();

  unit.on('pointerdown', ({ position }) => {
    const mouse = new THREE.Vector2();
    mouse.x = (position.x / unit.element.clientWidth) * 2 - 1;
    mouse.y = - (position.y / unit.element.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, xthree.camera);
    const intersects = raycaster.intersectObjects(xthree.scene.children, false);
    if (intersects.length > 0) {
      const object = intersects[0].object;
      object.layers.toggle(BLOOM_SCENE);
    }
  });
}

function Panel(panel) {
  const render = xnew.context(Renderer);
  const params = {
    threshold: render.bloom.threshold,
    strength: render.bloom.strength,
    radius: render.bloom.radius,
    exposure: xthree.renderer.toneMappingExposure
  };
  xnew.nest('<div class="absolute text-sm w-48 top-2 right-2 p-1 bg-white border rounded shadow-lg">');

  xnew.extend(xbasics.Panel, { name: 'GUI', open: true, params });

  panel.range({ name: 'threshold', min: 0, max: 1, step: 0.01 }).on('input', ({ value }) => {
    render.bloom.threshold = value;
  });
  panel.range({ name: 'strength', min: 0, max: 3, step: 0.01 }).on('input', ({ value }) => {
    render.bloom.strength = value;
    render.mix.material.uniforms.bloomStrength.value = render.bloom.strength;
  });
  panel.range({ name: 'radius', min: 0, max: 1, step: 0.01 }).on('input', ({ value }) => {
    render.bloom.radius = value;
  });
  panel.range({ name: 'exposure', min: 0.1, max: 2, step: 0.1 }).on('input', ({ value }) => {
    xthree.renderer.toneMappingExposure = Math.pow(value, 4.0);
  });
}