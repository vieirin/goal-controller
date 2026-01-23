'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';

interface FileUploaderProps {
  onFileUpload: (content: string, fileName: string) => void;
}

export default function FileUploader({ onFileUpload }: FileUploaderProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
          JSON.parse(content); // Validate JSON
          onFileUpload(content, file.name);
        } catch (error) {
          alert('Invalid JSON file. Please upload a valid goal model file.');
        }
      };
      reader.readAsText(file);
    },
    [onFileUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/json': ['.json'],
    },
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragActive
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400'
      }`}
    >
      <input {...getInputProps()} />
      <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
      {isDragActive ? (
        <p className="text-blue-600 font-medium">Drop the file here...</p>
      ) : (
        <>
          <p className="text-gray-700 font-medium mb-2">
            Drag & drop a goal model file here
          </p>
          <p className="text-gray-500 text-sm">or click to browse</p>
          <p className="text-gray-400 text-xs mt-2">Accepts .txt or .json files</p>
        </>
      )}
    </div>
  );
}
