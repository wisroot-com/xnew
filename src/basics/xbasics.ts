//----------------------------------------------------------------------------------------------------
// basics/xbasics — a flat registry of the built-in components as the `xbasics` export (`xnew(xbasics.Panel)` etc.)
// Stays transport- and audio-free (except VolumeController, which deliberately reads the xaudio layer).
//----------------------------------------------------------------------------------------------------

import { Aspect } from './stage/Aspect';
import { Screen } from './stage/Screen';
import { Scene } from './stage/Scene';
import { Button } from './element/Button';
import { Image } from './element/Image';
import { SVGText } from './element/SVGText';
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
    SVGText,
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
