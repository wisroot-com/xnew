//----------------------------------------------------------------------------------------------------
// basics/xbasics — assembles the networking-free convenience components as the `xbasics` export
// A flat registry of the built-in components so callers write `xnew(xbasics.Panel)` etc.
// Networking lives under `xsync`, audio under `xaudio` — xbasics stays transport- and audio-free
// (except VolumeController, which deliberately depends on the xaudio layer as its master-volume UI).
//----------------------------------------------------------------------------------------------------

import { Aspect } from './layout/Aspect';
import { Screen } from './layout/Screen';
import { Scene } from './layout/Scene';
import { Button } from './element/Button';
import { Image } from './element/Image';
import { GraphicText } from './element/GraphicText';
import { InputRange } from './element/InputRange';
import { InputCheckbox } from './element/InputCheckbox';
import { InputText } from './element/InputText';
import { InputNumber } from './element/InputNumber';
import { InputSwitch } from './element/InputSwitch';
import { InputRadio } from './element/InputRadio';
import { Listbox, ListboxButton, ListboxMenu, ListboxItem } from './element/Listbox';
import { Gate } from './widget/Gate';
import { Accordion } from './widget/Accordion';
import { ColorPicker } from './widget/ColorPicker';
import { Overlay } from './widget/Overlay';
import { VirtualPad } from './widget/VirtualPad';
import { Panel } from './widget/Panel';
import { VolumeController } from './widget/VolumeController';

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
    ListboxButton,
    ListboxMenu,
    ListboxItem,
    Gate,
    Accordion,
    ColorPicker,
    Overlay,
    VirtualPad,
    Panel,
    VolumeController,
};
