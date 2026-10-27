/**
 * The composer's attachments (goal-controller#485): an uploaded file, read
 * as text, or one of the open project's files picked by its @-chip. An
 * upload the provider doesn't take is refused here, before anything is sent.
 */
import type { AcceptedFile, Attachment, ChatProvider } from './providers';

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
};

export const acceptedFileOf = (
  provider: ChatProvider,
  name: string,
): AcceptedFile | undefined => {
  const extension = extensionOf(name);
  return provider.acceptedFiles.find((file) => file.extension === extension);
};

/** the upload input's `accept` */
export const acceptAttribute = (provider: ChatProvider): string =>
  provider.acceptedFiles.map(({ extension }) => extension).join(',');

/** a project file as an attachment, if the provider takes its type */
export const projectAttachment = (
  provider: ChatProvider,
  name: string,
  text: string,
): Attachment | undefined => {
  const accepted = acceptedFileOf(provider, name);
  return accepted && { name, mime: accepted.mime, text };
};

const readText = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('not read as text'));
    reader.onerror = () => reject(reader.error ?? new Error('not read'));
    reader.readAsText(file);
  });

export type UploadRead =
  | { ok: true; attachment: Attachment }
  | { ok: false; message: string };

/** an uploaded file, read as text if the provider takes it */
export const readUpload = async (
  provider: ChatProvider,
  file: File,
): Promise<UploadRead> => {
  const accepted = acceptedFileOf(provider, file.name);
  if (!accepted)
    return {
      ok: false,
      message: `${file.name} can't be attached: ${provider.label} takes ${provider.acceptedFiles
        .map(({ extension }) => extension)
        .join(', ')}.`,
    };
  try {
    return {
      ok: true,
      attachment: {
        name: file.name,
        mime: accepted.mime,
        text: await readText(file),
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: `${file.name} couldn't be read: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
