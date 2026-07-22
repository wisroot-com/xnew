import { xnew, xbasics, xtextures } from '@mulsense/xnew';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as THREE from 'three';

//----------------------------------------------------------------------------------------------------
// xtextures × three.js — one model, switchable texture. xthree.texture() injects the texture's GLSL
// into a ShaderMaterial, evaluated per-fragment from object-space position (solid look, no canvas).
// A Panel listbox swaps the material; the parameter rows are generated from the uniform schema, so
// adding a texture is one TEXTURES entry. Normal-kind textures get an extra surface `color` row.
//----------------------------------------------------------------------------------------------------

const TEXTURES = {
  wood: xtextures.Wood,
  concrete: xtextures.Concrete,
};

xnew(document.querySelector('#main'), Main);

function Main(unit) {
  const [width, height] = [800, 600];
  xnew.extend(xbasics.Screen, { width, height });

  xthree.initialize({ canvas: unit.canvas });
  xthree.camera.position.set(0, 0, 4.2);

  const state = { texture: Object.keys(TEXTURES)[0] };
  const bags = {};
  for (const name in TEXTURES) {
    bags[name] = initParams(TEXTURES[name]);
  }

  xnew.promise(unit).then(() => {
    unit.on('update', () => xthree.renderer.render(xthree.scene, xthree.camera));
    xnew(Model, { state, bags });
    xnew(document.body, ControlPanel, { state, bags });
  });
}

//----------------------------------------------------------------------------------------------------
// params — the panel edits hex strings for colors; the shader wants 0..1 RGB vec3
//----------------------------------------------------------------------------------------------------

function rgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

function hex(rgbArray) {
  return '#' + rgbArray.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

// initial params bag from the texture's uniform schema (vec3 defaults become hex strings);
// normal-kind textures also carry the adapter-level surface color used for lighting
function initParams(component) {
  const params = {};
  for (const [name, uniform] of Object.entries(component.uniforms)) {
    params[name] = Array.isArray(uniform.value) ? hex(uniform.value) : uniform.value;
  }
  if (component.def.kind === 'normal') {
    params.color = params.color ?? '#bfbfbf';
  }
  return params;
}

// bag → shader values (hex strings back to vec3 arrays)
function values(params) {
  const out = {};
  for (const name in params) {
    out[name] = typeof params[name] === 'string' ? rgb(params[name]) : params[name];
  }
  return out;
}

// write the panel's params bag into the material each frame (hex strings become vec3)
function syncUniforms(material, params) {
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
}

//----------------------------------------------------------------------------------------------------
// model — a single mesh; switching the texture just swaps the injected ShaderMaterial
//----------------------------------------------------------------------------------------------------

function Model(unit, { state, bags }) {
  const geometry = new THREE.TorusKnotGeometry(1.0, 0.34, 220, 32);
  let material = xthree.texture(TEXTURES[state.texture], values(bags[state.texture]));
  const object = xthree.add(new THREE.Mesh(geometry, material));

  unit.on('+texture', ({ type }) => {
    material.dispose();
    material = xthree.texture(TEXTURES[type], values(bags[type]));
    object.material = material;
  });
  unit.on('update', () => {
    object.rotation.x += 0.006;
    object.rotation.y += 0.009;
    syncUniforms(material, bags[state.texture]);
  });
  unit.on('finalize', () => {
    geometry.dispose();
    material.dispose();
  });
}

//----------------------------------------------------------------------------------------------------
// panel — persistent texture listbox on top; below it, one folder rebuilt from the uniform schema
//----------------------------------------------------------------------------------------------------

function ControlPanel(unit, { state, bags }) {
  xnew.nest('<div class="absolute top-4 right-4 w-56 max-h-[calc(100vh-2rem)] text-sm border border-stone-600 rounded-lg overflow-hidden shadow-lg bg-stone-800/95 text-stone-100">');
  const panel = xnew(xbasics.Panel);

  panel.listbox({ name: 'texture', value: state.texture, items: Object.keys(TEXTURES) }).on('-change', ({ value }) => {
    state.texture = value;
    xnew.emit('+texture', { type: value });
  });
  panel.separator();

  let folder = buildFolder(panel, state, bags);
  unit.on('+texture', () => {
    folder.finalize();
    folder = buildFolder(panel, state, bags);
  });
}

function buildFolder(panel, state, bags) {
  const component = TEXTURES[state.texture];
  const params = bags[state.texture];
  return panel.folder({ name: state.texture, open: true, params }, (f) => {
    for (const [name, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        f.color({ name, value });
      } else {
        const uniform = component.uniforms[name] ?? {};
        f.range({ name, value, min: uniform.min, max: uniform.max, step: uniform.step });
      }
    }
  });
}
