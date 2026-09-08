import { xnew, xbasics } from '@mulsense/xnew';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import voxelkit from 'voxelkit';

xnew(document.querySelector('#main'), Main);

function Main(unit, { mogPath = '../../assets/rei.mog', vrmaPath = '../../assets/VRMA_07.vrma', size = 1024 }) {
  xnew.protect();
  xnew.extend(xbasics.Screen, { width: size, height: size });

  // three setup
  // 2 体を横並びにするため、視野は 1 体分（0.5）より少し広げておく
  const view = 0.6;
  const camera = new THREE.OrthographicCamera(-view, +view, +view, -view, 0.1, 10);
  xthree.init({ canvas: unit.canvas, camera });
  xthree.camera.position.set(0, 0.2, +2);
  xthree.renderer.shadowMap.enabled = true;
  xthree.scene.rotation.x = -60 / 180 * Math.PI
  xthree.scene.rotation.z = -20 / 180 * Math.PI

  const composer = new EffectComposer(xthree.renderer);
  composer.addPass(new RenderPass(xthree.scene, xthree.camera));
  const ssaoPass = new SSAOPass(xthree.scene, xthree.camera, xthree.canvas.width, xthree.canvas.height);
  // OrthographicCamera 用: シェーダーのデフォルトは PERSPECTIVE_CAMERA=1 のため明示的に上書き
  ssaoPass.ssaoMaterial.defines['PERSPECTIVE_CAMERA'] = 0;
  ssaoPass.ssaoMaterial.needsUpdate = true;
  ssaoPass.depthRenderMaterial.defines['PERSPECTIVE_CAMERA'] = 0;
  ssaoPass.depthRenderMaterial.needsUpdate = true;
  ssaoPass.kernelRadius = 0.05;     // サンプリング半径
  ssaoPass.minDistance = 0.001;   // 最小距離（linearized depth 0〜1 スケール）
  ssaoPass.maxDistance = 0.02;    // 最大距離
  // ssaoPass.output = SSAOPass.OUTPUT.Depth;  // 診断用
  composer.addPass(ssaoPass);
  composer.addPass(new OutputPass());

  xnew.promise(unit).then(() => {
    unit.on('update', () => {
      composer.render();
    });

    xnew(DirectionaLight, { x: 1, y: -1, z: 2 });
    xnew(AmbientLight);
    xnew(Ground);

    // 同じモデルを面取りなし / あり で並べて見比べる（キャラ幅 0.3 に対して 1 体分あける）
    xnew(Model, { mogPath, vrmaPath, chamfer: 0.0, position: { x: -0.2, y: 0, z: 0 } });
    xnew(Model, { mogPath, vrmaPath, chamfer: 0.2, position: { x: +0.2, y: 0, z: 0 } });
    xnew(Labels, { names: ['chamfer: 0.0', 'chamfer: 0.2'] });
  });

  unit.on('touchstart contextmenu wheel', ({ event }) => event.preventDefault());
  unit.on('dragmove', ({ event, delta }) => {
    if (event.buttons & 1 || !event.buttons) {
      xnew.emit('+rotate', { move: { x: +delta.x, y: +delta.y } });
    }
    if (event.buttons & 2) {
      xnew.emit('+translate', { move: { x: -delta.x, y: +delta.y } });
    }
  });
  unit.on('wheel', ({ delta }) => xnew.emit('+scale', { scale: 1 - 0.001 * delta.y }));

  // 正射影カメラは前後に動かしても見た目が変わらないので、zoom で寄り引きする
  unit.on('+scale', ({ scale }) => {
    xthree.camera.zoom = Math.min(Math.max(xthree.camera.zoom * scale, 0.25), 8.0);
    xthree.camera.updateProjectionMatrix();

    // SSAOPass は投影行列を毎フレーム取り直さないので、zoom を変えたらここで渡し直す
    ssaoPass.ssaoMaterial.uniforms['cameraProjectionMatrix'].value.copy(xthree.camera.projectionMatrix);
    ssaoPass.ssaoMaterial.uniforms['cameraInverseProjectionMatrix'].value.copy(xthree.camera.projectionMatrixInverse);
  });
  unit.on('+translate', ({ move }) => {
    const speed = 0.004 * view / xthree.camera.zoom;
    xthree.camera.position.x += move.x * speed;
    xthree.camera.position.y += move.y * speed;
  });
  unit.on('+rotate', ({ move }) => {
    xthree.scene.rotation.x += move.y * 0.01;
    xthree.scene.rotation.z += move.x * 0.01;
  });
}

function DirectionaLight(unit, { x, y, z }) {
  const object = xthree.add(new THREE.DirectionalLight(0xFFFFFF, 1.4));
  object.position.set(x, y, z);
  object.castShadow = true;
  object.shadow.mapSize.width = 2048;
  object.shadow.mapSize.height = 2048;

  // 影が粗いのは解像度不足。シャドウカメラの既定は ±5 で、0.4 程度しかないモデルには広すぎる。
  // 被写体の大きさまで絞ると同じ 2048px でも 1 テクセルが 1/7 になり、輪郭がはっきりする
  const range = 0.7;
  object.shadow.camera.left = -range;
  object.shadow.camera.right = +range;
  object.shadow.camera.top = +range;
  object.shadow.camera.bottom = -range;
  object.shadow.camera.near = 0.1;
  object.shadow.camera.far = 10;
  object.shadow.camera.updateProjectionMatrix();

  // テクセルが細かくなるとシャドウアクネが出やすいので、法線方向にずらして逃がす
  object.shadow.normalBias = 0.002;
}

function AmbientLight(unit) {
  const object = xthree.add(new THREE.AmbientLight(0xFFFFFF, 1.8));
}

function Ground(unit) {
  const geometry = new THREE.PlaneGeometry(100, 100);
  const material = new THREE.ShadowMaterial({ opacity: 0.30 });
  const plane = xthree.add(new THREE.Mesh(geometry, material));
  plane.receiveShadow = true;
}

function Labels(unit, { names }) {
  xnew.nest('<div class="absolute inset-x-0 top-2 flex pointer-events-none">');
  for (const name of names) {
    const cell = xnew('<div class="flex-1 text-center">');
    xnew(cell, '<span class="px-2 py-1 text-sm rounded bg-white/70 text-gray-700">', name);
  }
}

function Model(unit, { mogPath, vrmaPath, chamfer = 0.0, position }) {
  const object = xthree.nest({ rotation: { x: Math.PI / 2, y: 0 }, position });

  xnew.promise('vrm', voxelkit.load(mogPath, { chamfer }))
  .then((composits) => {
    return voxelkit.convertVRM(composits[0]);
  })
  .then((arrayBuffer) => {
    return xnew.promise((resolve) => {
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      loader.parse(arrayBuffer.buffer, '', (gltf) => resolve(gltf.userData.vrm), (error) => {
        console.error('Failed to load VRM:', error);
      });
    });
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

