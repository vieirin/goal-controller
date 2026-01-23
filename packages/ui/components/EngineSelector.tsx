'use client';

interface EngineSelectorProps {
  engine: 'prism' | 'sleec';
  onEngineChange: (engine: 'prism' | 'sleec') => void;
  clean: boolean;
  onCleanChange: (clean: boolean) => void;
}

export default function EngineSelector({
  engine,
  onEngineChange,
  clean,
  onCleanChange,
}: EngineSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Target Engine
        </label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="prism"
              checked={engine === 'prism'}
              onChange={(e) => onEngineChange(e.target.value as 'prism' | 'sleec')}
              className="mr-2"
            />
            <span>PRISM</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="sleec"
              checked={engine === 'sleec'}
              onChange={(e) => onEngineChange(e.target.value as 'prism' | 'sleec')}
              className="mr-2"
            />
            <span>SLEEC</span>
          </label>
        </div>
      </div>

      {engine === 'prism' && (
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={clean}
              onChange={(e) => onCleanChange(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Clean mode (no comments)</span>
          </label>
        </div>
      )}
    </div>
  );
}
