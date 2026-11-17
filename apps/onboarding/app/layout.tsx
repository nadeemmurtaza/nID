import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { ConsentBanner } from '@newax/design-tokens/ConsentBanner';

export const metadata: Metadata = {
  title: 'nID — Sign up',
  description: 'Create your nID account and manage your work and personal profiles.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ConsentBanner privacyHref={'http://localhost:3300/privacy'} />
      </body>
    </html>
  );
}
