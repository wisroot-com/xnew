import { xnew, xnest } from '../core/xnew';
import { ResizeEvent } from './ResizeEvent';

export function Screen(xnode, { width = 640, height = 480, objectFit = 'contain', pixelated = false } = {}) {
    const wrapper = xnest({ style: 'position: relative; width: 100%; height: 100%; overflow: hidden; user-select: none;' });
    const absolute = xnest({ style: 'position: absolute; inset: 0; margin: auto; user-select: none;' });
    xnest({ style: 'position: relative; width: 100%; height: 100%; user-select: none;' });

    const size = { width, height };
    const canvas = xnew({ tagName: 'canvas', width, height, style: 'position: absolute; width: 100%; height: 100%; vertical-align: bottom; user-select: none;' });
    
    if (pixelated === true) {
        canvas.element.style.imageRendering = 'pixelated';
    }
    
    objectFit = ['fill', 'contain', 'cover'].includes(objectFit) ? objectFit : 'contain';
  
    const observer = xnew(wrapper, ResizeEvent);
    observer.on('resize', resize);
    resize();

    function resize() {
        const aspect = size.width / size.height;
       
        let style = { width: '100%', height: '100%', top: '0', left: '0', bottom: '0', right: '0' };
        if (objectFit === 'fill') {
        } else if (objectFit === 'contain') {
            if (wrapper.clientWidth < wrapper.clientHeight * aspect) {
                style.height = Math.floor(wrapper.clientWidth / aspect) + 'px';
            } else {
                style.width = Math.floor(wrapper.clientHeight * aspect) + 'px';
            }
        } else if (objectFit === 'cover') {
            if (wrapper.clientWidth < wrapper.clientHeight * aspect) {
                style.width = Math.floor(wrapper.clientHeight * aspect) + 'px';
                style.left = Math.floor((wrapper.clientWidth - wrapper.clientHeight * aspect) / 2) + 'px';
                style.right = 'auto';
            } else {
                style.height = Math.floor(wrapper.clientWidth / aspect) + 'px';
                style.top = Math.floor((wrapper.clientHeight - wrapper.clientWidth / aspect) / 2) + 'px';
                style.bottom = 'auto';
            }
        }
        Object.assign(absolute.style, style);
    }

    return {
        get width() {
            return width;
        },
        get height() {
            return height;
        },
        get canvas() {
            return canvas.element;
        },
        resize(width, height) {
            size.width = width;
            size.height = height;
            canvas.element.width = width;
            canvas.element.height = height;
            resize();
        },
    }
}
