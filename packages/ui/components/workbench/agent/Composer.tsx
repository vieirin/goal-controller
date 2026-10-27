/**
 * The drawer's composer (goal-controller#485): the request, the open
 * project's files as @-chips (a click attaches one), uploads read as text,
 * and what is attached, removable until it is sent. An upload the provider
 * doesn't take is refused here, with the files it does.
 */
import { useRef, useState } from 'react';
import { ArrowUp, Loader2, Paperclip } from 'lucide-react';
import {
  acceptAttribute,
  acceptedFileOf,
  projectAttachment,
  readUpload,
} from '@/lib/workbench/agent/attachments';
import type { Attachment, ChatProvider } from '@/lib/workbench/agent/providers';
import { IconButton, cx } from '../ui';
import { AttachmentChip } from './AttachmentChip';

/** one of the open project's files; no text while it hasn't been read */
export type ProjectFile = { path: string; name: string; text?: string };

type Attached = { key: string; attachment: Attachment };

export function Composer({
  provider,
  projectFiles,
  running,
  disabled,
  onSend,
}: {
  provider: ChatProvider;
  projectFiles: readonly ProjectFile[];
  running: boolean;
  /** no session to run over */
  disabled: boolean;
  onSend: (text: string, attachments: readonly Attachment[]) => void;
}) {
  const [text, setText] = useState('');
  const [attached, setAttached] = useState<readonly Attached[]>([]);
  const [refusal, setRefusal] = useState<string | null>(null);
  const upload = useRef<HTMLInputElement>(null);

  const canSend = !running && !disabled && text.trim() !== '';
  const send = () => {
    if (!canSend) return;
    onSend(
      text.trim(),
      attached.map(({ attachment }) => attachment),
    );
    setText('');
    setAttached([]);
    setRefusal(null);
  };

  const attach = (key: string, attachment: Attachment) =>
    setAttached((prev) => [
      ...prev.filter((a) => a.key !== key),
      { key, attachment },
    ]);
  const detach = (key: string) =>
    setAttached((prev) => prev.filter((a) => a.key !== key));

  const toggleProjectFile = ({ path, name, text: fileText }: ProjectFile) => {
    const key = `project:${path}`;
    const attachment =
      fileText === undefined
        ? undefined
        : projectAttachment(provider, name, fileText);
    if (attached.some((a) => a.key === key)) detach(key);
    else if (attachment) attach(key, attachment);
  };

  const addUploads = async (files: readonly File[]) => {
    setRefusal(null);
    for (const file of files) {
      const read = await readUpload(provider, file);
      if (read.ok) attach(`upload:${file.name}`, read.attachment);
      else setRefusal(read.message);
    }
  };

  return (
    <div className='border-t border-line bg-white p-2'>
      <div className='rounded-lg border border-line-strong bg-white focus-within:border-ink-muted'>
        {attached.length > 0 && (
          <div
            className='flex flex-wrap gap-1 px-2 pt-2'
            aria-label='Attached files'
          >
            {attached.map(({ key, attachment }) => (
              <AttachmentChip
                key={key}
                name={attachment.name}
                onRemove={() => detach(key)}
              />
            ))}
          </div>
        )}
        <textarea
          aria-label='Message the agent'
          rows={3}
          className='block w-full resize-none bg-transparent px-2.5 py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint'
          placeholder='Ask the agent to change the goal model…'
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className='flex items-end gap-1 px-1.5 pb-1.5'>
          <div
            className='flex min-w-0 flex-1 flex-wrap gap-1'
            aria-label='Project files'
          >
            {projectFiles.map((file) => {
              const on = attached.some((a) => a.key === `project:${file.path}`);
              const refused = !acceptedFileOf(provider, file.name);
              return (
                <button
                  key={file.path}
                  type='button'
                  title={
                    refused
                      ? `${provider.label} doesn't take ${file.name}'s type`
                      : file.path
                  }
                  aria-pressed={on}
                  disabled={refused || file.text === undefined}
                  onClick={() => toggleProjectFile(file)}
                  className={cx(
                    'max-w-[12rem] truncate rounded-full border px-2 py-0.5 font-mono text-2xs transition-colors disabled:opacity-40',
                    on
                      ? 'border-trace bg-trace-soft text-trace'
                      : 'border-line-strong text-ink-muted hover:border-ink-muted hover:text-ink',
                  )}
                >
                  @ {file.name}
                </button>
              );
            })}
          </div>
          <input
            ref={upload}
            type='file'
            multiple
            hidden
            data-testid='agent-upload'
            accept={acceptAttribute(provider)}
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = '';
              void addUploads(files);
            }}
          />
          <IconButton
            icon={Paperclip}
            label='Attach a file'
            onClick={() => upload.current?.click()}
          />
          <button
            type='button'
            aria-label='Send'
            disabled={!canSend}
            onClick={send}
            className='inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-trace text-white transition-opacity hover:opacity-90 disabled:opacity-40'
          >
            {running ? (
              <Loader2 className='h-4 w-4 animate-spin' aria-hidden />
            ) : (
              <ArrowUp className='h-4 w-4' aria-hidden />
            )}
          </button>
        </div>
      </div>
      {refusal && (
        <p role='alert' className='mt-1 px-1 text-2xs text-danger'>
          {refusal}
        </p>
      )}
    </div>
  );
}
