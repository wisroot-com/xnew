//----------------------------------------------------------------------------------------------------
// basics/xbasics — a flat registry of the built-in components as the `xbasics` export (`xnew(xbasics.Panel)` etc.)
// Stays transport- and audio-free (except VolumeController, which deliberately reads the xaudio layer).
//----------------------------------------------------------------------------------------------------

import { Aspect } from './stage/Aspect';
import { Screen } from './stage/Screen';
import { Scene } from './stage/Scene';
import { CPUAgent } from './stage/CPUAgent';
import { Pin } from './stage/Pin';
import { Plane } from './stage/Plane';
import { Button } from './element/Button';
import { Image } from './element/Image';
import { SVGText } from './element/SVGText';
import { InputRange } from './element/InputRange';
import { InputCheckbox, InputSwitch } from './element/InputToggle';
import { InputText, InputNumber } from './element/InputField';
import { InputRadio, InputRadioGroup } from './element/InputRadio';
import { Listbox, ListboxButton, ListboxMenu, ListboxItem } from './widget/Listbox';
import { ColorPicker } from './widget/ColorPicker';
import { Gate } from './widget/Gate';
import { Accordion } from './widget/Accordion';
import { ToggleBar } from './widget/ToggleBar';
import { Popover } from './widget/Popover';
import { VirtualPad } from './widget/VirtualPad';
import { Panel, PanelGroup } from './widget/Panel';
import { VolumeController } from './widget/VolumeController';

export const xbasics = {
    Aspect,
    Screen,
    Scene,
    CPUAgent,
    Pin,
    Plane,
    Button,
    Image,
    SVGText,
    InputRange,
    InputCheckbox,
    InputText,
    InputNumber,
    InputSwitch,
    InputRadio,
    InputRadioGroup,
    Listbox,
    ListboxButton,
    ListboxMenu,
    ListboxItem,
    ColorPicker,
    Gate,
    Accordion,
    ToggleBar,
    Popover,
    VirtualPad,
    Panel,
    PanelGroup,
    VolumeController,
};
