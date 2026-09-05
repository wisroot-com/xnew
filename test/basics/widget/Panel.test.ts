import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Panel } from '../../../src/basics/widget/Panel';

describe('basics Panel', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
        jest.useRealTimers();
    });

    function newPanel(): { host: HTMLElement, panel: any } {
        const host = document.createElement('div');
        return { host, panel: xnew(host, Panel) };
    }

    describe('open', () => {
        test('an open value makes the panel collapsible, exposing its gate', () => {
            const host = document.createElement('div');
            const panel: any = xnew(host, Panel, { name: 'GUI', open: true });
            panel.button({ name: 'one' });
            expect(host.textContent).toContain('GUI');
            expect(panel.gate).not.toBe(undefined);
            expect((panel.element as HTMLElement).querySelector('button')).not.toBe(null);
        });

        test('leaving open undefined keeps the rows always shown, with no header and no gate', () => {
            const host = document.createElement('div');
            const panel: any = xnew(host, Panel, { name: 'GUI' });
            panel.button({ name: 'one' });
            expect(host.textContent).not.toContain('GUI');
            expect(panel.gate).toBe(undefined);
            expect(host.querySelector('button')).not.toBe(null);
        });
    });

    describe('group', () => {
        test('builds the rows of its inner callback inside the created group', () => {
            const { host, panel } = newPanel();
            panel.group({ name: 'settings', open: true }, (group: any) => {
                group.button({ name: 'one' });
                xnew('<p>', 'two');
            });
            expect(host.querySelectorAll('button').length).toBe(1);
            expect(host.querySelector('p')).not.toBe(null);
            expect(host.textContent).toContain('settings');
        });

        test('container wraps the header and the rows, so hiding it hides the group as a whole', () => {
            const { panel } = newPanel();
            const group = panel.group({ name: 'settings', open: true }, (group: any) => {
                group.button({ name: 'one' });
            });
            const wrapper = group.container as HTMLElement;
            expect(wrapper.textContent).toContain('settings');
            expect(wrapper.querySelector('button')).not.toBe(null);
            expect(wrapper.contains(group.element)).toBe(true);
        });

        test('groups nest, and a nested group shares the outer params object', () => {
            const params: Record<string, any> = {};
            const host = document.createElement('div');
            const panel: any = xnew(host, Panel, { params });
            panel.group({ name: 'outer', open: true }, (group: any) => {
                group.group({ name: 'inner', open: true }, (subgroup: any) => {
                    subgroup.checkbox({ name: 'flag', value: true });
                });
            });
            expect(params.flag).toBe(true);
            expect(host.textContent).toContain('outer');
            expect(host.textContent).toContain('inner');
        });
    });
});
