export { xnew, xnest, xfind, xextend, xcontext } from './src/core/xnew';

import { DragEvent } from './src/components/DragEvent';
import { GestureEvent } from './src/components/GestureEvent';
import { ResizeEvent } from './src/components/ResizeEvent';
import { Screen } from './src/components/Screen';
import { SubWindow } from './src/components/SubWindow';

export const xcomponents = {
    DragEvent,
    GestureEvent,
    ResizeEvent,
    Screen,
    SubWindow
};
export const xcomps = xcomponents;
