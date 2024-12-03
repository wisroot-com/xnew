import { xnew, xnest } from '../core/xnew';

export function Screen(xnode, { width = 640, height = 480, objectFit = 'contain', pixelated = false } = {}) {
    xnest({ style: 'position: relative; width: 100%; height: 100%; overflow: hidden; user-select: none;' });
    xnest({ style: 'position: absolute; inset: 0; margin: auto; user-select: none;' });
    xnest({ style: 'position: relative; width: 100%; height: 100%; user-select: none;' });
    const absolute = xnode.element.parentElement;

    const canvas = xnew({ tagName: 'canvas', width, height, style: 'position: absolute; width: 100%; height: 100%; vertical-align: bottom; user-select: none;' });
    
    if (pixelated === true) {
        canvas.element.style.imageRendering = 'pixelated';
    }
    
    let parentWidth = null;
    let parentHeight = null;

    objectFit = ['fill', 'contain', 'cover'].includes(objectFit) ? objectFit : 'contain';
  
    const xwin = xnew(window);
    xwin.on('resize', resize);

    resize();

    function resize() {
        if (parentWidth === absolute.parentElement.clientWidt && parentHeight === absolute.parentElement.clientHeight) return;
     
        parentWidth = absolute.parentElement.clientWidth;
        parentHeight = absolute.parentElement.clientHeight;

        const aspect = width / height;
       
        let style = { width: '100%', height: '100%', top: '0', left: '0', bottom: '0', right: '0' };
        if (objectFit === 'fill') {
        } else if (objectFit === 'contain') {
            if (parentWidth < parentHeight * aspect) {
                style.height = Math.floor(parentWidth / aspect) + 'px';
            } else {
                style.width = Math.floor(parentHeight * aspect) + 'px';
            }
        } else if (objectFit === 'cover') {
            if (parentWidth < parentHeight * aspect) {
                style.width = Math.floor(parentHeight * aspect) + 'px';
                style.left = Math.floor((parentWidth - parentHeight * aspect) / 2) + 'px';
                style.right = 'auto';
            } else {
                style.height = Math.floor(parentWidth / aspect) + 'px';
                style.top = Math.floor((parentHeight - parentWidth / aspect) / 2) + 'px';
                style.bottom = 'auto';
            }
        }
        Object.assign(absolute.style, style);
    }

    return {
        start() {
            resize();
        },
        get width() {
            return width;
        },
        get height() {
            return height;

        },
        get canvas() {
            return canvas.element;
        }
    }
}
