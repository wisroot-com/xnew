import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Gate } from '../../../src/basics/widget/Gate';
import { ToggleBar } from '../../../src/basics/widget/ToggleBar';

describe('basics ToggleBar', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
        jest.useRealTimers();
    });

    // the stroke the gate turns is the last path of the marker (plusminus draws its crossbar first)
    function turnOf(bar: xnew.Unit): HTMLElement {
        const paths = (bar.current as HTMLElement).querySelectorAll('svg path');
        return paths[paths.length - 1] as unknown as HTMLElement;
    }

    it('draws the marker before the label and re-exposes the gate it was given', () => {
        const gate = xnew(Gate, { open: false });
        const bar = xnew(ToggleBar, { gate, label: 'accordion' });
        const row = bar.current as HTMLElement;

        expect(row.textContent).toBe('accordion');
        expect(row.firstElementChild?.tagName.toLowerCase()).toBe('svg');
        expect(bar.gate).toBe(gate);
    });

    it('toggles the gate on a press, both ways', () => {
        const gate = xnew(Gate, { open: false });
        const bar = xnew(ToggleBar, { gate, label: 'accordion' });
        jest.advanceTimersByTime(1);   // the click listener attaches on the next tick (see EventBinder)

        (bar.current as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }));
        jest.advanceTimersByTime(1);
        expect(gate.state).toBe('opened');

        (bar.current as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }));
        jest.advanceTimersByTime(1);
        expect(gate.state).toBe('closed');
    });

    it('turns the marker a quarter with the gate, from the value it starts at', () => {
        const opened = xnew(ToggleBar, { gate: xnew(Gate, { open: true }), label: 'a' });
        expect(turnOf(opened).style.transform).toBe('rotate(90deg)');

        const gate = xnew(Gate, { open: false, duration: 100 });
        const bar = xnew(ToggleBar, { gate, label: 'b' });
        expect(turnOf(bar).style.transform).toBe('rotate(0deg)');

        gate.open();
        jest.advanceTimersByTime(50);
        const halfway = parseFloat(turnOf(bar).style.transform.replace(/[^\d.]/g, ''));
        expect(halfway).toBeGreaterThan(0);
        expect(halfway).toBeLessThan(90);

        jest.advanceTimersByTime(100);
        expect(turnOf(bar).style.transform).toBe('rotate(90deg)');
    });

    it('draws one chevron stroke by default, and a crossed pair for the plusminus marker', () => {
        const chevron = xnew(ToggleBar, { gate: xnew(Gate, { open: false }), label: 'a' });
        const plusminus = xnew(ToggleBar, { gate: xnew(Gate, { open: false }), label: 'b', marker: 'plusminus' });

        expect((chevron.current as HTMLElement).querySelectorAll('svg path').length).toBe(1);
        // the crossbar stays put, the upright is the one that turns
        const paths = (plusminus.current as HTMLElement).querySelectorAll('svg path');
        expect(paths.length).toBe(2);
        expect((paths[0] as unknown as HTMLElement).style.transform).toBe('');
        expect((paths[1] as unknown as HTMLElement).style.transform).toBe('rotate(0deg)');
    });

    it('lays the plusminus upright down onto its crossbar once open, so it reads as a minus', () => {
        const gate = xnew(Gate, { open: true });
        const bar = xnew(ToggleBar, { gate, label: 'a', marker: 'plusminus' });

        expect(turnOf(bar).style.transform).toBe('rotate(90deg)');
    });

    it('keeps the row bare when no label is given, so content can be composed in instead', () => {
        const bar = xnew(() => {
            xnew.extend(ToggleBar, { gate: xnew(Gate, { open: false }) });
            xnew('<span>', 'composed');
        });
        const row = bar.current as HTMLElement;

        expect(row.textContent).toBe('composed');
        expect(row.querySelectorAll('div').length).toBe(0);
    });
});
