import { xnew, xbasics, xtextures } from '@mulsense/xnew';

//----------------------------------------------------------------------------------------------------
// xtextures viewer — canvas / WebGL2 (no three). One page for every texture: a Panel listbox switches
// the texture, and the parameter rows are generated from the texture's uniform schema (vec3 → color
// row, float → range row). Every channel gets its own canvas: color paints colors, normal shows a
// bakeable normal-map image.
//----------------------------------------------------------------------------------------------------

const TEXTURES = {
  wood: xtextures.wood,
  tatami: xtextures.tatami,
  carpet: xtextures.carpet,
};

// how much world each canvas samples (xtextures defaults to 3): tatami is framed on one mat, a touch wider so its heri stays inside
const WORLD_SIZES = { tatami: 1.1 };

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

//----------------------------------------------------------------------------------------------------
// view — one canvas per channel of the current texture; swapped out whenever the listbox changes it
//----------------------------------------------------------------------------------------------------

function ViewHost(unit, { state, bags }) {
  xnew.nest('<div class="flex flex-col gap-4" style="width: 512px; max-width: 55vw;">');

  let views = build(state.texture);
  unit.on('+texture', ({ type }) => {
    views.forEach((view) => view.finalize());
    views = build(type);
  });

  function build(name) {
    const texture = TEXTURES[name];
    // every texture defines both channels by design (asserted by the tests)
    return ['color', 'normal'].map((channel) => xnew(TextureView, { texture, params: bags[name], channel }));
  }
}

function TextureView(unit, { texture, params, channel }) {
  xnew.nest('<div class="rounded-xl overflow-hidden shadow-2xl bg-black">');
  const canvas = xnew('<canvas width="512" height="512" style="display: block; width: 100%; height: auto;">').element;
  const renderer = texture.renderer(canvas, { channel, worldSize: WORLD_SIZES[texture.name] });
  unit.on('update', () => renderer.render(values(params)));
  unit.on('finalize', () => renderer.dispose());
}

//----------------------------------------------------------------------------------------------------
// panel — persistent texture listbox on top; below it, one group rebuilt from the uniform schema
//----------------------------------------------------------------------------------------------------

function ControlPanel(unit, { state, bags }) {
  xnew.nest('<div class="w-56 max-h-[calc(100vh-3rem)] text-sm border border-stone-600 rounded-lg overflow-hidden shadow-lg bg-stone-800 text-stone-100">');
  const panel = xnew(xbasics.Panel);

  panel.listbox({ name: 'texture', value: state.texture, items: Object.keys(TEXTURES) }).on('-change', ({ value }) => {
    state.texture = value;
    xnew.emit('+texture', { type: value });
  });
  panel.separator();

  let group = buildGroup(panel, state, bags);
  unit.on('+texture', () => {
    group.finalize();
    group = buildGroup(panel, state, bags);
  });
}

function buildGroup(panel, state, bags) {
  const component = TEXTURES[state.texture];
  const params = bags[state.texture];
  return panel.group({ name: state.texture, open: true, params }, (f) => {
    for (const [name, value] of Object.entries(component.presets.standard)) {
      if (Array.isArray(value)) {
        f.color({ name, value: params[name] });
      } else {
        const { min, max } = component.ranges[name];
        f.range({ name, value: params[name], min, max });
      }
    }
  });
}
