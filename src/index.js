import { xnew } from './core/xnew';
import { DragEvent } from './basics/DragEvent';
import { GestureEvent } from './basics/GestureEvent';
import { ResizeEvent } from './basics/ResizeEvent';
import { Screen } from './basics/Screen';
import { SubWindow } from './basics/SubWindow';

export default xnew;

Object.defineProperty(xnew, 'Screen', { enumerable: true, value: Screen });
Object.defineProperty(xnew, 'DragEvent', { enumerable: true, value: DragEvent });
Object.defineProperty(xnew, 'GestureEvent', { enumerable: true, value: GestureEvent });
Object.defineProperty(xnew, 'ResizeEvent', { enumerable: true, value: ResizeEvent });

