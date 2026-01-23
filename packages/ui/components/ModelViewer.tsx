'use client';

interface ModelViewerProps {
  content: string;
  fileName: string;
}

export default function ModelViewer({ content, fileName }: ModelViewerProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="bg-gray-800 text-gray-100 px-4 py-2 rounded-t-lg font-medium text-sm">
        {fileName}
      </div>
      <div className="flex-1 bg-gray-900 text-gray-100 p-4 rounded-b-lg overflow-auto font-mono text-sm">
        <pre className="whitespace-pre-wrap">{content}</pre>
      </div>
    </div>
  );
}
