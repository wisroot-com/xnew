import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { ColorPicker } from '../../../src/basics/element/ColorPicker';

describe('basics ColorPicker', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    function mockRect(element: Element, rect: Partial<DOMRect>): void {
        element.getBoundingClientRect = () => ({
            left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0,
            toJSON: () => ({}), ...rect,
        }) as DOMRect;
    }

    // container children: [saturation, controls, fields]
    function containerOf(unit: xnew.Unit): HTMLElement {
        return unit.current as HTMLElement;
    }

    function saturationOf(unit: xnew.Unit): HTMLElement {
        return containerOf(unit).children[0] as HTMLElement;
    }

    // controls row children: [swatch, bars]
    function swatchOf(unit: xnew.Unit): HTMLElement {
        return containerOf(unit).children[1].children[0] as HTMLElement;
    }

    function barsOf(unit: xnew.Unit): HTMLElement {
        return containerOf(unit).children[1].children[1] as HTMLElement;
    }

    function inputsOf(unit: xnew.Unit): HTMLInputElement[] {
        return [...(containerOf(unit).children[2] as HTMLElement).querySelectorAll('input')];
    }

    function pointerdown(element: Element, clientX: number, clientY: number): void {
        element.dispatchEvent(new MouseEvent('pointerdown', { clientX, clientY, bubbles: true }));
    }

    function pointerup(element: Element, clientX: number, clientY: number): void {
        element.dispatchEvent(new MouseEvent('pointerup', { clientX, clientY, bubbles: true }));
    }

    // every value event a host would see, tagged by type, in order
    function record(unit: xnew.Unit): Array<[string, string]> {
        const seen: Array<[string, string]> = [];
        unit.on('input change', ({ event, value }: { event: Event, value: string }) => seen.push([event.type, value]));
        jest.advanceTimersByTime(0);
        return seen;
    }

    it('builds the sketch layout: saturation, swatch + hue / alpha bars, fields', () => {
        const unit = xnew(ColorPicker);

        expect(containerOf(unit).children).toHaveLength(3);
        expect(barsOf(unit).children).toHaveLength(2);
        expect(swatchOf(unit).tagName).toBe('DIV');
        expect(inputsOf(unit)).toHaveLength(5);
    });

    it('shows the initial value in the hex / RGBA fields and exposes it via .value', () => {
        const unit = xnew(ColorPicker, { value: '#D0021B' });
        const [hex, r, g, b, a] = inputsOf(unit);

        expect(unit.value).toBe('#d0021b');
        expect(hex.value).toBe('D0021B');
        expect(r.value).toBe('208');
        expect(g.value).toBe('2');
        expect(b.value).toBe('27');
        expect(a.value).toBe('100');
    });

    // native semantics: a drag streams `input`, and `change` lands once on release
    it('streams input while the saturation map is dragged and settles with change on release', () => {
        const unit = xnew(ColorPicker, { value: '#ff0000' });
        const saturation = saturationOf(unit);
        mockRect(saturation, { width: 200, height: 150 });
        const seen = record(unit);

        pointerdown(saturation, 100, 75);

        expect(unit.value).toBe('#804040');
        expect(seen).toEqual([['input', '#804040']]);

        // the drag's window-level pointerup binds a tick after the pointerdown that started it
        jest.advanceTimersByTime(0);
        pointerup(saturation, 100, 75);

        expect(seen).toEqual([['input', '#804040'], ['change', '#804040']]);
    });

    // a typed field is a one-step commit, so it fires the pair at once — no drag involved
    it('keeps half-typed field text inside: only the committed color surfaces', () => {
        const unit = xnew(ColorPicker, { value: '#ff0000' });
        const hex = inputsOf(unit)[0];
        const seen = record(unit);

        hex.value = '00ff0';
        hex.dispatchEvent(new Event('input', { bubbles: true }));

        expect(seen).toEqual([]);

        hex.value = '00ff00';
        hex.dispatchEvent(new Event('change', { bubbles: true }));

        expect(seen).toEqual([['input', '#00ff00'], ['change', '#00ff00']]);
    });

    it('places the saturation circle from the current color', () => {
        const unit = xnew(ColorPicker, { value: '#ff0000' });
        const circle = saturationOf(unit).children[0] as HTMLElement;

        expect(circle.style.left).toBe('100%');
        expect(circle.style.top).toBe('0%');
    });

    it('updates hue from a press on the hue bar', () => {
        const unit = xnew(ColorPicker, { value: '#ff0000' });
        const hue = barsOf(unit).children[0] as HTMLElement;
        mockRect(hue, { width: 200, height: 10 });
        jest.advanceTimersByTime(0);

        pointerdown(hue, 100, 5);

        expect(unit.value).toBe('#00ffff');
    });

    it('updates alpha from a press on the alpha bar and reflects it in the swatch', () => {
        const unit = xnew(ColorPicker, { value: '#ff0000' });
        const alphaBar = barsOf(unit).children[1] as HTMLElement;
        mockRect(alphaBar, { width: 200, height: 10 });
        jest.advanceTimersByTime(0);

        pointerdown(alphaBar, 100, 5);

        expect(unit.value).toBe('#ff000080');
        expect(inputsOf(unit)[4].value).toBe('50');
        const overlay = swatchOf(unit).children[0] as HTMLElement;
        expect(overlay.style.background).toBe('rgba(255, 0, 0, 0.5)');
    });

    it('commits hex text on change, keeping the current alpha for 6-digit text', () => {
        const unit = xnew(ColorPicker, { value: '#ff000080' });
        const hex = inputsOf(unit)[0];
        jest.advanceTimersByTime(0);

        hex.value = '00ff00';
        hex.dispatchEvent(new Event('change', { bubbles: true }));

        expect(unit.value).toBe('#00ff0080');
    });

    it('restores the display when the hex text does not parse', () => {
        const unit = xnew(ColorPicker, { value: '#ff0000' });
        const hex = inputsOf(unit)[0];
        jest.advanceTimersByTime(0);

        hex.value = 'not-a-color';
        hex.dispatchEvent(new Event('change', { bubbles: true }));

        expect(unit.value).toBe('#ff0000');
        expect(hex.value).toBe('FF0000');
    });

    it('commits a single RGB channel from its field', () => {
        const unit = xnew(ColorPicker, { value: '#ff0000' });
        const g = inputsOf(unit)[2];
        jest.advanceTimersByTime(0);

        g.value = '255';
        g.dispatchEvent(new Event('change', { bubbles: true }));

        expect(unit.value).toBe('#ffff00');
    });

    it('keeps the internal field change inside, so a host sees one canonical change', () => {
        const unit = xnew(ColorPicker, { value: '#ff0000' });
        const hex = inputsOf(unit)[0];

        const received: unknown[] = [];
        unit.on('change', ({ value }: { value: unknown }) => received.push(value));
        jest.advanceTimersByTime(0);

        hex.value = '00ff00';
        hex.dispatchEvent(new Event('change', { bubbles: true }));

        // the field's own change is stopped, so its raw '00ff00' never surfaces — only the picker's hex
        expect(received).toEqual(['#00ff00']);
    });

    it('drops the alpha bar and A field and stays opaque when alpha is false', () => {
        const unit = xnew(ColorPicker, { value: '#ff000080', alpha: false });

        expect(barsOf(unit).children).toHaveLength(1);
        expect(inputsOf(unit)).toHaveLength(4);
        expect(unit.value).toBe('#ff0000');
    });

    it('accepts a programmatic value set without emitting change', () => {
        const unit = xnew(ColorPicker, { value: '#ff0000' });

        const received: string[] = [];
        unit.on('change', ({ value }: { value: string }) => received.push(value));

        unit.value = '#123456';

        expect(unit.value).toBe('#123456');
        expect(inputsOf(unit)[0].value).toBe('123456');
        expect(received).toEqual([]);
    });

    it('applies className and style to the container element', () => {
        const unit = xnew(ColorPicker, { className: 'picker', style: 'width: 300px;' });

        expect(containerOf(unit).className).toContain('picker');
        expect(containerOf(unit).getAttribute('style')).toContain('width: 300px;');
    });

    // the chrome follows the host's theme; only the color space itself may be a fixed rgb value
    it('paints its chrome from currentColor and the surface behind it, not from fixed light colors', () => {
        const host = document.createElement('div');
        host.style.background = 'rgb(20, 20, 20)';
        document.body.appendChild(host);
        const unit = xnew(host, ColorPicker, {});
        jest.advanceTimersByTime(0);
        const container = unit.current as HTMLElement;
        const name = container.className.split(' ').find((entry) => /^xnew\d+-container$/.test(entry));
        const styleText = [...document.head.querySelectorAll('style')].map((style) => style.textContent).join('\n');
        const rule = styleText.split('.' + name + ' {')[1].split('}')[0];

        // the panel takes the ground it floats over, so a dark host does not leave a white box
        expect(container.style.background).toBe('rgb(20, 20, 20)');
        // the frame and the field chrome key on currentColor instead of #fff / #ccc / #333
        expect(rule).toContain('color-mix(in srgb, currentColor 25%, transparent)');
        expect(styleText).toContain('box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 30%, transparent);');
        expect(styleText).toContain('background: transparent; color: inherit;');

        host.remove();
    });

    // the saturation map, the hue bar, the transparency checkerboard and the two cursors ride on top of an
    // arbitrary color, so their fixed values are the point — they must NOT be swapped for theme colors
    it('keeps the color space and the cursors on fixed values', () => {
        xnew(ColorPicker, {});
        const styleText = [...document.head.querySelectorAll('style')].map((style) => style.textContent).join('\n');

        expect(styleText).toContain('linear-gradient(to right, #f00 0%');
        expect(styleText).toContain('conic-gradient(#ccc 0% 25%, #fff 25% 50%');
        expect(styleText).toContain('box-shadow: 0 0 0 1.5px #fff');
    });

    // unlike InputNumber / InputRange, which clamp an out-of-range write, there is no nearest valid color
    // to fall back to — so an unparseable write is a no-op, and it stays silent (no value event either)
    it('ignores an unparseable .value write, keeping the current color and announcing nothing', () => {
        const unit = xnew(ColorPicker, { value: '#4A90E2' });
        const seen: string[] = [];
        unit.on('input change', ({ event }: { event: Event }) => seen.push(event.type));
        jest.advanceTimersByTime(0);

        unit.value = 'not a color';

        expect(unit.value).toBe('#4a90e2');
        expect(seen).toEqual([]);

        // a parseable one still goes through, so the guard is not swallowing everything
        unit.value = '#00ff00';

        expect(unit.value).toBe('#00ff00');
        expect(seen).toEqual(['input', 'change']);
    });
});
