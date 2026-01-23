'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface LoggerReport {
  log: string;
  summary: {
    elapsedTime: string;
    elapsedTimeMs: number;
    totalGoals: number;
    totalTasks: number;
    totalResources: number;
    totalNodes: number;
    totalVariables: number;
    goalTypeDegradation: number;
    goalTypeChoice: number;
    goalTypeAlternative: number;
    goalTypeSequence: number;
    goalTypeInterleaved: number;
    goalModules: number;
    goalVariables: number;
    goalPursueLines: number;
    goalAchievedLines: number;
    goalSkippedLines: number;
    goalAchievabilityFormulas: number;
    goalMaintainFormulas: number;
    tasksVariables: number;
    tasksLabels: number;
    tasksTryLines: number;
    tasksFailedLines: number;
    tasksAchievedLines: number;
    tasksSkippedLines: number;
    tasksAchievabilityConstants: number;
    systemVariables: number;
    systemResources: number;
    systemContextVariables: number;
  };
}

interface ReportViewerProps {
  report: LoggerReport | null;
}

export default function ReportViewer({ report }: ReportViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [showFullLog, setShowFullLog] = useState(false);

  if (!report) {
    return null;
  }

  const { summary } = report;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Transformation Report</h2>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          {expanded ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Elapsed Time</div>
              <div className="text-2xl font-bold text-blue-700">
                {summary.elapsedTime}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Total Goals</div>
              <div className="text-2xl font-bold text-green-700">
                {summary.totalGoals}
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Total Tasks</div>
              <div className="text-2xl font-bold text-purple-700">
                {summary.totalTasks}
              </div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Total Nodes</div>
              <div className="text-2xl font-bold text-orange-700">
                {summary.totalNodes}
              </div>
            </div>
          </div>

          {/* Detailed Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Model Structure</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Total Resources:</span>
                  <span className="font-medium">{summary.totalResources}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Variables:</span>
                  <span className="font-medium">{summary.totalVariables}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Goal Types</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Degradation:</span>
                  <span className="font-medium">
                    {summary.goalTypeDegradation}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Choice:</span>
                  <span className="font-medium">{summary.goalTypeChoice}</span>
                </div>
                <div className="flex justify-between">
                  <span>Alternative:</span>
                  <span className="font-medium">
                    {summary.goalTypeAlternative}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Sequence:</span>
                  <span className="font-medium">
                    {summary.goalTypeSequence}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Interleaved:</span>
                  <span className="font-medium">
                    {summary.goalTypeInterleaved}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Full Log Toggle */}
          <div>
            <button
              onClick={() => setShowFullLog(!showFullLog)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {showFullLog ? 'Hide' : 'Show'} Full Log
            </button>
            {showFullLog && (
              <div className="mt-2 bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-96 font-mono text-xs">
                <pre className="whitespace-pre-wrap">{report.log}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {!expanded && (
        <div className="text-sm text-gray-600">
          Click to view detailed transformation report
        </div>
      )}
    </div>
  );
}

