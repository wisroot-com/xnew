//----------------------------------------------------------------------------------------------------
// Public barrel — the three first-tier exports of @mulsense/xnew
//
// Split by responsibility so callers pull only the layer they mean; addons stay on subpath exports.
//
// - xnew    : core (unit tree / lifecycle / DOM / events / timers / context) — the callable + type namespace
// - xsync   : networking (server↔client state sync facade + ready-made Lobby / Room components) — src/sync/
// - xbasics : networking-free convenience components (view / transition / controller / svg / panel / audio)
//----------------------------------------------------------------------------------------------------

import { xnew as base } from './core/xnew';
import { Unit, UnitTimer, ComponentFn, Status as CoreStatus } from './core/unit';
import { Environment as CoreEnvironment } from './core/env';

// boot 入力 / ルームステータスの型を公開する（socket は socket.io の io / socket をそのまま渡す）。
export type { BootServerOptions, BootClientOptions, ClientStatus, RoomStatus } from './sync';

import { OpenAndClose, Accordion, Popup } from './basics/transition';
import { SVG, SVGText } from './basics/svg';
import { AnalogStick, DPad } from './basics/controller';
import { Panel } from './basics/panel';
import { Aspect, Screen, Scene } from './basics/view';
import { AudioTrack as AudioTrackComponent, Synthesizer, Volume } from './basics/audio';

import { xsync } from './sync';

// --- xnew: core only (type namespace merges onto the callable) ---
namespace xnew {
    export type Unit = InstanceType<typeof Unit>;
    export type UnitTimer = InstanceType<typeof UnitTimer>;
    export type Component<P extends object = any, A extends object = {}> = ComponentFn<P, A>;
    export type Environment = CoreEnvironment;
    export type Status = CoreStatus;
}
const xnew = base;

// --- xbasics: networking-free convenience components ---
const xbasics = {
    SVG,
    SVGText,
    Aspect,
    Screen,
    OpenAndClose,
    AnalogStick,
    DPad,
    Panel,
    Accordion,
    Popup,
    Scene,
    AudioTrack: AudioTrackComponent,
    Synthesizer,
    Volume,
};

export { xnew, xsync, xbasics };
