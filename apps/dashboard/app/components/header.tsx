'use client';

import type { Tenant } from '../../lib/api-client';
import { Logomark } from './logomark';

export function Header({ tenant, onLogout }: { tenant: Tenant; onLogout: () => void }) {
  return (
    <header className="app-header">
      <div className="header-identity">
        <Logomark size={28} />
        <div>
          <div className="brand">nID Dashboard</div>
          <div className="tenant-name">
            {tenant.name}
            {tenant.signedInAs === 'API_KEY' && (
              <span className="signed-in-as" title="Signed in with a raw tenant API key, not a staff account">
                {' '}
                (API key)
              </span>
            )}
          </div>
        </div>
      </div>
      <button className="logout-btn" onClick={onLogout} type="button">
        Sign out
      </button>
    </header>
  );
}
