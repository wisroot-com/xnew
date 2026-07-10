import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('xnew.css', () => {
    beforeEach(() => { Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); });

    function styleElements(): HTMLStyleElement[] {
        return [...document.head.querySelectorAll('style')];
    }

    it('returns a unique class name per local key', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css({ frame: 'color: red;', icon: 'width: 16px;' });
        });
        expect(Object.keys(css)).toEqual(['frame', 'icon']);
        expect(css.frame).toMatch(/^xnew\d+-frame$/);
        expect(css.icon).toMatch(/^xnew\d+-icon$/);
        expect(css.frame).not.toBe(css.icon);
    });

    it('injects one <style> wrapping each block in its generated class, unlayered by default', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css({ frame: 'color: red;' });
        });
        const styles = styleElements();
        expect(styles).toHaveLength(1);
        expect(styles[0].textContent).not.toContain('@layer');
        expect(styles[0].textContent).toContain(`.${css.frame} {`);
        expect(styles[0].textContent).toContain('color: red;');
    });

    it('wraps the rules in the given @layer when a leading layer name is passed', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css('xnew', { frame: 'color: red;' });
        });
        const styles = styleElements();
        expect(styles).toHaveLength(1);
        expect(styles[0].textContent).toMatch(/^@layer xnew \{/);
        expect(styles[0].textContent).toContain(`.${css.frame} {`);
    });

    it('keeps layered and unlayered registrations of the same defs separate', () => {
        const defs = { frame: 'color: red;' };
        let plain!: Record<string, string>, layered!: Record<string, string>;
        xnew(() => { plain = xnew.css(defs); });
        xnew(() => { layered = xnew.css('xnew', defs); });
        expect(styleElements()).toHaveLength(2);
        expect(layered.frame).not.toBe(plain.frame);
    });

    it('shares one <style> and the same names across units with an identical definition', () => {
        const defs = { frame: 'color: red;' };
        let a!: Record<string, string>, b!: Record<string, string>;
        xnew(() => { a = xnew.css(defs); });
        xnew(() => { b = xnew.css(defs); });
        expect(styleElements()).toHaveLength(1);
        expect(b.frame).toBe(a.frame);
    });

    it('generates distinct names for different definitions with the same local key', () => {
        let a!: Record<string, string>, b!: Record<string, string>;
        xnew(() => { a = xnew.css({ frame: 'color: red;' }); });
        xnew(() => { b = xnew.css({ frame: 'color: blue;' }); });
        expect(styleElements()).toHaveLength(2);
        expect(b.frame).not.toBe(a.frame);
    });

    it('removes the <style> only when the last unit using the definition finalizes', () => {
        const defs = { frame: 'color: red;' };
        const first = xnew(() => { xnew.css(defs); });
        const second = xnew(() => { xnew.css(defs); });

        first.finalize();
        expect(styleElements()).toHaveLength(1);

        second.finalize();
        expect(styleElements()).toHaveLength(0);
    });

    it('reuses the removed definition by injecting a fresh <style>', () => {
        const defs = { frame: 'color: red;' };
        const first = xnew(() => { xnew.css(defs); });
        first.finalize();
        expect(styleElements()).toHaveLength(0);

        xnew(() => { xnew.css(defs); });
        expect(styleElements()).toHaveLength(1);
    });

    it('works outside initialization (in a deferred callback)', () => {
        let css!: Record<string, string>;
        const unit = xnew(() => {});
        Unit.scope(unit._.lastSnapshot!, () => {
            css = xnew.css({ late: 'color: green;' });
        });
        expect(css.late).toMatch(/^xnew\d+-late$/);
        expect(styleElements()).toHaveLength(1);

        unit.finalize();
        expect(styleElements()).toHaveLength(0);
    });
});
