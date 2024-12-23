import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs'

export default [
    {
        input: 'index.js',
        output: {
            file: 'dist/xnew.js',
            format: 'umd',
            extend: true,
            name: 'xnew', // name: 'window
            freeze: false,
        },
        plugins: [
            resolve(), // resolve node_modules
            commonjs() // CommonJS -> ES6
        ]
    },
    {
        input: 'index.js',
        output: {
            file: 'website/static/xnew.js',
            format: 'umd',
            extend: true,
            name: 'xnew', // name: 'window
            freeze: false,
        },
        plugins: [
            resolve(), // resolve node_modules
            commonjs() // CommonJS -> ES6
        ]
    },
    {
        input: 'index.js',
        output: {
            file: 'dist/xnew.mjs',
            format: 'esm',
            extend: true,
            name: 'xnew', // name: 'window
            freeze: false
        },
        plugins: [
            resolve(), // resolve node_modules
            commonjs() // CommonJS -> ES6
        ]
    },
];