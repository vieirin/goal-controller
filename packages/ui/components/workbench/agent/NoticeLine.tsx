import { Info } from 'lucide-react';

/** what the drawer did on its own: a proposal sent back to the agent */
export function NoticeLine({ text }: { text: string }) {
  return (
    <p className='flex items-start gap-1.5 text-[13px] text-ink-muted'>
      <Info className='mt-0.5 h-3.5 w-3.5 shrink-0' aria-hidden />
      <span>{text}</span>
    </p>
  );
}
