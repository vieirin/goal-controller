'use client';

interface EngineSelectorProps {
  engine: 'prism' | 'sleec';
  onEngineChange: (engine: 'prism' | 'sleec') => void;
  clean: boolean;
  onCleanChange: (clean: boolean) => void;
  generateDecisionVars: boolean;
  onGenerateDecisionVarsChange: (generateDecisionVars: boolean) => void;
  achievabilitySpace: number;
  onAchievabilitySpaceChange: (achievabilitySpace: number) => void;
}

export default function EngineSelector({
  engine,
  onEngineChange,
  clean,
  onCleanChange,
  generateDecisionVars,
  onGenerateDecisionVarsChange,
  achievabilitySpace,
  onAchievabilitySpaceChange,
}: EngineSelectorProps) {
  return (
    <div className='space-y-4'>
      <div>
        <label className='block text-sm font-medium text-gray-700 mb-2'>
          Target Engine
        </label>
        <div className='flex gap-4'>
          <label className='flex items-center'>
            <input
              type='radio'
              value='prism'
              checked={engine === 'prism'}
              onChange={(e) =>
                onEngineChange(e.target.value as 'prism' | 'sleec')
              }
              className='mr-2'
            />
            <span>PRISM</span>
          </label>
          <label className='flex items-center'>
            <input
              type='radio'
              value='sleec'
              checked={engine === 'sleec'}
              onChange={(e) =>
                onEngineChange(e.target.value as 'prism' | 'sleec')
              }
              className='mr-2'
            />
            <span>SLEEC</span>
          </label>
        </div>
      </div>

      {engine === 'prism' && (
        <div className='space-y-3'>
          <label className='flex items-center'>
            <input
              type='checkbox'
              checked={clean}
              onChange={(e) => onCleanChange(e.target.checked)}
              className='mr-2'
            />
            <span className='text-sm text-gray-700'>
              Clean mode (no comments)
            </span>
          </label>
          <label className='flex items-center'>
            <input
              type='checkbox'
              checked={generateDecisionVars}
              onChange={(e) => onGenerateDecisionVarsChange(e.target.checked)}
              className='mr-2'
            />
            <span className='text-sm text-gray-700'>
              Generate decision variables
            </span>
          </label>
          {generateDecisionVars && (
            <div className='flex items-center gap-2'>
              <label className='text-sm text-gray-700'>
                Achievability space:
              </label>
              <input
                type='number'
                min='1'
                max='100'
                value={achievabilitySpace}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!isNaN(value) && value > 0) {
                    onAchievabilitySpaceChange(value);
                  }
                }}
                className='w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
