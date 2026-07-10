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

    it('wraps an entry with a layer in @layer', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css({ frame: { layer: 'xnew', body: 'color: red;' } });
        });
        const text = styleElements()[0].textContent!;
        expect(text).toMatch(/^@layer xnew \{/);
        expect(text).toContain(`.${css.frame} {`);
    });

    it('layers each entry independently', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css({
                frame: { layer: 'xnew', body: 'color: red;' },
                plain: 'color: blue;',
            });
        });
        const text = styleElements()[0].textContent!;
        expect(text).toMatch(new RegExp(`@layer xnew \\{\\s*\\.${css.frame} \\{`));
        expect(text).toMatch(new RegExp(`\\}\\s*\\.${css.plain} \\{`));
    });

    it('emits an entry with type "keyframes" as a scoped keyframes rule', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css({
                turn: { type: 'keyframes', body: 'to { transform: rotate(1turn); }' },
            });
        });
        const text = styleElements()[0].textContent!;
        expect(css.turn).toMatch(/^xnew\d+-turn$/);
        expect(text).toContain(`@keyframes ${css.turn} {`);
        expect(text).not.toContain(`.${css.turn}`);
    });

    it('resolves a $key reference to the generated name of that entry', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css({
                turn: { type: 'keyframes', body: 'to { transform: rotate(1turn); }' },
                box: 'animation: $turn 1s linear infinite;',
            });
        });
        const text = styleElements()[0].textContent!;
        expect(text).toContain(`animation: ${css.turn} 1s linear infinite;`);
    });

    it('throws on an unknown $key reference', () => {
        expect(() => {
            xnew(() => {
                xnew.css({ box: 'animation: $missing 1s;' });
            });
        }).toThrow('unknown reference "$missing"');
    });

    it('throws on a key that is not a plain local name', () => {
        for (const name of ['.global', '@keyframes spin', 'a b', '*']) {
            expect(() => {
                xnew(() => {
                    xnew.css({ [name]: 'color: red;' });
                });
            }).toThrow('invalid local name');
        }
    });

    it('throws on an invalid type or layer (injection is rejected)', () => {
        expect(() => {
            xnew(() => {
                xnew.css({ bad: { type: 'body, .x', body: 'color: red;' } });
            });
        }).toThrow('invalid type');
        expect(() => {
            xnew(() => {
                xnew.css({ bad: { layer: 'x } body { color: red; }', body: 'color: red;' } });
            });
        }).toThrow('invalid layer');
    });

    it('leaves attribute selectors like [href$="…"] untouched', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css({ link: '&[href$=".png"] { color: red; }' });
        });
        expect(styleElements()[0].textContent).toContain('[href$=".png"]');
        expect(Object.keys(css)).toEqual(['link']);
    });

    it('keeps layered and unlayered definitions of the same body separate', () => {
        let plain!: Record<string, string>, layered!: Record<string, string>;
        xnew(() => { plain = xnew.css({ frame: 'color: red;' }); });
        xnew(() => { layered = xnew.css({ frame: { layer: 'xnew', body: 'color: red;' } }); });
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
