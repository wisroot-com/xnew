import { xnew, xbasics, xtextures } from '@mulsense/xnew';

//----------------------------------------------------------------------------------------------------
// xtextures Wood — canvas / WebGL2 (no three). The texture is a shader rendered into a <canvas>;
// xbasics.Panel writes into a shared `params` object and the view re-renders each frame.
//----------------------------------------------------------------------------------------------------

xnew(document.querySelector('#main'), Main);

function Main(unit) {
  const params = {
    scale: 2.5, rings: 4.5, lengths: 1, angle: 0, fibers: 0.3, fibersDensity: 10, seed: 0,
    color: '#cc6600', background: '#661a00',
  };

  xnew.nest('<div class="w-full h-full flex items-center justify-center gap-6 p-6 box-border">');
  xnew(TextureView, { params });
  xnew(ControlPanel, { params });
}

// panel colors are hex strings; the shader wants 0..1 RGB vec3
function rgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

function TextureView(unit, { params }) {
  xnew.nest('<div class="rounded-xl overflow-hidden shadow-2xl bg-black" style="width: 512px; max-width: 55vw;">');
  const tex = xnew(xtextures.Wood, { size: { width: 512, height: 512 } });
  unit.on('update', () => {
    tex.set({ ...params, color: rgb(params.color), background: rgb(params.background) });
  });
}

function ControlPanel(unit, { params }) {
  xnew.nest('<div class="w-56 max-h-[calc(100vh-3rem)] text-sm border border-stone-600 rounded-lg overflow-hidden shadow-lg bg-stone-800 text-stone-100">');
  const panel = xnew(xbasics.Panel, { params });
  panel.folder({ name: 'Wood (canvas / WebGL2)', open: true }, (f) => {
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
