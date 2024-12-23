import { xnew } from './src/core/xnew';
import { DragEvent } from './src/basics/DragEvent';
import { GestureEvent } from './src/basics/GestureEvent';
import { ResizeEvent } from './src/basics/ResizeEvent';
import { Screen } from './src/basics/Screen';
import { SubWindow } from './src/basics/SubWindow';

export default xnew;

const basics = {
    DragEvent,
    GestureEvent,
    ResizeEvent,
    Screen,
    SubWindow
};

Object.defineProperty(xnew, 'basics', { configurable: true, enumerable: true, value: basics });
