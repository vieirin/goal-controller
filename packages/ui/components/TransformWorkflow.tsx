'use client';

import type { LoggerReport } from '@goal-controller/lib';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import EngineSelector from './EngineSelector';
import FileUploader from './FileUploader';
import ModelViewer from './ModelViewer';
import OutputViewer from './OutputViewer';
import ReportViewer from './ReportViewer';
import VariablesEditor from './VariablesEditor';

interface TransformRequest {
  modelJson: string;
  engine: 'prism' | 'sleec';
  clean: boolean;
  fileName: string;
  variables?: Record<string, boolean | number>;
}

interface TransformResponse {
  output: string;
  report: LoggerReport | null;
  success: boolean;
  error?: string;
}

interface VariablesResponse {
  success: boolean;
  variables: string[];
  contextVariables: string[];
  taskVariables: string[];
  error?: string;
}

const transformModel = async (
  request: TransformRequest,
): Promise<TransformResponse> => {
  const response = await fetch('/api/transform', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Transformation failed');
  }

  return data;
};

const fetchVariables = async (
  modelJson: string,
): Promise<VariablesResponse> => {
  const response = await fetch('/api/variables', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ modelJson }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to extract variables');
  }

  return data;
};

export default function TransformWorkflow() {
  const [modelContent, setModelContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [engine, setEngine] = useState<'prism' | 'sleec'>('prism');
  const [clean, setClean] = useState<boolean>(false);
  const [variables, setVariables] = useState<Record<string, boolean | number>>(
    {},
  );

  // Mutation for fetching variables from model
  const variablesMutation = useMutation({
    mutationFn: fetchVariables,
  });

  // Mutation for transforming model
  const transformMutation = useMutation({
    mutationFn: transformModel,
  });

  // Fetch variables when model content changes
  useEffect(() => {
    if (modelContent) {
      variablesMutation.mutate(modelContent);
    } else {
      variablesMutation.reset();
      setVariables({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelContent]);

  const handleFileUpload = (content: string, name: string) => {
    setModelContent(content);
    setFileName(name);
    transformMutation.reset();
  };

  const handleVariablesChange = (
    newVariables: Record<string, boolean | number>,
  ) => {
    setVariables(newVariables);
  };

  const handleTransform = () => {
    if (!modelContent) {
      return;
    }

    transformMutation.mutate({
      modelJson: modelContent,
      engine,
      clean,
      fileName: fileName.replace(/\.(txt|json)$/, ''),
      ...(engine === 'prism' &&
        Object.keys(variables).length > 0 && { variables }),
    });
  };

  const output = transformMutation.data?.output || '';
  const report = transformMutation.data?.report || null;

  return (
    <div className='min-h-screen p-8 bg-slate-50'>
      <div className='max-w-full mx-auto px-4'>
        <h1 className='text-3xl font-bold text-gray-900 mb-2'>
          Goal Controller
        </h1>
        <p className='text-gray-600 mb-8'>
          Transform goal models to PRISM or SLEEC specifications
        </p>

        {/* Configuration Section */}
        <div className='grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8'>
          <div className='bg-white rounded-lg shadow-md p-6'>
            <h2 className='text-xl font-semibold mb-4'>1. Upload Model</h2>
            <FileUploader onFileUpload={handleFileUpload} />
          </div>

          {modelContent && (
            <div className='bg-white rounded-lg shadow-md p-6 flex-grow'>
              <h2 className='text-lg font-semibold mb-3 text-gray-700'>
                Input Model
              </h2>
              <div className='h-full max-h-[340px] overflow-auto'>
                <ModelViewer content={modelContent} fileName={fileName} />
              </div>
            </div>
          )}

          <div className='bg-white rounded-lg shadow-md p-6'>
            <h2 className='text-xl font-semibold mb-4'>2. Configure</h2>
            <EngineSelector
              engine={engine}
              onEngineChange={setEngine}
              clean={clean}
              onCleanChange={setClean}
            />
          </div>

          {engine === 'prism' && modelContent && (
            <div className='bg-white rounded-lg shadow-md p-6'>
              <h2 className='text-xl font-semibold mb-4'>3. Variables</h2>
              {variablesMutation.isPending ? (
                <div className='flex items-center justify-center py-8'>
                  <Loader2 className='h-6 w-6 animate-spin text-blue-600' />
                  <span className='ml-2 text-gray-600'>
                    Loading variables...
                  </span>
                </div>
              ) : variablesMutation.isError ? (
                <div className='bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg'>
                  <p className='text-sm'>{variablesMutation.error?.message}</p>
                </div>
              ) : variablesMutation.data ? (
                <VariablesEditor
                  variableKeys={variablesMutation.data.variables}
                  contextVariables={variablesMutation.data.contextVariables}
                  onChange={handleVariablesChange}
                />
              ) : null}
            </div>
          )}
        </div>

        {/* Transform Button */}
        <div className='mb-8'>
          <button
            onClick={handleTransform}
            disabled={!modelContent || transformMutation.isPending}
            className='w-full max-w-md mx-auto block bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2'
          >
            {transformMutation.isPending ? (
              <>
                <Loader2 className='h-5 w-5 animate-spin' />
                Transforming...
              </>
            ) : (
              'Transform'
            )}
          </button>

          {transformMutation.isError && (
            <div className='max-w-md mx-auto mt-4 bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg'>
              <p className='font-medium'>Error:</p>
              <p className='text-sm'>{transformMutation.error?.message}</p>
            </div>
          )}
        </div>

        {/* Output Section - Full Width & Prominent */}
        {output && (
          <div className='mb-8'>
            <div className='bg-white rounded-xl shadow-lg border-2 border-blue-100 p-6'>
              <h2 className='text-xl font-bold mb-4 text-gray-900 flex items-center gap-2'>
                <span className='inline-block w-3 h-3 bg-green-500 rounded-full animate-pulse'></span>
                Generated Output
              </h2>
              <div className='h-[500px]'>
                <OutputViewer
                  output={output}
                  engine={engine}
                  fileName={fileName}
                />
              </div>
            </div>
          </div>
        )}

        {/* Report Section - Full Width */}
        {report && (
          <div className='w-full'>
            <ReportViewer report={report} />
          </div>
        )}
      </div>
    </div>
  );
}
