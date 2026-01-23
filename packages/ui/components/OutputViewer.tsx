'use client';

import { Download, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface OutputViewerProps {
  output: string;
  engine: 'prism' | 'sleec';
  fileName: string;
}

export default function OutputViewer({ output, engine, fileName }: OutputViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const fileExtension = engine === 'prism' ? 'prism' : 'sleec';
    const baseFileName = fileName.replace(/\.(txt|json)$/, '');
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseFileName}.${fileExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-gray-800 text-gray-100 px-4 py-2 rounded-t-lg flex justify-between items-center">
        <span className="font-medium text-sm">
          Output ({engine.toUpperCase()})
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={handleDownload}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="Download file"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 bg-gray-900 text-gray-100 p-4 rounded-b-lg overflow-auto font-mono text-sm">
        <pre className="whitespace-pre-wrap">{output}</pre>
      </div>
    </div>
  );
}
