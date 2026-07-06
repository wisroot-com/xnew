//----------------------------------------------------------------------------------------------------
// basics/xbasics — assembles the networking-free convenience components as the `xbasics` export
//
// A flat registry of the built-in components so callers write `xnew(xbasics.Panel)` etc. Networking
// components (Lobby / Room) deliberately live under `xsync`, not here, so xbasics stays transport-free.
//
// - xbasics : { SVG, SVGText, Aspect, Screen, Image, OpenAndClose, AnalogStick, DPad, Panel,
//               Accordion, Popup, Scene, AudioTrack, Synthesizer, Volume }
//----------------------------------------------------------------------------------------------------

import { OpenAndClose, Accordion, Popup } from './transition';
import { SVG, SVGText } from './svg';
import { AnalogStick, DPad } from './controller';
import { Panel } from './panel';
import { Aspect, Screen, Scene } from './view';
import { Image } from './element';
import { AudioTrack, Synthesizer, Volume } from './audio';

export const xbasics = {
    SVG,
    SVGText,
    Aspect,
    Screen,
    Image,
    OpenAndClose,
    AnalogStick,
    DPad,
    Panel,
    Accordion,
    Popup,
    Scene,
    AudioTrack,
    Synthesizer,
    Volume,
};
