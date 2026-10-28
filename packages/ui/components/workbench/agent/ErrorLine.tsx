import { AlertCircle } from 'lucide-react';

/** a run that stopped short, a change set not applied, a crash */
export function ErrorLine({ text }: { text: string }) {
  return (
    <p className='flex items-start gap-1.5 text-[13px] text-danger'>
      <AlertCircle className='mt-0.5 h-3.5 w-3.5 shrink-0' aria-hidden />
      <span>{text}</span>
    </p>
  );
}
