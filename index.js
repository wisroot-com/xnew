export { xnew, xnest, xfind, xtimer, xextend, xcontext } from './src/core/xnew';

import { DragEvent } from './src/basics/DragEvent';
import { GestureEvent } from './src/basics/GestureEvent';
import { ResizeEvent } from './src/basics/ResizeEvent';
import { Screen } from './src/basics/Screen';
import { SubWindow } from './src/basics/SubWindow';

export const xcomponents = {
    DragEvent,
    GestureEvent,
    ResizeEvent,
    Screen,
    SubWindow
};
export const xcomps = xcomponents;
export const xbasics = xcomponents;