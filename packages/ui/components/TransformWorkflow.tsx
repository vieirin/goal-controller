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
  modelHash: string;
  variables: string[];
  contextVariables: string[];
  taskVariables: string[];
  storedVariables: Record<string, boolean | number> | null;
  error?: string;
}

interface SaveVariablesRequest {
  modelHash: string;
  variables: Record<string, boolean | number>;
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

const fetchVariables = async (modelJson: string): Promise<VariablesResponse> => {
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

const saveVariables = async ({ modelHash, variables }: SaveVariablesRequest): Promise<void> => {
  const response = await fetch('/api/variables', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ modelHash, variables }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to save variables');
  }
};

export default function TransformWorkflow() {
  const [modelContent, setModelContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [engine, setEngine] = useState<'prism' | 'sleec'>('prism');
  const [clean, setClean] = useState<boolean>(false);
  const [variables, setVariables] = useState<Record<string, boolean | number>>({});

  // Mutation for fetching variables from model
  const variablesMutation = useMutation({
    mutationFn: fetchVariables,
  });

  // Mutation for saving variables to database
  const saveVariablesMutation = useMutation({
    mutationFn: saveVariables,
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

  const handleVariablesChange = (newVariables: Record<string, boolean | number>) => {
    setVariables(newVariables);
    const modelHash = variablesMutation.data?.modelHash;
    if (modelHash && Object.keys(newVariables).length > 0) {
      saveVariablesMutation.mutate({ modelHash, variables: newVariables });
    }
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
      ...(engine === 'prism' && Object.keys(variables).length > 0 && { variables }),
    });
  };

  const output = transformMutation.data?.output || '';
  const report = transformMutation.data?.report || null;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Goal Controller
        </h1>
        <p className="text-gray-600 mb-8">
          Transform goal models to PRISM or SLEEC specifications
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">1. Upload Model</h2>
              <FileUploader onFileUpload={handleFileUpload} />
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">2. Configure</h2>
              <EngineSelector
                engine={engine}
                onEngineChange={setEngine}
                clean={clean}
                onCleanChange={setClean}
              />
            </div>

            {engine === 'prism' && modelContent && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">3. Variables</h2>
                {variablesMutation.isPending ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-600">Loading variables...</span>
                  </div>
                ) : variablesMutation.isError ? (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
                    <p className="text-sm">{variablesMutation.error?.message}</p>
                  </div>
                ) : variablesMutation.data ? (
                  <VariablesEditor
                    variableKeys={variablesMutation.data.variables}
                    contextVariables={variablesMutation.data.contextVariables}
                    onChange={handleVariablesChange}
                    initialValues={variablesMutation.data.storedVariables ?? undefined}
                  />
                ) : null}
              </div>
            )}

            <button
              onClick={handleTransform}
              disabled={!modelContent || transformMutation.isPending}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {transformMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Transforming...
                </>
              ) : (
                'Transform'
              )}
            </button>

            {transformMutation.isError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
                <p className="font-medium">Error:</p>
                <p className="text-sm">{transformMutation.error?.message}</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {modelContent && (
              <div className="bg-white rounded-lg shadow-md p-6 h-96">
                <h2 className="text-xl font-semibold mb-4">Input Model</h2>
                <div className="h-72">
                  <ModelViewer content={modelContent} fileName={fileName} />
                </div>
              </div>
            )}

            {output && (
              <>
                <div className="bg-white rounded-lg shadow-md p-6 h-96">
                  <h2 className="text-xl font-semibold mb-4">Output</h2>
                  <div className="h-72">
                    <OutputViewer
                      output={output}
                      engine={engine}
                      fileName={fileName}
                    />
                  </div>
                </div>
                {report && (
                  <div>
                    <ReportViewer report={report} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
