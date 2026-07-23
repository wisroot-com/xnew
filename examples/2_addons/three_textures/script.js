import { xnew, xbasics, xtextures } from '@mulsense/xnew';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as THREE from 'three';

//----------------------------------------------------------------------------------------------------
// xtextures × three.js — one model, switchable texture. xthree.material.shader() injects the texture's GLSL
// into a ShaderMaterial, evaluated per-fragment from object-space position (solid look, no canvas).
// A Panel listbox swaps the material; the parameter rows are generated from the uniform schema, so
// adding a texture is one TEXTURES entry. A display listbox switches both (lit albedo × perturbed
// normal) / color (raw albedo) / normal (normal-map colors), a model listbox swaps the geometry,
// and "copy params" puts the current texture params on the clipboard as schema-shaped JSON.
//----------------------------------------------------------------------------------------------------

const TEXTURES = {
  wood: xtextures.wood,
  concrete: xtextures.concrete,
  tatami: xtextures.tatami,
};

const GEOMETRIES = {
  knot: () => new THREE.TorusKnotGeometry(1.0, 0.34, 220, 32),
  cube: () => new THREE.BoxGeometry(1.7, 1.7, 1.7),
  sphere: () => new THREE.SphereGeometry(1.3, 64, 32),
};

xnew(document.querySelector('#main'), Main);

function Main(unit) {
  const [width, height] = [800, 600];
  xnew.extend(xbasics.Screen, { width, height });

  xthree.initialize({ canvas: unit.canvas });
  xthree.camera.position.set(0, 0, 4.2);

  const state = { texture: Object.keys(TEXTURES)[0], display: 'both', model: Object.keys(GEOMETRIES)[0] };
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

// initial params bag from the texture's uniform schema (vec3 defaults become hex strings)
function initParams(texture) {
  const params = {};
  for (const [name, uniform] of Object.entries(texture.uniforms)) {
    params[name] = Array.isArray(uniform.value) ? hex(uniform.value) : uniform.value;
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

// bag → shareable JSON values: hex strings become schema-shaped 0..1 RGB arrays (rounded)
function copyableParams(params) {
  const out = {};
  for (const name in params) {
    const value = params[name];
    out[name] = typeof value === 'string' ? rgb(value).map((v) => Math.round(v * 1000) / 1000) : value;
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
// model — a single mesh; switching the texture or the display mode just swaps the ShaderMaterial
//----------------------------------------------------------------------------------------------------

function Model(unit, { state, bags }) {
  let geometry = GEOMETRIES[state.model]();
  let material = buildMaterial(state, bags);
  const object = xthree.add(new THREE.Mesh(geometry, material));

  unit.on('+texture +display', () => {
    material.dispose();
    material = buildMaterial(state, bags);
    object.material = material;
  });
  unit.on('+model', () => {
    geometry.dispose();
    geometry = GEOMETRIES[state.model]();
    object.geometry = geometry;
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

// 'both' is the library material; 'color' / 'normal' are inspection modes built from the def's
// public contract: color = raw albedo (unlit), normal = normal-map colors (n * 0.5 + 0.5),
// matching the canvas viewer's channel rendering
function buildMaterial(state, bags) {
  const def = TEXTURES[state.texture];
  const params = values(bags[state.texture]);
  if (state.display === 'both') {
    return xthree.material.shader(def, params);
  }

  const uniforms = {};
  for (const name in def.uniforms) {
    const value = params[name] ?? def.uniforms[name].value;
    uniforms[name] = { value: Array.isArray(value) ? new THREE.Vector3(value[0], value[1], value[2]) : value };
  }
  const vertexShader = `
    varying vec3 vXtexPos;
    varying vec3 vXtexNormal;
    void main() {
      vXtexPos = position;
      vXtexNormal = normal;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const fragmentShader = state.display === 'color'
    ? `
      varying vec3 vXtexPos;
      varying vec3 vXtexNormal;
      ${def.glsl}
      void main() {
        gl_FragColor = vec4(${def.color}(vXtexPos), 1.0);
      }
    `
    : `
      varying vec3 vXtexPos;
      varying vec3 vXtexNormal;
      ${def.glsl}
      void main() {
        vec3 nrm = normalize(vXtexNormal);
        vec3 tng = normalize(abs(nrm.y) < 0.99 ? cross(vec3(0.0, 1.0, 0.0), nrm) : cross(vec3(1.0, 0.0, 0.0), nrm));
        vec3 n = ${def.normal}(vXtexPos, nrm, tng);
        gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
      }
    `;
  return new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
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
  panel.listbox({ name: 'display', value: state.display, items: ['both', 'color', 'normal'] }).on('-change', ({ value }) => {
    state.display = value;
    xnew.emit('+display', { type: value });
  });
  panel.listbox({ name: 'model', value: state.model, items: Object.keys(GEOMETRIES) }).on('-change', ({ value }) => {
    state.model = value;
    xnew.emit('+model', { type: value });
  });
  const copy = panel.button({ name: 'copy params' });
  copy.on('click', () => {
    const text = JSON.stringify({ texture: state.texture, params: copyableParams(bags[state.texture]) }, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      copy.element.textContent = 'copied!';
      xnew.timeout(() => { copy.element.textContent = 'copy params'; }, 1000);
    });
  });
  panel.separator();

  let folder = buildFolder(panel, state, bags);
  unit.on('+texture', () => {
    folder.finalize();
    folder = buildFolder(panel, state, bags);
  });
}

function buildFolder(panel, state, bags) {
  const texture = TEXTURES[state.texture];
  const params = bags[state.texture];
  return panel.folder({ name: state.texture, open: true, params }, (f) => {
    for (const [name, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        f.color({ name, value });
      } else {
        const uniform = texture.uniforms[name] ?? {};
        f.range({ name, value, min: uniform.min, max: uniform.max, step: uniform.step });
      }
    }
  });
}
