//----------------------------------------------------------------------------------------------------
// Pin — a DOM element that rides a moving point of the canvas laid under it
// The point arrives as a fraction of the frame, so whoever owns the scene does the projecting (xthree /
// xpixi .project) and this stays plain DOM: fractions, not pixels, so a pin holds its place on resize.
//----------------------------------------------------------------------------------------------------

import { xnew } from '../../core/xnew';

// a place on the frame, as a fraction of it (0,0 top-left / 1,1 bottom-right)
export interface PinPoint {
    x: number;
    y: number;
}

// where a point off the top of the box slides to; the middle is the one place every object is seen from
const CENTER: PinPoint = { x: 0.5, y: 0.5 };

export interface PinProps {
    // the point the element's bottom edge sits on; null while it cannot be placed (behind the camera, not loaded yet)
    point: () => PinPoint | null;
    // the space kept between the point and the element, as a fraction of the box height
    gap?: number;
    // the element the point is a fraction of (the canvas on screen); omit it when the pin sits in that very box
    frame?: HTMLElement;
}

// Create it inside a positioned box — left / top are percentages of that box, and it is the canvas box unless `frame` names another (what fit: 'cover' needs, where the canvas runs past the box it is seen through). The content is the caller's, added into the pin as usual.
export function Pin(unit: xnew.Unit, { point, gap = 0, frame }: PinProps): void {
    const css = xnew.css('base', {
        pin: `
                position: absolute; left: 0; top: 0;
                display: flex; flex-direction: column; align-items: center;
                transform: translate(-50%, -100%);
                white-space: nowrap; pointer-events: none; user-select: none;
            `,
    });

    xnew.nest({ tag: 'div', className: css.pin });

    // content added afterwards moves unit.current onto itself, so the element to place is caught here
    const element = unit.current as HTMLElement;

    let size = { width: 0, height: 0 };              // the element, as a fraction of the box
    let map = { x: 0, y: 0, width: 1, height: 1 };   // where `frame` sits in the box, likewise

    // measuring every frame would relayout against the left / top just written, once per pin at that; the
    // element only changes size with its content, and the two rects only with the layout around them
    function measure(): void {
        const box = element.parentElement;

        if (box === null || box.clientWidth === 0 || box.clientHeight === 0) {
            return;
        }
        size = { width: element.offsetWidth / box.clientWidth, height: element.offsetHeight / box.clientHeight };

        if (frame !== undefined && frame !== box) {
            const outer = box.getBoundingClientRect();
            const inner = frame.getBoundingClientRect();

            map = {
                x: (inner.left - outer.left) / outer.width, y: (inner.top - outer.top) / outer.height,
                width: inner.width / outer.width, height: inner.height / outer.height,
            };
        }
    }
    measure();

    unit.on('resize', measure);
    unit.on('window.resize', measure);   // the box can move without this element changing size

    // the point comes as a fraction of `frame`; everything below works in fractions of the box
    function onBox(at: PinPoint | null): PinPoint | null {
        return at === null ? null : { x: map.x + at.x * map.width, y: map.y + at.y * map.height };
    }

    // the spot the bottom edge takes: on the point, or slid toward the middle until the element is inside the box
    function spot(): PinPoint | null {
        const from = onBox(point());

        if (from === null) {
            return null;
        }

        // the element stands on the point and grows upward, so it clears the top edge only this far down
        const limit = size.height + gap;
        // sliding toward the middle keeps the element over its object; stopping at the edge would leave it floating
        const drop = from.y >= limit ? 0 : Math.max(0, Math.min(1, (limit - from.y) / (CENTER.y - from.y)));
        const x = from.x + (CENTER.x - from.x) * drop;
        const y = from.y + (CENTER.y - from.y) * drop;

        // across the frame it is only kept inside; unlike the drop, a small sideways shift costs nothing
        return { x: Math.min(1 - size.width / 2, Math.max(size.width / 2, x)), y: y - gap };
    }

    function follow(): void {
        const at = spot();

        // hidden rather than removed, so the size keeps being measurable while the point is unplaceable
        element.style.visibility = at === null ? 'hidden' : 'visible';

        // rounded because CSS has no exponent notation: a value that lands on 1e-15 is rejected outright,
        // leaving the last frame's position in place. 3 decimals is 0.01px on a 1000px box
        if (at !== null) {
            element.style.left = `${(at.x * 100).toFixed(3)}%`;
            element.style.top = `${(at.y * 100).toFixed(3)}%`;
        }
    }
    follow();   // so the first frame is not spent in the corner of the box

    unit.on('update', follow);
}
