export { xnew, xnest, xfind, xextend, xcontext } from './src/core/xnew';

import { MoveEvent } from './src/components/MoveEvent';
import { AnalogStick } from './src/components/AnalogStick';
import { CircleButton } from './src/components/CircleButton';
import { DPad } from './src/components/DPad';
import { Screen } from './src/components/Screen';
import { SubWindow } from './src/components/SubWindow';

export const xcomponents = {
    MoveEvent,
    AnalogStick,
    DPad,
    CircleButton,
    Screen,
    SubWindow
};
export const xcomps = xcomponents;
