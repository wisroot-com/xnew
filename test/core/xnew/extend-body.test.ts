import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('xnew(Base, props?, body)', () => {
    beforeEach(() => { Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); });

    it('extends Base then runs the trailing body on the same unit', () => {
        function Base(_: Unit) { return { hello() { return 'hi'; } }; }

        const seen = jest.fn();
        const unit = xnew(Base, (unit: Unit) => {
            seen((unit as any).hello());
            return { world() { return 'earth'; } };
        }) as any;

        expect(seen).toHaveBeenCalledWith('hi');
        expect(unit.hello()).toBe('hi');
        expect(unit.world()).toBe('earth');
    });

    it('passes props to both Base and the body', () => {
        function Base(_: Unit, props: { prefix: string }) {
            return { format(text: string) { return `${props.prefix}: ${text}`; } };
        }

        const bodyProps = jest.fn();
        const unit = xnew(Base, { prefix: 'LOG' }, (unit: Unit, props: { prefix: string }) => {
            bodyProps(props.prefix);
            return { logMessage(message: string) { return (unit as any).format(message); } };
        }) as any;

        expect(bodyProps).toHaveBeenCalledWith('LOG');
        expect(unit.logMessage('test')).toBe('LOG: test');
    });

    it('is equivalent to xnew.extend(Base) inside a body', () => {
        function Base(unit: Unit) {
            (unit as any).counter = 0;
            return { increment() { (unit as any).counter++; }, getCounter() { return (unit as any).counter; } };
        }

        const viaBody = xnew(Base, (unit: Unit) => {
            return { incrementBy(value: number) { (unit as any).counter += value; } };
        }) as any;

        const viaExtend = xnew((unit: Unit) => {
            xnew.extend(Base);
            return { incrementBy(value: number) { (unit as any).counter += value; } };
        }) as any;

        viaBody.increment();
        viaBody.incrementBy(5);
        viaExtend.increment();
        viaExtend.incrementBy(5);

        expect(viaBody.getCounter()).toBe(6);
        expect(viaExtend.getCounter()).toBe(6);
    });

    it('initializes Base before the body', () => {
        const log: string[] = [];
        function Base(_: Unit) { log.push('base-init'); return {}; }

        xnew(Base, () => { log.push('body-init'); });

        expect(log).toEqual(['base-init', 'body-init']);
    });

    it('still treats a plain object second argument as props (no body)', () => {
        function Base(_: Unit, props: { prefix: string }) {
            return { format(text: string) { return `${props.prefix}: ${text}`; } };
        }

        const unit = xnew(Base, { prefix: 'X' }) as any;
        expect(unit.format('y')).toBe('X: y');
    });

    it('supports a target element before Base and body', () => {
        function Base(_: Unit) { return { tag() { return 'base'; } }; }

        const unit = xnew('<section>', Base, (unit: Unit) => {
            return { where() { return unit.element.tagName.toLowerCase(); } };
        }) as any;

        expect(unit.tag()).toBe('base');
        expect(unit.where()).toBe('section');
    });

    it('treats a trailing string/number as text set on the element', () => {
        function Base(_: Unit) { return { tag() { return 'base'; } }; }

        const withProps = xnew('<div>', Base, { key: 'k' }, 'hello') as any;
        expect(withProps.tag()).toBe('base');
        expect(withProps.element.textContent).toBe('hello');

        const noProps = xnew('<div>', Base, 42) as any;
        expect(noProps.element.textContent).toBe('42');
    });
});
