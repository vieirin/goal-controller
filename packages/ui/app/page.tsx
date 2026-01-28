import TransformWorkflow from '@/components/TransformWorkflow';
import { Suspense } from 'react';

export default function Home() {
  return (
    <Suspense fallback={<div className='min-h-screen p-8 bg-slate-50' />}>
      <TransformWorkflow />
    </Suspense>
  );
}
