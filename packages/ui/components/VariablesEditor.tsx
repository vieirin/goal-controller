'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

interface VariablesEditorProps {
  variableKeys: string[];
  contextVariables: string[];
  onChange: (variables: Record<string, boolean | number>) => void;
  initialValues?: Record<string, boolean | number>;
}

const getDefaultValue = (key: string, contextVariables: string[]): boolean | number => {
  // Context variables are booleans, task achievability variables are numbers
  return contextVariables.includes(key) ? false : 0.8;
};

const formatJsonWithColors = (obj: Record<string, boolean | number>): React.ReactNode[] => {
  const entries = Object.entries(obj);
  const elements: React.ReactNode[] = [];
  
  elements.push(
    <span key="open" className="text-slate-400">{'{'}</span>
  );
  
  entries.forEach(([key, value], index) => {
    const isLast = index === entries.length - 1;
    const valueColor = typeof value === 'boolean' 
      ? 'text-amber-500' 
      : 'text-emerald-400';
    
    elements.push(
      <div key={key} className="ml-4">
        <span className="text-rose-400">&quot;{key}&quot;</span>
        <span className="text-slate-400">: </span>
        <span className={valueColor}>{String(value)}</span>
        {!isLast && <span className="text-slate-400">,</span>}
      </div>
    );
  });
  
  elements.push(
    <span key="close" className="text-slate-400">{'}'}</span>
  );
  
  return elements;
};

export default function VariablesEditor({
  variableKeys,
  contextVariables,
  onChange,
  initialValues,
}: VariablesEditorProps) {
  const [jsonText, setJsonText] = useState<string>('');
  const [parsedJson, setParsedJson] = useState<Record<string, boolean | number>>({});
  const [error, setError] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize with variable keys and default values
  useEffect(() => {
    const defaultValues: Record<string, boolean | number> = {};
    variableKeys.forEach((key) => {
      defaultValues[key] = initialValues?.[key] ?? getDefaultValue(key, contextVariables);
    });
    
    const formatted = JSON.stringify(defaultValues, null, 2);
    setJsonText(formatted);
    setParsedJson(defaultValues);
    onChange(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variableKeys, contextVariables, initialValues]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setJsonText(text);
    
    try {
      const parsed = JSON.parse(text);
      
      // Validate that all values are booleans or numbers between 0 and 1
      const validatedObj: Record<string, boolean | number> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'boolean') {
          validatedObj[key] = value;
        } else if (typeof value === 'number') {
          if (value < 0 || value > 1) {
            throw new Error(`Value for "${key}" must be between 0 and 1`);
          }
          validatedObj[key] = value;
        } else {
          throw new Error(`Value for "${key}" must be a boolean or number`);
        }
      }
      
      setError('');
      setParsedJson(validatedObj);
      onChange(validatedObj);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }, [onChange]);

  const handleFocus = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    // Re-format JSON on blur if valid
    if (!error) {
      try {
        const formatted = JSON.stringify(parsedJson, null, 2);
        setJsonText(formatted);
      } catch {
        // Keep current text if formatting fails
      }
    }
  };

  if (variableKeys.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 text-slate-400 text-sm font-mono">
        No variables found in this model
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Variables Configuration
        </label>
        <span className="text-xs text-gray-500">
          {contextVariables.length > 0 && (
            <span className="mr-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1"></span>
              boolean
            </span>
          )}
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1"></span>
            probability (0-1)
          </span>
        </span>
      </div>
      
      <div className="relative">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={jsonText}
            onChange={handleTextChange}
            onBlur={handleBlur}
            className={`w-full h-64 p-4 font-mono text-sm bg-slate-900 text-slate-100 rounded-lg border-2 resize-none focus:outline-none ${
              error ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
            }`}
            spellCheck={false}
          />
        ) : (
          <div
            onClick={() => {
              setIsEditing(true);
              setTimeout(() => textareaRef.current?.focus(), 0);
            }}
            className="w-full h-64 p-4 font-mono text-sm bg-slate-900 rounded-lg border-2 border-slate-700 cursor-text overflow-auto hover:border-slate-600 transition-colors"
          >
            <pre className="text-slate-100 leading-relaxed">
              {formatJsonWithColors(parsedJson)}
            </pre>
          </div>
        )}
        
        {/* Hidden textarea for editing mode transition */}
        {!isEditing && (
          <textarea
            ref={textareaRef}
            value={jsonText}
            onChange={handleTextChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="absolute inset-0 opacity-0 cursor-text"
            spellCheck={false}
          />
        )}
      </div>
      
      {error && (
        <p className="text-red-500 text-sm mt-1">{error}</p>
      )}
      
      <p className="text-xs text-gray-500">
        Click to edit. Context conditions use boolean values (true/false). 
        Task achievability uses probability values (0.0 - 1.0).
      </p>
    </div>
  );
}
