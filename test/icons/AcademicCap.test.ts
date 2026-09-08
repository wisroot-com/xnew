import { Unit } from '../../src/core/unit';
import { xnew } from '../../src/core/xnew';
import { xicons } from '../../src/icons/xicons';
import { iconData } from '../../src/icons/data';

describe('icons xicons (AcademicCap)', () => {
    beforeEach(() => {
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.destroy();
    });

    it('exposes a component per heroicons entry', () => {
        expect(typeof xicons.AcademicCap).toBe('function');
        expect(Object.keys(xicons).length).toBe(Object.keys(iconData).length);
    });

    it('nests an <svg> with the heroicons 24 viewBox and the outline paths by default', () => {
        const unit = xnew(xicons.AcademicCap);
        const svg = unit.current as SVGSVGElement;

        expect(svg.tagName.toLowerCase()).toBe('svg');
        expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
        expect(svg.querySelectorAll('path').length).toBe(iconData.AcademicCap.o.length);
    });

    it('renders the solid variant with its filled paths', () => {
        const unit = xnew(xicons.AcademicCap, { mode: 'solid' });

        expect(unit.current.querySelectorAll('path').length).toBe(iconData.AcademicCap.s.length);
    });

    it('injects an @layer base rule referencing currentColor for the active mode', () => {
        const unit = xnew(xicons.AcademicCap, { mode: 'solid' });
        const styleText = Array.from(document.head.querySelectorAll('style')).map((s) => s.textContent).join('');
        const generated = (unit.current as SVGSVGElement).getAttribute('class')?.split(' ')[0] ?? '';

        expect(generated).not.toBe('');
        expect(styleText).toContain('@layer base');
        expect(styleText).toContain(`.${generated}`);
        expect(styleText).toContain('fill: currentColor;');
    });

    it('applies fill-rule / clip-rule "evenodd" for a solid path marked as a tuple', () => {
        // CheckCircle solid is a single evenodd path (hole punched out)
        const unit = xnew(xicons.CheckCircle, { mode: 'solid' });
        const path = unit.current.querySelector('path') as SVGPathElement;

        expect(Array.isArray(iconData.CheckCircle.s[0])).toBe(true);
        expect(path.getAttribute('fill-rule')).toBe('evenodd');
        expect(path.getAttribute('clip-rule')).toBe('evenodd');
    });

    it('appends caller className / style onto the svg element', () => {
        const unit = xnew(xicons.AcademicCap, { mode: 'solid', className: 'size-8', style: 'opacity: 0.5;' });
        const svg = unit.current as SVGSVGElement;

        expect(svg.getAttribute('class')).toContain('size-8');
        expect(svg.getAttribute('style')).toContain('opacity: 0.5;');
    });
});
