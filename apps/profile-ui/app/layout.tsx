import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { ConsentBanner } from '@newax/design-tokens/ConsentBanner';

export const metadata: Metadata = {
  title: 'nID Profiles',
  description: 'Public profiles, verified badges, booking, and contact, powered by nID.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ConsentBanner privacyHref={process.env.NEXT_PUBLIC_PRIVACY_URL} />
      </body>
    </html>
  );
}
