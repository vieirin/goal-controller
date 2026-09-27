export const downloadText = (fileName: string, text: string, type = 'text/plain'): void => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const baseName = (fileName: string): string =>
  fileName.replace(/\.(txt|json)$/i, '') || 'model';
