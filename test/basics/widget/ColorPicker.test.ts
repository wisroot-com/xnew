import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { ColorPicker } from '../../../src/basics/widget/ColorPicker';

describe('basics ColorPicker', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
        jest.useRealTimers();
    });

    function mockRect(element: Element, rect: Partial<DOMRect>): void {
        element.getBoundingClientRect = () => ({
            left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0,
            toJSON: () => ({}), ...rect,
        }) as DOMRect;
    }

    // container children: [saturation, presets, controls, fields]
    function containerOf(unit: xnew.Unit): HTMLElement {
        return unit.element as HTMLElement;
    }

    function saturationOf(unit: xnew.Unit): HTMLElement {
        return containerOf(unit).children[0] as HTMLElement;
    }

    function presetsOf(unit: xnew.Unit): HTMLElement {
        return containerOf(unit).children[1] as HTMLElement;
    }

    // controls row children: [swatch, bars]
    function swatchOf(unit: xnew.Unit): HTMLElement {
        return containerOf(unit).children[2].children[0] as HTMLElement;
    }

    function barsOf(unit: xnew.Unit): HTMLElement {
        return containerOf(unit).children[2].children[1] as HTMLElement;
    }

    function inputsOf(unit: xnew.Unit): HTMLInputElement[] {
        return [...(containerOf(unit).children[3] as HTMLElement).querySelectorAll('input')];
    }

    function pointerdown(element: Element, clientX: number, clientY: number): void {
        element.dispatchEvent(new MouseEvent('pointerdown', { clientX, clientY, bubbles: true }));
    }

    it('builds the sketch layout: saturation, presets, swatch + hue / alpha bars, fields', () => {
        const unit = xnew(ColorPicker);

        expect(containerOf(unit).children).toHaveLength(4);
        expect(barsOf(unit).children).toHaveLength(2);
        expect(swatchOf(unit).tagName).toBe('DIV');
        expect(inputsOf(unit)).toHaveLength(5);
        expect(presetsOf(unit).children).toHaveLength(11);
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

    it('updates saturation / value from a press on the saturation map and emits -change', () => {
        const unit = xnew(ColorPicker, { value: '#ff0000' });
        const saturation = saturationOf(unit);
        mockRect(saturation, { width: 200, height: 150 });

        const received: string[] = [];
        unit.on('-change', ({ value }: { value: string }) => received.push(value));
        jest.advanceTimersByTime(0);

        pointerdown(saturation, 100, 75);

        expect(unit.value).toBe('#804040');
        expect(received).toEqual(['#804040']);
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

    it('keeps native change events inside; hosts only see -change', () => {
        const unit = xnew(ColorPicker, { value: '#ff0000' });
        const hex = inputsOf(unit)[0];

        const nativeChanges: unknown[] = [];
        const customChanges: string[] = [];
        unit.on('change', ({ value }: { value: unknown }) => nativeChanges.push(value));
        unit.on('-change', ({ value }: { value: string }) => customChanges.push(value));
        jest.advanceTimersByTime(0);

        hex.value = '00ff00';
        hex.dispatchEvent(new Event('change', { bubbles: true }));

        expect(nativeChanges).toEqual([]);
        expect(customChanges).toEqual(['#00ff00']);
    });

    it('applies a preset color on click', () => {
        const unit = xnew(ColorPicker, { value: '#ff0000' });
        const preset = presetsOf(unit).children[0] as HTMLElement;
        jest.advanceTimersByTime(0);

        preset.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(unit.value).toBe('#d0021b');
    });

    it('omits the presets section when presets is empty', () => {
        const unit = xnew(ColorPicker, { presets: [] });

        expect(containerOf(unit).children).toHaveLength(3);
    });

    it('drops the alpha bar and A field and stays opaque when alpha is false', () => {
        const unit = xnew(ColorPicker, { value: '#ff000080', alpha: false });

        expect(barsOf(unit).children).toHaveLength(1);
        expect(inputsOf(unit)).toHaveLength(4);
        expect(unit.value).toBe('#ff0000');
    });

    it('accepts a programmatic value set without emitting -change', () => {
        const unit = xnew(ColorPicker, { value: '#ff0000' });

        const received: string[] = [];
        unit.on('-change', ({ value }: { value: string }) => received.push(value));

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
});
