import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('xnew.css', () => {
    beforeEach(() => { Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); });

    function styleElements(): HTMLStyleElement[] {
        return [...document.head.querySelectorAll('style')];
    }

    it('returns a unique generated name per $name', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css`.$frame { color: red; } .$icon { width: 16px; }`;
        });
        expect(Object.keys(css)).toEqual(['frame', 'icon']);
        expect(css.frame).toMatch(/^xnew\d+-frame$/);
        expect(css.icon).toMatch(/^xnew\d+-icon$/);
        expect(css.frame).not.toBe(css.icon);
    });

    it('injects one <style> with the text verbatim, $names substituted', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css`.$frame { color: red; }`;
        });
        const styles = styleElements();
        expect(styles).toHaveLength(1);
        expect(styles[0].textContent).toBe(`.${css.frame} { color: red; }`);
    });

    it('keeps @layer blocks as written', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css`@layer xnew { .$frame { color: red; } }`;
        });
        const text = styleElements()[0].textContent!;
        expect(text).toMatch(/^@layer xnew \{/);
        expect(text).toContain(`.${css.frame} { color: red; }`);
    });

    it('scopes an @keyframes name and its references alike', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css`
                @keyframes $turn { to { transform: rotate(1turn); } }
                .$box { animation: $turn 1s linear infinite; }
            `;
        });
        const text = styleElements()[0].textContent!;
        expect(css.turn).toMatch(/^xnew\d+-turn$/);
        expect(text).toContain(`@keyframes ${css.turn} {`);
        expect(text).toContain(`animation: ${css.turn} 1s linear infinite;`);
    });

    it('leaves attribute selectors like [href$="…"] untouched', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css`.$link[href$=".png"] { color: red; }`;
        });
        expect(Object.keys(css)).toEqual(['link']);
        expect(styleElements()[0].textContent).toContain('[href$=".png"]');
    });

    it('joins interpolated values into the text', () => {
        const color = 'green';
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css`.$frame { color: ${color}; }`;
        });
        expect(styleElements()[0].textContent).toBe(`.${css.frame} { color: green; }`);
    });

    it('shares one <style> and the same names across units with an identical text', () => {
        const make = () => xnew.css`.$frame { color: red; }`;
        let a!: Record<string, string>, b!: Record<string, string>;
        xnew(() => { a = make(); });
        xnew(() => { b = make(); });
        expect(styleElements()).toHaveLength(1);
        expect(b.frame).toBe(a.frame);
    });

    it('generates distinct names for different texts with the same $name', () => {
        let a!: Record<string, string>, b!: Record<string, string>;
        xnew(() => { a = xnew.css`.$frame { color: red; }`; });
        xnew(() => { b = xnew.css`.$frame { color: blue; }`; });
        expect(styleElements()).toHaveLength(2);
        expect(b.frame).not.toBe(a.frame);
    });

    it('removes the <style> only when the last unit using the text finalizes', () => {
        const make = () => xnew.css`.$frame { color: red; }`;
        const first = xnew(() => { make(); });
        const second = xnew(() => { make(); });

        first.finalize();
        expect(styleElements()).toHaveLength(1);

        second.finalize();
        expect(styleElements()).toHaveLength(0);
    });

    it('reuses the removed text by injecting a fresh <style>', () => {
        const make = () => xnew.css`.$frame { color: red; }`;
        const first = xnew(() => { make(); });
        first.finalize();
        expect(styleElements()).toHaveLength(0);

        xnew(() => { make(); });
        expect(styleElements()).toHaveLength(1);
    });

    it('works outside initialization (in a deferred callback)', () => {
        let css!: Record<string, string>;
        const unit = xnew(() => {});
        Unit.scope(unit._.lastSnapshot!, () => {
            css = xnew.css`.$late { color: green; }`;
        });
        expect(css.late).toMatch(/^xnew\d+-late$/);
        expect(styleElements()).toHaveLength(1);

        unit.finalize();
        expect(styleElements()).toHaveLength(0);
    });
});
