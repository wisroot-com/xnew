import { xnew, xbasics, xtextures } from '@mulsense/xnew';
import { xthree } from '@mulsense/xnew/addons/xthree';
import * as THREE from 'three';

//----------------------------------------------------------------------------------------------------
// xtextures × three.js — one model, switchable texture, and a display listbox comparing the material
// methods side by side: shader (ShaderMaterial injection, fixed light) / baked (standard material
// with baked map+normalMap, static params) / inject (standard material with the GLSL injected via
// onBeforeCompile — PBR lighting AND live params) / color / normal (inspection modes).
// The parameter rows are generated from the schema, so adding a texture is one TEXTURES entry;
// "copy params" puts the current params on the clipboard as schema-shaped JSON.
//----------------------------------------------------------------------------------------------------

const TEXTURES = {
  wood: xtextures.wood,
  tatami: xtextures.tatami,
  carpet: xtextures.carpet,
};

const GEOMETRIES = {
  knot: () => new THREE.TorusKnotGeometry(1.0, 0.34, 220, 32),
  cube: () => new THREE.BoxGeometry(1.7, 1.7, 1.7),
  sphere: () => new THREE.SphereGeometry(1.3, 64, 32),
  // a flat quad the size of exactly one texture cell — for tatami that is one mat (2x1 or hanjo 1x1); resized in Model as scale / aspect move
  mat: () => new THREE.PlaneGeometry(1, 1),
};

xnew(document.querySelector('#main'), Main);

function Main(unit) {
  const [width, height] = [800, 600];
  xnew.extend(xbasics.Screen, { width, height });

  xthree.initialize({ canvas: unit.canvas });
  xthree.camera.position.set(0, 0, 4.2);

  const state = { texture: Object.keys(TEXTURES)[0], display: 'shader', model: Object.keys(GEOMETRIES)[0] };
  const bags = {};
  for (const name in TEXTURES) {
    bags[name] = initParams(TEXTURES[name]);
  }

  xnew.promise(unit).then(() => {
    unit.on('update', () => xthree.renderer.render(xthree.scene, xthree.camera));
    // scene lights: only the standard-material modes (baked / inject) react to them
    const light = xthree.add(new THREE.DirectionalLight(0xffffff, 2.2));
    light.position.set(3, 4, 5);
    xthree.add(new THREE.AmbientLight(0xffffff, 0.5));
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

// initial params bag from the texture's standard preset (vec3 defaults become hex strings)
function initParams(texture) {
  const params = {};
  for (const [name, value] of Object.entries(texture.presets.standard)) {
    params[name] = Array.isArray(value) ? hex(value) : value;
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

// write the panel's params bag into the material each frame (hex strings become vec3);
// baked materials carry no uniforms — their params are fixed at bake time
function syncUniforms(material, params) {
  if (material.uniforms === undefined) {
    return;
  }
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
  // the mat model must match the texture cell in OBJECT space (that is where xtextures is evaluated), so the quad itself is resized; the mesh scale only keeps it a constant size on screen
  let matSize = 0;
  let matAspect = 0;
  resetRotation(object, state);

  unit.on('+texture +display +model', () => {
    material.dispose();
    material = buildMaterial(state, bags);
    object.material = material;
  });
  unit.on('+model', () => {
    geometry.dispose();
    geometry = GEOMETRIES[state.model]();
    object.geometry = geometry;
    [matSize, matAspect] = [0, 0];
    resetRotation(object, state);
  });
  // the model only turns when dragged, so a texture can be inspected from a chosen angle
  unit.on('touchstart contextmenu', ({ event }) => event.preventDefault());
  unit.on('dragmove', ({ delta }) => {
    object.rotation.y += delta.x * 0.01;
    object.rotation.x += delta.y * 0.01;
  });
  unit.on('update', () => {
    if (state.model === 'mat') {
      // scale is the cell size in world units, so the quad is exactly that big
      const bag = bags[state.texture];
      const size = bag.scale;
      const aspect = bag.aspect ?? 1;
      // one cell is a SQUARE in object space whatever the aspect is, so the quad is square too and aspect only stretches it on screen
      if (size !== matSize || aspect !== matAspect) {
        [matSize, matAspect] = [size, aspect];
        geometry.dispose();
        geometry = new THREE.PlaneGeometry(size, size);
        object.geometry = geometry;
      }
      object.scale.set(1.7 * aspect / size, 1.7 / size, 1);
    } else {
      object.scale.setScalar(1);
    }
    syncUniforms(material, bags[state.texture]);
  });
  unit.on('finalize', () => {
    geometry.dispose();
    material.dispose();
  });
}

// the mat quad starts tilted so the drag begins from a readable, slightly angled view
function resetRotation(object, state) {
  object.rotation.set(state.model === 'mat' ? -0.4 : 0, 0, 0);
}

// 'shader' / 'baked' / 'inject' are the library materials; 'color' / 'normal' are inspection modes:
// color = raw albedo (unlit), normal = normal-map colors (n * 0.5 + 0.5), matching the canvas viewer
function buildMaterial(state, bags) {
  const texture = TEXTURES[state.texture];
  const params = values(bags[state.texture]);
  if (state.display === 'shader') {
    return xthree.material.shader(texture, params);
  } else if (state.display === 'baked') {
    // the mat quad is one cell of object space, so its baked map has to cover exactly one cell too
    const worldSize = state.model === 'mat' ? params.scale : undefined;
    return xthree.material.standard(texture, { params, worldSize, size: { width: 1024, height: 1024 }, roughness: 0.6 });
  } else if (state.display === 'inject') {
    return xthree.material.standard(texture, { inject: true, params, roughness: 0.6 });
  }

  // channel entry-function names inside the glsl are derived from the texture name
  const entry = 'xtex' + texture.name.charAt(0).toUpperCase() + texture.name.slice(1);
  const uniforms = {};
  for (const name in texture.presets.standard) {
    const value = params[name] ?? texture.presets.standard[name];
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
      ${texture.glsl}
      void main() {
        gl_FragColor = vec4(${entry}Color(vXtexPos), 1.0);
      }
    `
    : `
      varying vec3 vXtexPos;
      varying vec3 vXtexNormal;
      ${texture.glsl}
      void main() {
        vec3 nrm = normalize(vXtexNormal);
        vec3 tng = normalize(abs(nrm.y) < 0.99 ? cross(vec3(0.0, 1.0, 0.0), nrm) : cross(vec3(1.0, 0.0, 0.0), nrm));
        vec3 n = ${entry}Normal(vXtexPos, nrm, tng);
        gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
      }
    `;
  return new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
}

//----------------------------------------------------------------------------------------------------
// panel — persistent texture listbox on top; below it, one group rebuilt from the uniform schema
//----------------------------------------------------------------------------------------------------

function ControlPanel(unit, { state, bags }) {
  xnew.nest('<div class="absolute top-4 right-4 w-56 max-h-[calc(100vh-2rem)] text-sm border border-stone-600 rounded-lg overflow-hidden shadow-lg bg-stone-800/95 text-stone-100">');
  const panel = xnew(xbasics.Panel);

  panel.listbox({ name: 'texture', value: state.texture, items: Object.keys(TEXTURES) }).on('-change', ({ value }) => {
    state.texture = value;
    xnew.emit('+texture', { type: value });
  });
  panel.listbox({ name: 'display', value: state.display, items: ['shader', 'baked', 'inject', 'color', 'normal'] }).on('-change', ({ value }) => {
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

  let group = buildGroup(panel, state, bags);
  unit.on('+texture', () => {
    group.finalize();
    group = buildGroup(panel, state, bags);
  });
}

function buildGroup(panel, state, bags) {
  const texture = TEXTURES[state.texture];
  const params = bags[state.texture];
  return panel.group({ name: state.texture, open: true, params }, (f) => {
    for (const [name, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        f.color({ name, value });
      } else {
        const { min, max } = texture.ranges[name] ?? {};
        f.range({ name, value, min, max });
      }
    }
  });
}
