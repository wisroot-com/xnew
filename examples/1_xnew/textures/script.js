import { xnew, xbasics, xtextures } from '@mulsense/xnew';

//----------------------------------------------------------------------------------------------------
// xtextures viewer — canvas / WebGL2 (no three). One page for every texture: a Panel listbox switches
// the kind, and the parameter rows are generated from the texture's uniform schema (vec3 → color row,
// float → range row). Color textures paint colors; normal textures show a bakeable normal-map image.
//----------------------------------------------------------------------------------------------------

const TEXTURES = {
  wood: xtextures.Wood,
  concrete: xtextures.Concrete,
};

xnew(document.querySelector('#main'), Main);

function Main(unit) {
  const state = { texture: Object.keys(TEXTURES)[0] };
  const bags = {};
  for (const name in TEXTURES) {
    bags[name] = initParams(TEXTURES[name]);
  }

  xnew.nest('<div class="w-full h-full flex items-center justify-center gap-6 p-6 box-border">');
  xnew(ViewHost, { state, bags });
  xnew(ControlPanel, { state, bags });
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
function initParams(component) {
  const params = {};
  for (const [name, uniform] of Object.entries(component.uniforms)) {
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

//----------------------------------------------------------------------------------------------------
// view — the current texture's canvas; swapped out whenever the listbox changes the kind
//----------------------------------------------------------------------------------------------------

function ViewHost(unit, { state, bags }) {
  xnew.nest('<div class="rounded-xl overflow-hidden shadow-2xl bg-black" style="width: 512px; max-width: 55vw;">');

  let view = xnew(TextureView, { component: TEXTURES[state.texture], params: bags[state.texture] });
  unit.on('+texture', ({ type }) => {
    view.finalize();
    view = xnew(TextureView, { component: TEXTURES[type], params: bags[type] });
  });
}

function TextureView(unit, { component, params }) {
  const tex = xnew(component, { size: { width: 512, height: 512 } });
  unit.on('update', () => tex.set(values(params)));
}

//----------------------------------------------------------------------------------------------------
// panel — persistent texture listbox on top; below it, one folder rebuilt from the uniform schema
//----------------------------------------------------------------------------------------------------

function ControlPanel(unit, { state, bags }) {
  xnew.nest('<div class="w-56 max-h-[calc(100vh-3rem)] text-sm border border-stone-600 rounded-lg overflow-hidden shadow-lg bg-stone-800 text-stone-100">');
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
    for (const [name, uniform] of Object.entries(component.uniforms)) {
      if (Array.isArray(uniform.value)) {
        f.color({ name, value: params[name] });
      } else {
        f.range({ name, value: params[name], min: uniform.min, max: uniform.max, step: uniform.step });
      }
    }
  });
}
