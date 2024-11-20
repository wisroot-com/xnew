import React from 'react';
import ReactDOM from 'react-dom/client';
import { xnew, xfind, xtimer, xutil, xcomponents } from 'xnew';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Main/>);

function Main() {
    const ref = React.useRef();
    React.useEffect(() => {
        xnew(ref.current, Component);
    }, []);
    return (
        <div ref={ref}></div>
    );
}

function Component(xnode) {
    xnode.nestElement({ tag: 'button', style: 'padding: 8px;' });
    xnode.element.textContent = 'click ';

    let count = 0;
    xtimer(() => {
        xnode.element.textContent = 'click ' + count++;
    }, 1000, true);
}