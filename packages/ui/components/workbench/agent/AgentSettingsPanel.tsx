/**
 * The drawer's settings (goal-controller#485): the provider, one of its
 * models (asked of the provider with the key, `listModels`; its fallback
 * list until it answers or without a key) and the API key. The endpoint is
 * the provider's own.
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  modelIn,
  type AgentSettings,
} from '@/lib/workbench/agent/agentSettings';
import {
  PROVIDERS,
  type ChatProviderId,
  type ModelInfo,
} from '@/lib/workbench/agent/providers';

const KEY_SETTLE_MS = 400;

const FIELD = 'rounded-md border border-line-strong bg-white px-2 py-1';

export function AgentSettingsPanel({
  settings,
  onChange,
}: {
  settings: AgentSettings;
  onChange: (next: AgentSettings) => void;
}) {
  const provider = PROVIDERS[settings.providerId];
  const [models, setModels] = useState<readonly ModelInfo[]>(
    provider.fallbackModels,
  );
  const [loading, setLoading] = useState(false);

  // asked again once the key has stopped changing
  useEffect(() => {
    let current = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void provider.listModels(settings.apiKey).then((listed) => {
        if (!current) return;
        setModels(listed);
        setLoading(false);
      });
    }, KEY_SETTLE_MS);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [provider, settings.apiKey]);

  // a remembered model the provider no longer lists falls back to its default
  const model = modelIn(models, settings.model, provider.defaultModel);
  useEffect(() => {
    if (!loading && model !== settings.model) onChange({ ...settings, model });
  }, [loading, model, settings, onChange]);

  const changeProvider = (providerId: ChatProviderId) => {
    const next = PROVIDERS[providerId];
    setModels(next.fallbackModels);
    onChange({ ...settings, providerId, model: next.defaultModel });
  };

  return (
    <div className='flex flex-col gap-2 border-b border-line bg-panel p-3 text-[13px]'>
      <label className='flex flex-col gap-1'>
        <span className='text-ink-muted'>Provider</span>
        <select
          className={FIELD}
          value={settings.providerId}
          onChange={(e) => {
            const providerId = Object.values(PROVIDERS).find(
              ({ id }) => id === e.target.value,
            )?.id;
            if (providerId) changeProvider(providerId);
          }}
        >
          {Object.values(PROVIDERS).map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className='flex flex-col gap-1'>
        <span className='flex items-center gap-1.5 text-ink-muted'>
          Model
          {loading && (
            <Loader2
              className='h-3 w-3 animate-spin'
              aria-label='Loading models'
            />
          )}
        </span>
        <select
          className={FIELD}
          value={model}
          disabled={loading}
          onChange={(e) => onChange({ ...settings, model: e.target.value })}
        >
          {models.map(({ id, label }) => (
            <option key={id} value={id}>
              {label ?? id}
            </option>
          ))}
        </select>
      </label>
      <label className='flex flex-col gap-1'>
        <span className='text-ink-muted'>API key</span>
        <input
          type='password'
          autoComplete='off'
          className={FIELD}
          value={settings.apiKey}
          onChange={(e) => onChange({ ...settings, apiKey: e.target.value })}
        />
      </label>
    </div>
  );
}
