import type { Metadata } from 'next';
import './globals.css';
import QueryProvider from './QueryProvider';

export const metadata: Metadata = {
  title: 'Goal Transformer - Model Transformation',
  description: 'Transform goal models to Edge, EdgeV2, or SLEEC specifications',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
