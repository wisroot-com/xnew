import CodeBlock from '@theme/CodeBlock';

export default function ShowCode({ code, title = null }) {
    return (
        <>
            <CodeBlock language='js' title={title}>{code}</CodeBlock>
        </>
    )
}