'use client';

import dynamic from 'next/dynamic';

// the workbench reads browser storage on start, so it renders on the client only
const Workbench = dynamic(() => import('@/components/workbench/Workbench'), {
  ssr: false,
  loading: () => <div className='h-screen bg-panel' />,
});

export default function Home() {
  return <Workbench />;
}
