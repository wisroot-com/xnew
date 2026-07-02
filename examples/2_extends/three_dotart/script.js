import { xnew } from '@mulsense/xnew';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import voxelkit from 'voxelkit';

document.body.style.backgroundColor = '#000';
xnew(document.querySelector('#main'), Main);

function Main(unit) {
  const [width, height] = [1600, 800];
  xnew.extend(xnew.basics.Screen, { width, height });
  const aspect = width / height;
  
  // three setup
  xthree.initialize({ canvas: unit.canvas, camera: new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.0, 10) });
  xthree.camera.position.set(0, 4 * Math.tan(Math.PI / 6), +4);
  xthree.scene.background = new THREE.Color(0x151729);
  xthree.renderer.shadowMap.enabled = true;

  const renderer = xnew(Renderer);
  unit.on('update', () => {
    renderer.render();
  });

  xnew(Contents);
}

function Contents(unit) {
  // gui
  xnew(Controller);
  xnew(document.body, GUIPanel);

  // lighting
  xnew(AmbientLight, { color: 0x757f8e, intensity: 3 });
  xnew(SpotLight, { color: 0xffc100, intensity: 10, position: { x: 2, y: 2, z: 0 } });
  xnew(DirectionaLight, { color: 0xfffecd, intensity: 1.5, position: { x: 100, y: 100, z: 100 } });

  // objects
  xnew(Box, { size: 0.4, position: { x: 0.0, y:  0.2, z: 0.0 }, rotation: { x: 0.0, y: 0.0, z: 0.0 } });
  xnew(Box, { size: 0.5, position: { x: -0.5, y: 0.3, z: -0.5 }, rotation: { x: 0.0, y: Math.PI / 4, z: 0.0 } });
  xnew(Plane, { size: 6, position: { x: 0.0, y: 0.0, z: 0.0 }, rotation: { x: -Math.PI / 2, y: 0.0, z: 0.0 } });
  xnew(Crystal, { radius: 0.2, position: { x: 0.0, y: 0.7, z: 0.0 }, rotation: { x: 0.0, y: 0.0, z: 0.0 } });

  xnew(Model,{
    mogPath: '../../assets/rei.mog', vrmaPath: '../../assets/VRMA_07.vrma', 
    position: { x: 1.0, y: 0.0, z: 0.0 }, rotation: { x: 0.0, y: 0.0, z: 0.0 }
  });
  xnew(Model,{
    mogPath: '../../assets/miku.mog', vrmaPath: '../../assets/VRMA_03.vrma', 
    position: { x: -0.4, y: 0.0, z: 0.5 }, rotation: { x: 0.0, y: Math.PI / 4, z: 0.0 }
  });
  xnew(Model,{
    mogPath: '../../assets/teto.mog', vrmaPath: '../../assets/VRMA_06.vrma', 
    position: { x: -1.0, y: 0.0, z: 1.5 }, rotation: { x: 0.0, y: Math.PI / 4, z: 0.0 }
  });

}

function AmbientLight(unit, { color = 0xffffff, intensity = 1.0 }) {
  const object = xthree.nest(new THREE.AmbientLight(color, intensity));
}

function DirectionaLight(unit, { color = 0xffffff, intensity = 1.0, position }) {
  const object = xthree.nest(new THREE.DirectionalLight(color, intensity));
  object.position.set(position.x, position.y, position.z);
  object.castShadow = true;
  object.shadow.mapSize.width = 2048;
  object.shadow.mapSize.height = 2048;
}

function SpotLight(unit, { color = 0xffffff, intensity = 1.0, position }) {
  const object = xthree.nest(new THREE.SpotLight(color, intensity, 10, Math.PI / 16, 0.02, 2));
  object.castShadow = true;
  object.target.position.set(0, 0, 0);
  object.position.set(position.x, position.y, position.z );
}

function Box(unit, { size, position, rotation }) {
  const geometry = new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshPhongMaterial({ map: chessboard(3, 3) });
  const object = xthree.nest(new THREE.Mesh(geometry, material));

  object.castShadow = true;
  object.receiveShadow = true;
  object.rotation.set(rotation.x, rotation.y, rotation.z);
  object.position.set(position.x, position.y, position.z);
}

function Plane(unit, { size, position, rotation }) {
  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.MeshPhongMaterial( { map: chessboard(15, 15) } );
  const object = xthree.nest(new THREE.Mesh(geometry, material));

  object.castShadow = true;
  object.receiveShadow = true;
  object.rotation.set(rotation.x, rotation.y, rotation.z);
  object.position.set(position.x, position.y, position.z);
}

function Crystal(unit, { radius, position, rotation }) {
  const geometry = new THREE.IcosahedronGeometry(radius);
  const material = new THREE.MeshPhongMaterial(
    { color: 0x68b7e9, emissive: 0x4f7e8b, shininess: 10, specular: 0xffffff }
  );
  const object = xthree.nest(new THREE.Mesh(geometry, material));
  object.castShadow = true;
  object.receiveShadow = true;
  object.rotation.set(rotation.x, rotation.y, rotation.z);
  object.position.set(position.x, position.y, position.z);

  const time = new Date();
  unit.on('update', () => {
    const t = (new Date() - time) / 1000;
    
    object.material.emissiveIntensity = Math.sin(t * 2) * 0.5 + 0.5;
    object.position.y = position.y + Math.sin(t * 2) * 0.05;
    object.rotation.y += (Math.sin(t * 2) + 1.0) * 0.05;
  });
}

function Model(unit, { mogPath, vrmaPath, position, rotation }) {
  const object = xthree.nest(new THREE.Object3D());
  object.rotation.set(rotation.x, rotation.y, rotation.z);
  object.position.set(position.x, position.y, position.z);
  object.scale.set(2, 2, 2);

  xnew.promise('vrm', voxelkit.load(mogPath))
  .then((composits) => {
    return voxelkit.convertVRM(composits[0]);
  })
  .then((arrayBuffer) => {
    // const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
    // const url = URL.createObjectURL(blob);
    // const a = document.createElement('a');
    // a.href = url;
    // a.download = 'model.vrm';
    // a.click();
    // URL.revokeObjectURL(url);

    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      loader.parse(arrayBuffer.buffer, '', (gltf) => resolve(gltf.userData.vrm), (error) => {
        console.error('Failed to load VRM:', error);
      });
    })
  });

  xnew.promise('vrma', new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));  
    loader.load(vrmaPath, (gltf) => resolve(gltf.userData.vrmAnimations[0]));
  }));

  xnew.promise(unit).then(({ vrm, vrma }) => {
    vrm.scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    object.add(vrm.scene);

    const mixer = new THREE.AnimationMixer(vrm.scene);
    const clip = createVRMAnimationClip(vrma, vrm);
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat);
    action.play();

    let clock = new THREE.Clock();
    unit.on('update', () => {
        const delta = clock.getDelta();
        mixer.update(delta);
        vrm.update(delta);
    });
  });
}

function Controller(unit) {
  const controls = new OrbitControls(xthree.camera, xthree.canvas);
  controls.maxZoom = 2;
}

function chessboard(gridX, gridY) {
  const s = 2;
  const data = new Uint8Array(s * s * 4);

  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      const ptr = (y * s + x) * 4;
      data[ptr + 0] = data[ptr + 1] = data[ptr + 2] = ((x + y) % 2 === 0) ? 128 : 192;
      data[ptr + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, s, s, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.needsUpdate = true;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(gridX / 2, gridY / 2);
  return texture;
}

function Renderer(unit) {
  const composer = new EffectComposer(xthree.renderer);
  const rpp = new RenderPixelatedPass(4, xthree.scene, xthree.camera);
  composer.addPass(rpp);
  composer.addPass(new OutputPass());

  return {
    get renderPixelatedPass() { return rpp; },
    render() {
      pixelAlignFrustum();
      composer.render();
    },
  }

  function pixelAlignFrustum() {
    const baseline = 1.0;

    // Pixel Grid Units
    const pixelUnit = 2 * baseline / (xthree.camera.zoom * Math.floor(xthree.canvas.height / rpp.pixelSize));

    // Project the current camera position along its local rotation bases
    const [camPos, camRot] = [new THREE.Vector3(), new THREE.Quaternion()];
    xthree.camera.getWorldPosition(camPos);
    xthree.camera.getWorldQuaternion(camRot);
    const camX = camPos.dot(new THREE.Vector3(1.0, 0.0, 0.0).applyQuaternion(camRot));
    const camY = camPos.dot(new THREE.Vector3(0.0, 1.0, 0.0).applyQuaternion(camRot));

    // Find the fractional pixel units and convert to world units
    const fractX = (camX / pixelUnit) - Math.round(camX / pixelUnit);
    const fractY = (camY / pixelUnit) - Math.round(camY / pixelUnit);

    const aspect = xthree.canvas.width / xthree.canvas.height;
    xthree.camera.left = - baseline * aspect - (fractX * pixelUnit);
    xthree.camera.right = baseline * aspect - (fractX * pixelUnit);
    xthree.camera.top = baseline - (fractY * pixelUnit);
    xthree.camera.bottom = - baseline - (fractY * pixelUnit);
    xthree.camera.updateProjectionMatrix();
  }
}

function GUIPanel(unit) {
  const rpp = xnew.context(Renderer).renderPixelatedPass;
  const params = { pixelSize: rpp.pixelSize, normalEdgeStrength: rpp.normalEdgeStrength, depthEdgeStrength: rpp.depthEdgeStrength, };

  xnew.nest('<div class="absolute text-sm w-48 top-2 right-2 p-1 bg-white border rounded shadow-lg">');

  const panel = xnew(xnew.basics.Panel, { name: 'GUI', open: true, params });

  panel.range('pixelSize', { min: 1, max: 16, step: 1 }).on('input', ({ value }) => {
    rpp.setPixelSize(value);
  });
  panel.range('normalEdgeStrength', { min: 0, max: 2, step: 0.1 }).on('input', ({ value }) => {
    rpp.normalEdgeStrength = value;
  });
  panel.range('depthEdgeStrength', { min: 0, max: 1, step: 0.1 }).on('input', ({ value }) => {
    rpp.depthEdgeStrength = value;
  });
}
