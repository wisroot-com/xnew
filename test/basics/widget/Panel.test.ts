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

    describe('group', () => {
        test('builds its rows inside the created group', () => {
            const { host, panel } = newPanel();
            panel.group({ name: 'settings', open: true }, (group: any) => {
                group.button({ name: 'one' });
            });
            expect(host.querySelectorAll('button').length).toBe(1);
            expect(host.textContent).toContain('settings');
        });

        test('a key registers the group; a later call appends into the same unit', () => {
            const { host, panel } = newPanel();
            const created = panel.group('mygroup', { open: true }, (group: any) => {
                group.button({ name: 'one' });
            });
            const appended = panel.group('mygroup', { open: true }, (group: any) => {
                group.button({ name: 'two' });
            });
            expect(appended).toBe(created);
            expect(host.querySelectorAll('button').length).toBe(2);
        });

        test('a later call mounts under the group, so a raw xnew lands inside it', () => {
            const { host, panel } = newPanel();
            const group = panel.group('mygroup', { open: true });
            panel.group('mygroup', () => {
                xnew('<p>', 'late');
            });
            const paragraph = host.querySelector('p');
            expect(paragraph).not.toBe(null);
            expect((group.element as HTMLElement).contains(paragraph)).toBe(true);
        });

        test('a lone key looks the group up without creating one', () => {
            const { panel } = newPanel();
            const created = panel.group('mygroup', { open: true });
            expect(panel.group('mygroup')).toBe(created);
            expect(panel.group('unknown')).toBe(null);
        });

        test('the key doubles as the header label unless options.name overrides it', () => {
            const { host, panel } = newPanel();
            panel.group('screen', { open: true });
            panel.group('audio', { name: 'Sound', open: true });
            expect(host.textContent).toContain('screen');
            expect(host.textContent).toContain('Sound');
            expect(host.textContent).not.toContain('audio');
        });

        test('groups nest, so a nested key is looked up through its parent group', () => {
            const { host, panel } = newPanel();
            const outer = panel.group('outer', { open: true }, (group: any) => {
                group.group('inner', { open: true });
            });
            expect(panel.group('outer')).toBe(outer);
            expect(panel.group('outer').group('inner')).not.toBe(null);

            panel.group('outer').group('inner', (group: any) => group.button({ name: 'late' }));
            expect(host.querySelectorAll('button').length).toBe(1);
        });

        test('container wraps the header and the rows, so hiding it hides the group as a whole', () => {
            const { panel } = newPanel();
            const group = panel.group('mygroup', { open: true }, (group: any) => {
                group.button({ name: 'one' });
            });
            const wrapper = group.container as HTMLElement;
            expect(wrapper.textContent).toContain('mygroup');
            expect(wrapper.querySelector('button')).not.toBe(null);
            expect(wrapper.contains(group.element)).toBe(true);
        });

        test('an anonymous group is not registered', () => {
            const { panel } = newPanel();
            panel.group({ name: 'settings', open: true });
            expect(panel.group('settings')).toBe(null);
        });
    });
});
