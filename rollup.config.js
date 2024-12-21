
export default [
    {
        input: 'index.js',
        output: {
            file: 'dist/xnew.js',
            format: 'umd',
            extend: true,
            name: 'window',
            freeze: false
        },
    },
    {
        input: 'index.js',
        output: {
            file: 'website/static/xnew.js',
            format: 'umd',
            extend: true,
            name: 'window',
            freeze: false
        },
    },
    {
        input: 'index.js',
        output: {
            file: 'dist/xnew.mjs',
            format: 'esm',
            extend: true,
            name: 'window',
            freeze: false
        },
    },
];