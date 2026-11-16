import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { ConsentBanner } from '@newax/design-tokens/ConsentBanner';

export const metadata: Metadata = {
  title: 'nID Dashboard',
  description: 'Tenant staff dashboard for nID verification cases.',
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
