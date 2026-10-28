/**
 * The agent's prose as markdown (GitHub's flavour): never raw HTML, which
 * is dropped (`skipHtml`), and links open in a new tab.
 */
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const COMPONENTS: Components = {
  a: ({ node: _node, ...props }) => (
    <a
      {...props}
      target='_blank'
      rel='noopener noreferrer'
      className='text-trace underline underline-offset-2'
    />
  ),
  p: ({ node: _node, ...props }) => <p {...props} className='my-2' />,
  ul: ({ node: _node, ...props }) => (
    <ul {...props} className='my-2 list-disc pl-5' />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol {...props} className='my-2 list-decimal pl-5' />
  ),
  strong: ({ node: _node, ...props }) => (
    <strong {...props} className='font-semibold text-ink' />
  ),
  // inline code; a block's is reset by its `pre`
  code: ({ node: _node, ...props }) => (
    <code
      {...props}
      className='rounded bg-panel-deep px-1 py-px font-mono text-[12px] text-and'
    />
  ),
  pre: ({ node: _node, ...props }) => (
    <pre
      {...props}
      className='my-2 overflow-x-auto rounded-md border border-line bg-panel p-2 font-mono text-xs [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-ink'
    />
  ),
  table: ({ node: _node, ...props }) => (
    <div className='my-2 overflow-x-auto'>
      <table {...props} className='border-collapse text-xs' />
    </div>
  ),
  th: ({ node: _node, ...props }) => (
    <th
      {...props}
      className='border-b border-line-strong px-2 py-1 text-left font-medium'
    />
  ),
  td: ({ node: _node, ...props }) => (
    <td {...props} className='border-b border-line px-2 py-1' />
  ),
};

export function AssistantProse({ text }: { text: string }) {
  return (
    <div className='text-[13px] leading-relaxed text-ink-soft [&>:first-child]:mt-0 [&>:last-child]:mb-0'>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={COMPONENTS}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
