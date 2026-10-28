import type { flatTable } from '@/lib/workbench/agent/chatTranscript';

type Table = NonNullable<ReturnType<typeof flatTable>>;

/** a tool's result that is a list of flat objects, one row each */
export function ResultTable({ columns, rows }: Table) {
  return (
    <div className='overflow-x-auto'>
      <table className='w-full border-collapse font-mono text-2xs'>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                scope='col'
                className='border-b border-line-strong px-2 py-1 text-left font-medium uppercase tracking-wide text-ink-muted'
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((column) => {
                const value = row[column];
                return (
                  <td
                    key={column}
                    className={
                      typeof value === 'number'
                        ? 'border-b border-line px-2 py-1 text-right text-ink'
                        : 'border-b border-line px-2 py-1 text-ink'
                    }
                  >
                    {value === undefined ? '' : String(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
