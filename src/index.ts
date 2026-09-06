//----------------------------------------------------------------------------------------------------
// Public barrel — the first-tier exports of @mulsense/xnew: xnew, xsync, xaudio, xbasics, xicons, xtextures
// Each layer is assembled in its own module and only re-exported here; addons stay on subpath exports.
//----------------------------------------------------------------------------------------------------

export { xnew } from './core/xnew';
export { xsync } from './sync/xsync';
export { xaudio } from './audio/xaudio';
export { xbasics } from './basics/xbasics';
export { xicons } from './icons/xicons';
export { xtextures } from './textures/xtextures';
