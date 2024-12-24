import CodeBlock from '@theme/CodeBlock';

export default function ShowExample({ height, name, code }) {
    code = code.replace('../thirdparty/matter.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.18.0/matter.min.js');
    code = code.replace('../thirdparty/three.min.js', 'https://unpkg.com/three@0.142.x/build/three.min.js');
    code = code.replace('../thirdparty/pixi.min.js', 'https://pixijs.download/v7.0.5/pixi.min.js');
    code = code.replace('../xnew.js', 'https://unpkg.com/xnew@2.0.x/dist/xnew.js');
    return (
        <>
            <iframe style={{width: '100%', height, border: 'solid 1px #DDD', borderRadius: '6px' }} src={'/xnew/examples/' + name} ></iframe>
            <CodeBlock language='html'>{code}</CodeBlock>
        </>
    )
}