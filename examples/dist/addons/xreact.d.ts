import { CSSProperties, ReactElement } from 'react';

interface EmbedProps<P> {
    Component: (unit: any, props: P) => any;
    props?: P;
    className?: string;
    style?: CSSProperties;
}
declare function Embed<P>({ Component, props, className, style }: EmbedProps<P>): ReactElement;
declare const xreact: {
    Embed: typeof Embed;
};

export { xreact };
export type { EmbedProps };
