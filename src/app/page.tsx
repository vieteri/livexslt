import ErrorBoundary from '@/components/ErrorBoundary';
import XSLTEditor from '@/components/XSLTEditor';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-900">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-white mb-8 text-center">
          Viet&apos;s XML Transform Tool
        </h1>
        <ErrorBoundary>
          <XSLTEditor />
        </ErrorBoundary>
      </div>
    </main>
  );
}