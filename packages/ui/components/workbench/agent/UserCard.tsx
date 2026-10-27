import type { Attachment } from '@/lib/workbench/agent/providers';
import { AttachmentChip } from './AttachmentChip';

/** the user's request, inverted from the transcript around it, with what it carried */
export function UserCard({
  text,
  attachments,
}: {
  text: string;
  attachments: readonly Attachment[];
}) {
  return (
    <div className='rounded-lg bg-ink px-3 py-2 text-[13px] text-white'>
      <p className='whitespace-pre-wrap break-words'>{text}</p>
      {attachments.length > 0 && (
        <div className='mt-2 flex flex-wrap gap-1'>
          {attachments.map(({ name }, i) => (
            <AttachmentChip key={`${name}-${i}`} name={name} inverted />
          ))}
        </div>
      )}
    </div>
  );
}
