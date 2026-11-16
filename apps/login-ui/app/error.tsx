'use client';

import { ErrorPage } from '@newax/design-tokens/StatePages';

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPage {...props} home="/" />;
}
