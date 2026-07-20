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
import { GraphicText } from './element/GraphicText';
import { InputRange } from './element/InputRange';
import { InputCheckbox } from './element/InputCheckbox';
import { InputText } from './element/InputText';
import { InputNumber } from './element/InputNumber';
import { InputSwitch } from './element/InputSwitch';
import { InputRadio } from './element/InputRadio';
import { Listbox, ListboxMenu, ListboxItem } from './element/Listbox';
import { AudioTrack } from './audio/AudioTrack';
import { Synthesizer } from './audio/Synthesizer';
import { Volume } from './audio/master';
import { Gate } from './ui/Gate';
import { Accordion } from './ui/Accordion';
import { Overlay } from './ui/Overlay';
import { VirtualPad } from './ui/VirtualPad';
import { Panel } from './ui/Panel';
import { VolumeController } from './ui/VolumeController';

export const xbasics = {
    Aspect,
    Screen,
    Scene,
    Button,
    Image,
    GraphicText,
    InputRange,
    InputCheckbox,
    InputText,
    InputNumber,
    InputSwitch,
    InputRadio,
    Listbox,
    ListboxMenu,
    ListboxItem,
    AudioTrack,
    Synthesizer,
    Volume,
    Gate,
    Accordion,
    Overlay,
    VirtualPad,
    Panel,
    VolumeController,
};
