import CodeBlock from '@theme/CodeBlock';

export default function ShowExample({ height, name, code }) {
    const xnewpath = 'https://unpkg.com/@mulsense/xnew@0.9.x/dist/';

    code = code.replace('../../thirdparty/matter/matter.min.mjs', 'https://cdn.jsdelivr.net/npm/matter-js@0.20.0/+esm');
    code = code.replace('../../thirdparty/three/three.module.js', 'https://cdn.jsdelivr.net/npm/three@0.176.0/+esm');
    code = code.replace('../../thirdparty/pixi/pixi.min.mjs', 'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/8.6.6/pixi.min.mjs');
    // https://esm.sh/@dimforge/rapier2d-compat@0.16.0/es2022/rapier2d-compat.mjs
    code = code.replace('../../dist/xnew.mjs', xnewpath + 'xnew.mjs');
    code = code.replace('../../dist/addons/xpixi.mjs', xnewpath + 'addons/xpixi.mjs');
    code = code.replace('../../dist/addons/xthree.mjs', xnewpath + 'addons/xthree.mjs');
    code = code.replace('../../dist/addons/xmatter.mjs', xnewpath + 'addons/xmatter.mjs');
    code = code.replace('../../dist/addons/xaudio.mjs', xnewpath + 'addons/xaudio.mjs');

    code = code.replace('../../thirdparty/matter/matter.min.js', 'https://cdn.jsdelivr.net/npm/matter-js@0.20.0');
    code = code.replace('../../thirdparty/three/three.min.js', 'https://cdn.jsdelivr.net/npm/three@0.176.0');
    code = code.replace('../../thirdparty/pixi/pixi.min.js', 'https://pixijs.download/v7.0.5/pixi.min.js');
    code = code.replace('../../thirdparty/rapier/rapier2d-compat.mjs', 'https://cdn.jsdelivr.net/npm/@dimforge/rapier2d-compat@0.19.3/+esm');
    code = code.replace('../../thirdparty/rapier/rapier3d-compat.mjs', 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.19.3/+esm');
    
    code = code.replace('../../thirdparty/three-vrm/three-vrm.module.min.js', 'https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@3/lib/three-vrm.module.min.js');

 
    code = code.replace('../../thirdparty/tailwindcss/playcdn.js', 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4');
 
    code = code.replace('../../thirdparty/html2canvas/html2canvas-pro.min.js', 'https://cdn.jsdelivr.net/npm/html2canvas-pro@1.5.13/dist/html2canvas-pro.min.js')
    code = code.replace('../../thirdparty/html2canvas/html2canvas-pro.esm.js', 'https://cdn.jsdelivr.net/npm/html2canvas-pro@1.5.13/+esm')
    return (
        <>
            <iframe style={{width: '100%', height, border: 'solid 1px #DDD', borderRadius: '6px' }} src={'/xnew/' + name} ></iframe>
            <CodeBlock language='html'>{code}</CodeBlock>
        </>
    )
}