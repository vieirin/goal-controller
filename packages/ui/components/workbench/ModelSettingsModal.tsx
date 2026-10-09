'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { TransformEngine } from '@/lib/types';
import { DIALECT_LABEL, type DialectMode } from '@/lib/workbench/dialects';
import type { ModelSettings } from '@/lib/workbench/types';
import { EngineOptionFields } from './TopBar';
import { ConformityStatus, useEngineConformity } from './engineConformity';
import { useWorkbench, type ConversionTarget } from './WorkbenchContext';
import { Button, IconButton, Switch, cx } from './ui';

const ENGINES: Array<{
  id: TransformEngine;
  label: string;
  output: string;
  help: string;
}> = [
  {
    id: 'edgev2',
    label: 'EdgeV2',
    output: 'PRISM',
    help: 'EDGE reference encoding, with cost and utility rewards',
  },
  { id: 'edge', label: 'Edge', output: 'PRISM', help: 'Legacy Edge encoding' },
  {
    id: 'sleec',
    label: 'SLEEC',
    output: 'SLEEC',
    help: 'SLEEC rules from the goal conditions',
  },
];

const PISTAR = {
  label: 'piStar',
  output: 'iStar 2.0',
  help: 'Model freely with every iStar element; nothing is generated',
};

/** The modelling dialects: chosen like an engine, nothing generated. */
const DIALECTS: Array<{ id: DialectMode; output: string; help: string }> = [
  {
    id: 'pistarext',
    output: 'iStar4RationalAgents',
    help: "piStar-ext's dialect: Planning and Plan, stereotypes and tagged values; nothing is generated",
  },
];

const TARGET_IDS: readonly ConversionTarget[] = [
  'edgev2',
  'edge',
  'sleec',
  ...DIALECTS.map((d) => d.id),
];

/**
 * Engine, options and file name of the open model. Shown when a model is
 * uploaded or created ('setup'), and on request from the options menu.
 */
export default function ModelSettingsModal() {
  const wb = useWorkbench();
  const setup = wb.settingsDialog === 'setup';
  // how well the model suits each engine (as in the Convert dialog)
  const conformity = useEngineConformity(wb.text, TARGET_IDS, !wb.text.trim());
  const [draft, setDraft] = useState<ModelSettings>(wb.settings);
  const [fileName, setFileName] = useState(wb.fileName || 'untitled.txt');
  const nameInput = useRef<HTMLInputElement>(null);

  // not on phones: the on-screen keyboard would cover the dialog
  useEffect(() => {
    if (!window.matchMedia('(min-width: 640px)').matches) return;
    nameInput.current?.focus();
    nameInput.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') wb.closeSettings();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wb]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const name = fileName.trim();
    if (name && name !== wb.fileName) wb.renameFile(name);
    // options and live here; the engine (or piStar mode) through a checked conversion
    wb.applySettings({
      ...draft,
      engine: wb.settings.engine,
      pistar: wb.settings.pistar,
      dialect: wb.settings.dialect,
    });
    wb.closeSettings();
    const target = draft.pistar ? (draft.dialect ?? 'pistar') : draft.engine;
    const plan = target === 'pistar' ? null : conformity.plans[target];
    if (setup && target !== 'pistar' && plan && !('error' in plan)) {
      // opening a model: its engine is chosen here, with the conformity shown on the cards,
      // so the conversion applies directly (no Convert dialog in the load flow)
      wb.applyConversion(target, plan.text);
      return;
    }
    wb.requestMode(target);
  };

  const nodes = wb.tree ? [...wb.tree.nodes.values()] : [];
  const goals = nodes.filter((n) => n.kind === 'goal').length;
  const tasks = nodes.filter((n) => n.kind === 'task').length;

  return (
    <div className='fixed inset-0 z-50 flex justify-center bg-white sm:items-center sm:bg-ink/30 sm:p-6'>
      <form
        role='dialog'
        aria-modal='true'
        aria-labelledby='model-settings-title'
        onSubmit={submit}
        className='flex h-[100dvh] w-full flex-col bg-white sm:h-auto sm:max-h-[92dvh] sm:max-w-lg sm:rounded-xl sm:shadow-2xl'
      >
        <header className='flex items-start gap-3 border-b border-line px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:py-4'>
          <div className='min-w-0 flex-1'>
            <h2
              id='model-settings-title'
              className='text-[15px] font-semibold text-ink'
            >
              {setup ? 'Set up the model' : 'Model settings'}
            </h2>
            <p className='mt-0.5 text-[13px] text-ink-muted'>
              {setup
                ? 'Choose how it is generated. These settings are kept with the model in Recent.'
                : 'Kept with the model in Recent.'}
              {nodes.length > 0 && (
                <span className='block text-2xs'>
                  {goals} goals · {tasks} tasks
                </span>
              )}
            </p>
          </div>
          <IconButton
            icon={X}
            label={
              setup
                ? 'Skip — keep the current settings'
                : 'Close without saving'
            }
            onClick={wb.closeSettings}
          />
        </header>

        <div className='min-h-0 flex-1 space-y-5 overflow-auto px-4 py-4 sm:px-5'>
          <label className='block space-y-1'>
            <span className='text-2xs font-semibold uppercase tracking-wider text-ink-muted'>
              File name
            </span>
            <input
              ref={nameInput}
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              spellCheck={false}
              className='w-full rounded-md border border-line-strong px-2.5 py-1.5 font-mono text-[13px] text-ink focus:border-trace focus:outline-none focus:ring-2 focus:ring-trace/20'
            />
          </label>

          <fieldset className='space-y-1.5'>
            <legend className='mb-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-muted'>
              Target engine
            </legend>
            {wb.engineLocked ? (
              <p className='text-[13px] text-ink-soft'>
                Fixed to{' '}
                <span className='font-medium'>
                  {ENGINES.find((e) => e.id === wb.engine)?.label}
                </span>{' '}
                by this page&apos;s link.
              </p>
            ) : (
              <div className='grid gap-1.5 sm:grid-cols-2'>
                {ENGINES.map((engine) => {
                  const active = !draft.pistar && draft.engine === engine.id;
                  return (
                    <label
                      key={engine.id}
                      className={cx(
                        'flex cursor-pointer flex-col rounded-lg border px-3 py-2 text-left transition-colors',
                        active
                          ? 'border-ink bg-panel ring-1 ring-ink'
                          : 'border-line hover:border-line-strong',
                      )}
                    >
                      <input
                        type='radio'
                        name='engine'
                        value={engine.id}
                        checked={active}
                        onChange={() =>
                          setDraft((d) => ({
                            ...d,
                            engine: engine.id,
                            pistar: false,
                          }))
                        }
                        className='sr-only'
                      />
                      <span className='flex items-baseline justify-between gap-2'>
                        <span className='text-[13px] font-semibold text-ink'>
                          {engine.label}
                        </span>
                        <span className='font-mono text-2xs text-ink-muted'>
                          {engine.output}
                        </span>
                      </span>
                      <span className='mt-0.5 text-2xs leading-snug text-ink-muted'>
                        {engine.help}
                      </span>
                      {wb.text.trim() && (
                        <ConformityStatus
                          status={conformity.statusOf(engine.id)}
                          warnings={conformity.warningsOf(engine.id)}
                        />
                      )}
                    </label>
                  );
                })}
                {DIALECTS.map((dialect) => {
                  const active = !!draft.pistar && draft.dialect === dialect.id;
                  return (
                    <label
                      key={dialect.id}
                      className={cx(
                        'flex cursor-pointer flex-col rounded-lg border px-3 py-2 text-left transition-colors',
                        active
                          ? 'border-ink bg-panel ring-1 ring-ink'
                          : 'border-line hover:border-line-strong',
                      )}
                    >
                      <input
                        type='radio'
                        name='engine'
                        value={dialect.id}
                        checked={active}
                        onChange={() =>
                          setDraft((d) => ({
                            ...d,
                            pistar: true,
                            dialect: dialect.id,
                          }))
                        }
                        className='sr-only'
                      />
                      <span className='flex items-baseline justify-between gap-2'>
                        <span className='text-[13px] font-semibold text-ink'>
                          {DIALECT_LABEL[dialect.id]}
                        </span>
                        <span className='font-mono text-2xs text-ink-muted'>
                          {dialect.output}
                        </span>
                      </span>
                      <span className='mt-0.5 text-2xs leading-snug text-ink-muted'>
                        {dialect.help}
                      </span>
                      {wb.text.trim() && (
                        <ConformityStatus
                          status={conformity.statusOf(dialect.id)}
                          warnings={conformity.warningsOf(dialect.id)}
                        />
                      )}
                    </label>
                  );
                })}
                <label
                  className={cx(
                    'flex cursor-pointer flex-col rounded-lg border px-3 py-2 text-left transition-colors',
                    draft.pistar && !draft.dialect
                      ? 'border-ink bg-panel ring-1 ring-ink'
                      : 'border-line hover:border-line-strong',
                  )}
                >
                  <input
                    type='radio'
                    name='engine'
                    value='pistar'
                    checked={!!draft.pistar && !draft.dialect}
                    onChange={() =>
                      setDraft((d) => ({
                        ...d,
                        pistar: true,
                        dialect: undefined,
                      }))
                    }
                    className='sr-only'
                  />
                  <span className='flex items-baseline justify-between gap-2'>
                    <span className='text-[13px] font-semibold text-ink'>
                      {PISTAR.label}
                    </span>
                    <span className='font-mono text-2xs text-ink-muted'>
                      {PISTAR.output}
                    </span>
                  </span>
                  <span className='mt-0.5 text-2xs leading-snug text-ink-muted'>
                    {PISTAR.help}
                  </span>
                </label>
              </div>
            )}
          </fieldset>

          {!draft.pistar && (
            <>
              <fieldset>
                <legend className='mb-2 text-2xs font-semibold uppercase tracking-wider text-ink-muted'>
                  Options
                </legend>
                <EngineOptionFields
                  engine={wb.engineLocked ? wb.engine : draft.engine}
                  options={draft.options}
                  onChange={(patch) =>
                    setDraft((d) => ({
                      ...d,
                      options: { ...d.options, ...patch },
                    }))
                  }
                />
              </fieldset>

              <div className='border-t border-line pt-4'>
                <Switch
                  checked={draft.live}
                  onChange={(live) => setDraft((d) => ({ ...d, live }))}
                  label='Live'
                  description='Regenerate after each change'
                />
                <p className='mt-1 pl-9 text-2xs text-ink-muted'>
                  Regenerate the output after each change to the model.
                </p>
              </div>
            </>
          )}
        </div>

        <footer className='flex items-center justify-end gap-2 border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5'>
          <Button variant='outline' onClick={wb.closeSettings}>
            {setup ? 'Skip' : 'Cancel'}
          </Button>
          <Button variant='primary' type='submit'>
            {setup ? 'Start working' : 'Save settings'}
          </Button>
        </footer>
      </form>
    </div>
  );
}
