//----------------------------------------------------------------------------------------------------
// basics/xbasics — assembles the networking-free convenience components as the `xbasics` export
//
// A flat registry of the built-in components (one component per file, grouped by category folders)
// so callers write `xnew(xbasics.Panel)` etc. Networking components deliberately live under
// `xsync`, not here, so xbasics stays transport-free.
//
// - xbasics : { Aspect, Screen, Scene, Split,                        // view/
//               Image, SVG, SVGText,                                 // element/
//               AudioTrack, Synthesizer, Volume,                     // audio/
//               OpenAndClose, Accordion, Popup, AnalogStick, DPad, Panel }  // ui/
//----------------------------------------------------------------------------------------------------

import { Aspect } from './view/Aspect';
import { Screen } from './view/Screen';
import { Scene } from './view/Scene';
import { Split } from './view/Split';
import { Image } from './element/Image';
import { SVG } from './element/SVG';
import { SVGText } from './element/SVGText';
import { AudioTrack } from './audio/AudioTrack';
import { Synthesizer } from './audio/Synthesizer';
import { Volume } from './audio/Volume';
import { OpenAndClose } from './ui/OpenAndClose';
import { Accordion } from './ui/Accordion';
import { Popup } from './ui/Popup';
import { AnalogStick } from './ui/AnalogStick';
import { DPad } from './ui/DPad';
import { Panel } from './ui/Panel';

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
    Split,
    AudioTrack,
    Synthesizer,
    Volume,
};
