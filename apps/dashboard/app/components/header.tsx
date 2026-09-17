'use client';

import type { Tenant } from '../../lib/api-client';

export function Header({ tenant, onLogout }: { tenant: Tenant; onLogout: () => void }) {
  return (
    <header className="app-header">
      <div>
        <div className="brand">nID Dashboard</div>
        <div className="tenant-name">{tenant.name}</div>
      </div>
      <button className="logout-btn" onClick={onLogout} type="button">
        Sign out
      </button>
    </header>
  );
}
