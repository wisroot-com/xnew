import { xnew } from './src/core/xnew';
import { DragEvent } from './src/basics/DragEvent';
import { GestureEvent } from './src/basics/GestureEvent';
import { ResizeEvent } from './src/basics/ResizeEvent';
import { Screen } from './src/basics/Screen';
import { SubWindow } from './src/basics/SubWindow';

export default xnew;

Object.defineProperty(xnew, 'Screen', { enumerable: true, value: Screen });
Object.defineProperty(xnew, 'DragEvent', { enumerable: true, value: DragEvent });
Object.defineProperty(xnew, 'GestureEvent', { enumerable: true, value: GestureEvent });
Object.defineProperty(xnew, 'ResizeEvent', { enumerable: true, value: ResizeEvent });

