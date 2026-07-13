//----------------------------------------------------------------------------------------------------
// basics/xbasics — assembles the networking-free convenience components as the `xbasics` export
// A flat registry of the built-in components so callers write `xnew(xbasics.Panel)` etc.
// Networking components deliberately live under `xsync`, not here, so xbasics stays transport-free.
//----------------------------------------------------------------------------------------------------

import { Aspect } from './view/Aspect';
import { Screen } from './view/Screen';
import { Scene } from './view/Scene';
import { Button } from './element/Button';
import { Image } from './element/Image';
import { SVG } from './element/SVG';
import { SVGText } from './element/SVGText';
import { InputRange } from './element/InputRange';
import { InputCheckbox } from './element/InputCheckbox';
import { InputText } from './element/InputText';
import { InputNumber } from './element/InputNumber';
import { InputSwitch } from './element/InputSwitch';
import { InputRadio } from './element/InputRadio';
import { InputSelect } from './element/InputSelect';
import { AudioTrack } from './audio/AudioTrack';
import { Synthesizer } from './audio/Synthesizer';
import { Volume } from './audio/Volume';
import { Gate } from './ui/Gate';
import { Accordion } from './ui/Accordion';
import { Overlay } from './ui/Overlay';
import { AnalogStick } from './ui/AnalogStick';
import { DPad } from './ui/DPad';
import { Panel } from './ui/Panel';
import { VolumeController } from './ui/VolumeController';

export const xbasics = {
    Aspect,
    Screen,
    Scene,
    Button,
    Image,
    SVG,
    SVGText,
    InputRange,
    InputCheckbox,
    InputText,
    InputNumber,
    InputSwitch,
    InputRadio,
    InputSelect,
    AudioTrack,
    Synthesizer,
    Volume,
    Gate,
    Accordion,
    Overlay,
    AnalogStick,
    DPad,
    Panel,
    VolumeController,
};
