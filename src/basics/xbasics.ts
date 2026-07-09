//----------------------------------------------------------------------------------------------------
// basics/xbasics — assembles the networking-free convenience components as the `xbasics` export
//
// A flat registry of the built-in components (one component per file, grouped by category folders)
// so callers write `xnew(xbasics.Panel)` etc. Networking components deliberately live under
// `xsync`, not here, so xbasics stays transport-free.
//
// - xbasics : { Aspect, Screen, Scene, SceneList, Split,             // view/
//               Image, SVG, SVGText,                                 // element/
//               InputRange, InputCheckbox, InputText, InputNumber,  // element/ (form inputs)
//               InputToggle, InputRadio,                             // element/ (form inputs)
//               AudioTrack, Synthesizer, Volume,                     // audio/
//               OpenAndClose, Accordion, Popup, AnalogStick, DPad, Panel }  // ui/
//----------------------------------------------------------------------------------------------------

import { Aspect } from './view/Aspect';
import { Screen } from './view/Screen';
import { Scene } from './view/Scene';
import { SceneList } from './view/SceneList';
import { Split } from './view/Split';
import { Image } from './element/Image';
import { SVG } from './element/SVG';
import { SVGText } from './element/SVGText';
import { InputRange } from './element/InputRange';
import { InputCheckbox } from './element/InputCheckbox';
import { InputText } from './element/InputText';
import { InputNumber } from './element/InputNumber';
import { InputToggle } from './element/InputToggle';
import { InputRadio } from './element/InputRadio';
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
    Aspect,
    Screen,
    Scene,
    SceneList,
    Split,
    Image,
    SVG,
    SVGText,
    InputRange,
    InputCheckbox,
    InputText,
    InputNumber,
    InputToggle,
    InputRadio,
    AudioTrack,
    Synthesizer,
    Volume,
    OpenAndClose,
    Accordion,
    Popup,
    AnalogStick,
    DPad,
    Panel,
};
