import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { FormGuard } from '@newax/design-tokens/FormGuard';
import { ConsentBanner } from '@newax/design-tokens/ConsentBanner';

export const metadata: Metadata = {
  title: 'NEWAX ID: One identity, every app',
  description:
    'NEWAX ID is the identity provider for the NEWAX ecosystem. One verified identity for people and organizations, reused across every connected app including Communicator.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <FormGuard />
        <ConsentBanner privacyHref={'/privacy'} />
      </body>
    </html>
  );
}
