import { isNumber } from './common';
import { xnew, xwrap } from './core';
export * as xutil from './util';

//----------------------------------------------------------------------------------------------------
// screen
//----------------------------------------------------------------------------------------------------

export function Screen(node, { width = 640, height = 480, objectFit = 'contain', pixelated = false } = {}) {
    node.nest({ style: 'position: relative; width: 100%; height: 100%; overflow: hidden; user-select: none;' });
    node.nest({ style: 'position: absolute; inset: 0; margin: auto; user-select: none;' });
    node.nest({ style: 'position: relative; width: 100%; height: 100%; user-select: none;' });
    const absolute = node.element.parentElement;

    const canvas = xnew({ tag: 'canvas', width, height, style: 'position: absolute; width: 100%; height: 100%; vertical-align: bottom; user-select: none;' });
    
    if (pixelated === true) {
        canvas.element.style.imageRendering = 'pixelated';
    }
    
    let parentWidth = null;
    let parentHeight = null;

    objectFit = ['fill', 'contain', 'cover'].includes(objectFit) ? objectFit : 'contain';
  
    window.addEventListener('resize', resize);

    xtimer(() => resize());
    xtimer(() => resize(), 1000, true);
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
        finalize() {
            window.removeEventListener('resize', resize);  
        },
        width,
        height,
        canvas: canvas.element,
    }
}

//----------------------------------------------------------------------------------------------------
// transition
//----------------------------------------------------------------------------------------------------

export function Transition(node, callback, interval = 1000) {

    return {
        update(time) {
            const value = time / interval;
            xwrap(node.parent, callback, Math.min(1.0, value));
            if (value >= 1.0) node.finalize();
        }
    }
}

//----------------------------------------------------------------------------------------------------
// drag event
//----------------------------------------------------------------------------------------------------

export function DragEvent(node) {
    const base = xnew();

    let id = null;
    let current = null;
    
    base.on('pointerdown', down);

    // prevent touch default event
    base.on('touchstart', (event) => {
        event.preventDefault();
    });

    function down(event) {
        const position = getPosition(event, id = getId(event));
        current = position;

        const type = 'down';
        node.emit(type, event, { type, position, });
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };
    function move(event) {
        const position = getPosition(event, id);
        if (position === null) return;

        const delta = { x: position.x - current.x, y: position.y - current.y };
        current = position;

        const type = 'move';
        node.emit(type, event, { type, position, delta, });
    };
    function up(event) {
        const position = getPosition(event, id);
        if (position === null) return;
        
        const type = 'up';
        node.emit(type, event, { type, position, });
        id = null;
        current = null;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
    };

    function getId(event) {
        if (event.pointerId !== undefined) {
            return event.pointerId;
        } else if (event.changedTouches !== undefined) {
            return event.changedTouches[event.changedTouches.length - 1].identifier;
        } else {
            return null;
        }
    }
    function getPosition(event, id) {
        let original = null;
        if (event.pointerId !== undefined) {
            if (id === event.pointerId) original = event;
        } else if (event.changedTouches !== undefined) {
            for (let i = 0; i < event.changedTouches.length; i++) {
                if (id === event.changedTouches[i].identifier) original = event.changedTouches[i];
            }
        } else {
            original = event;
        }
        if (original === null) return null;

        const rect = node.element.getBoundingClientRect();
       
        let scaleX = 1.0;
        let scaleY = 1.0;
        if (node.element.tagName.toLowerCase() === 'canvas' && isNumber(node.element.width) && isNumber(node.element.height)) {
            scaleX = node.element.width / rect.width;
            scaleY = node.element.height / rect.height;
        }

        return { x: scaleX * (original.clientX - rect.left), y: scaleY * (original.clientY - rect.top) };
    }

    return {
        finalize() {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        }
    }
}

//----------------------------------------------------------------------------------------------------
// d-pad
//----------------------------------------------------------------------------------------------------

export function DPad(node, { size = 130, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 } = {}) {
    node.nest({ style: `position: relative; width: ${size}px; height: ${size}px; cursor: pointer; overflow: hidden; user-select: none;`, });

    const fillStyle = `fill: ${fill}; fill-opacity: ${fillOpacity};`;
    const strokeStyle = `stroke: ${stroke}; stroke-opacity: ${strokeOpacity}; stroke-width: ${strokeWidth / (size / 100)}; stroke-linejoin: round;`;

    const targets = new Array(4);
    targets[0] = xnew({ tag: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; ${fillStyle}"`, viewBox: '0 0 100 100' }, `
        <polygon points="50 50 35 35 35  5 37  3 63  3 65  5 65 35"></polygon>
    `);
    targets[1] = xnew({ tag: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; ${fillStyle}"`, viewBox: '0 0 100 100' }, `
        <polygon points="50 50 35 65 35 95 37 97 63 97 65 95 65 65"></polygon>
    `);
    targets[2] = xnew({ tag: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; ${fillStyle}"`, viewBox: '0 0 100 100' }, `
        <polygon points="50 50 35 35  5 35  3 37  3 63  5 65 35 65"></polygon>
    `);
    targets[3] = xnew({ tag: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; ${fillStyle}"`, viewBox: '0 0 100 100' }, `
        <polygon points="50 50 65 35 95 35 97 37 97 63 95 65 65 65"></polygon>
    `);

    xnew({ tag: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; fill: none; ${strokeStyle}"`, viewBox: '0 0 100 100' }, `
        <polyline points="35 35 35  5 37  3 63  3 65  5 65 35"></polyline>
        <polyline points="35 65 35 95 37 97 63 97 65 95 65 65"></polyline>
        <polyline points="35 35  5 35  3 37  3 63  5 65 35 65"></polyline>
        <polyline points="65 35 95 35 97 37 97 63 95 65 65 65"></polyline>
        <polygon points="50 11 42 20 58 20"></polygon>
        <polygon points="50 89 42 80 58 80"></polygon>
        <polygon points="11 50 20 42 20 58"></polygon>
        <polygon points="89 50 80 42 80 58"></polygon>
    `);

    const drag = xnew(DragEvent);

    drag.on('down move', (event, { type, position }) => {
        const [x, y] = [position.x - size / 2, position.y - size / 2];
        const a = (y !== 0 || x !== 0) ? Math.atan2(y, x) : 0;
        const d = Math.min(1.0, Math.sqrt(x * x + y * y) / (size / 4));
        const vector = { x: Math.cos(a) * d, y: Math.sin(a) * d };
        vector.x = vector.x > +0.4 ? +1 : (vector.x < -0.4 ? -1 : 0);
        vector.y = vector.y > +0.4 ? +1 : (vector.y < -0.4 ? -1 : 0);

        targets[0].element.style.filter = (vector.y < 0) ? 'brightness(90%)' : '';
        targets[1].element.style.filter = (vector.y > 0) ? 'brightness(90%)' : '';
        targets[2].element.style.filter = (vector.x < 0) ? 'brightness(90%)' : '';
        targets[3].element.style.filter = (vector.x > 0) ? 'brightness(90%)' : '';

        node.emit(type, event, { type, vector });
    });

    drag.on('up', (event, { type }) => {
        for(let i = 0; i < 4; i++) {
            targets[i].element.style.filter = '';
        }
        const vector = { x: 0, y: 0 };
        node.emit(type, event, { type, vector });
    });
}

//----------------------------------------------------------------------------------------------------
// analog stick
//----------------------------------------------------------------------------------------------------

export function AnalogStick(node, { size = 130, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 } = {}) {
    node.nest({ style: `position: relative; width: ${size}px; height: ${size}px; cursor: pointer; user-select: none; overflow: hidden;`, });

    const fillStyle = `fill: ${fill}; fill-opacity: ${fillOpacity};`;
    const strokeStyle = `stroke: ${stroke}; stroke-opacity: ${strokeOpacity}; stroke-width: ${strokeWidth / (size / 100)}; stroke-linejoin: round;`;

    xnew({ tag: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; ${fillStyle} ${strokeStyle}"`, viewBox: '0 0 100 100' }, `
        <polygon points="50  7 40 18 60 18"></polygon>
        <polygon points="50 93 40 83 60 83"></polygon>
        <polygon points=" 7 50 18 40 18 60"></polygon>
        <polygon points="93 50 83 40 83 60"></polygon>
    `);
    const target = xnew({ tag: 'svg', style: `position: absolute; width: 100%; height: 100%; user-select: none; ${fillStyle} ${strokeStyle}"`, viewBox: '0 0 100 100' }, `
        <circle cx="50" cy="50" r="23"></circle>
    `);

    const drag = xnew(DragEvent);

    drag.on('down move', (event, { type, position }) => {
        target.element.style.filter = 'brightness(90%)';

        const [x, y] = [position.x - size / 2, position.y - size / 2];
        const d = Math.min(1.0, Math.sqrt(x * x + y * y) / (size / 4));
        const a = (y !== 0 || x !== 0) ? Math.atan2(y, x) : 0;
        const vector = { x: Math.cos(a) * d, y: Math.sin(a) * d };
        node.emit(type, event, { type, vector });
        [target.element.style.left, target.element.style.top] = [vector.x * size / 4 + 'px', vector.y * size / 4 + 'px'];
    });

    drag.on('up', (event, { type }) => {
        target.element.style.filter = '';

        const vector = { x: 0, y: 0 };
        node.emit(type, event, { type, vector });
        [target.element.style.left, target.element.style.top] = [vector.x * size / 4 + 'px', vector.y * size / 4 + 'px'];
    });
}


//----------------------------------------------------------------------------------------------------
// circle button
//----------------------------------------------------------------------------------------------------

export function CircleButton(node, { size = 80, fill = '#FFF', fillOpacity = 0.8, stroke = '#000', strokeOpacity = 0.8, strokeWidth = 2 } = {}) {
    node.nest({ style: `position: relative; width: ${size}px; height: ${size}px; user-select: none;`, });

    const fillStyle = `fill: ${fill}; fill-opacity: ${fillOpacity};`;
    const strokeStyle = `stroke-linejoin: round; stroke: ${stroke}; stroke-opacity: ${strokeOpacity}; stroke-width: ${strokeWidth / (size / 100)};`;

    const target = xnew({ tag: 'svg', name: 'target', style: `width: 100%; height: 100%; cursor: pointer; user-select: none; ${fillStyle} ${strokeStyle}`, viewBox: '0 0 100 100' }, `
        <circle cx="50" cy="50" r="40"></circle>
    `);

    target.on('pointerdown', down);

    // prevent touch default event
    target.on('touchstart', (event) => {
        event.preventDefault();
    });

    function down(event) {
        target.element.style.filter = 'brightness(90%)';
        const type = 'down';
        node.emit(type, event, { type });

        window.addEventListener('pointerup', up);
    }
    function up(event) {
        target.element.style.filter = '';
        const type = 'up';
        node.emit(type, event, { type });

        window.removeEventListener('pointerup', up);
    }

    return {
        finalize() {
            window.removeEventListener('pointerup', up);
        },
    }
}

