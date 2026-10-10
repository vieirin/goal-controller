import { outputBaseName } from '@goal-controller/lib';

const download = (fileName: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const downloadText = (
  fileName: string,
  text: string,
  type = 'text/plain',
): void => download(fileName, new Blob([text], { type }));

export const downloadBytes = (
  fileName: string,
  bytes: Uint8Array,
  type = 'application/zip',
): void => download(fileName, new Blob([bytes as BlobPart], { type }));

/** A model's name without its .txt or .json: what its outputs are named after. */
export const baseName = outputBaseName;
