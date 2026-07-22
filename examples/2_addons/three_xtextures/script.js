import { xnew, xbasics, xtextures } from '@mulsense/xnew';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as THREE from 'three';

//----------------------------------------------------------------------------------------------------
// xtextures Wood — three.js. xthree.texture() injects the SAME GLSL into a ShaderMaterial, so the
// wood is evaluated per-fragment from object-space position (solid look), no canvas / image copy.
// xbasics.Panel writes a shared `params` object; the material's uniforms are synced each frame.
//----------------------------------------------------------------------------------------------------

xnew(document.querySelector('#main'), Main);

function Main(unit) {
  const [width, height] = [800, 600];
  xnew.extend(xbasics.Screen, { width, height });

  xthree.initialize({ canvas: unit.canvas });
  xthree.camera.position.set(0, 0, 4.2);

  const params = {
    scale: 2.5, rings: 4.5, lengths: 1, angle: 0, fibers: 0.3, fibersDensity: 10, seed: 0,
    color: '#cc6600', background: '#661a00',
  };

  xnew.promise(unit).then(() => {
    unit.on('update', () => xthree.renderer.render(xthree.scene, xthree.camera));
    xnew(WoodKnot, { params });
    xnew(document.body, ControlPanel, { params });
  });
}

// panel colors are hex strings; the shader wants 0..1 RGB vec3
function rgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

function WoodKnot(unit, { params }) {
  const geometry = new THREE.TorusKnotGeometry(1.0, 0.34, 220, 32);
  const material = xthree.texture(xtextures.Wood, { ...params, color: rgb(params.color), background: rgb(params.background) });
  const object = xthree.add(new THREE.Mesh(geometry, material));

  unit.on('update', () => {
    object.rotation.x += 0.006;
    object.rotation.y += 0.009;
    for (const name in params) {
      const uniform = material.uniforms[name];
      if (uniform === undefined) {
        continue;
      } else if (typeof params[name] === 'string') {
        const [r, g, b] = rgb(params[name]);
        uniform.value.set(r, g, b);
      } else {
        uniform.value = params[name];
      }
    }
  });
  unit.on('finalize', () => {
    geometry.dispose();
    material.dispose();
  });
}

function ControlPanel(unit, { params }) {
  xnew.nest('<div class="absolute top-4 right-4 w-56 max-h-[calc(100vh-2rem)] text-sm border border-stone-600 rounded-lg overflow-hidden shadow-lg bg-stone-800/95 text-stone-100">');
  const panel = xnew(xbasics.Panel, { params });
  panel.folder({ name: 'Wood (three ShaderMaterial)', open: true }, (f) => {
    f.range({ name: 'scale', value: params.scale, min: 0, max: 6, step: 0.1 });
    f.range({ name: 'rings', value: params.rings, min: 0, max: 20, step: 0.1 });
    f.range({ name: 'lengths', value: params.lengths, min: 0.1, max: 10, step: 0.1 });
    f.range({ name: 'angle', value: params.angle, min: 0, max: 360, step: 1 });
    f.range({ name: 'fibers', value: params.fibers, min: 0, max: 1, step: 0.01 });
    f.range({ name: 'fibersDensity', value: params.fibersDensity, min: 0, max: 40, step: 0.5 });
    f.range({ name: 'seed', value: params.seed, min: 0, max: 100, step: 1 });
    f.separator();
    f.color({ name: 'color', value: params.color });
    f.color({ name: 'background', value: params.background });
  });
}
