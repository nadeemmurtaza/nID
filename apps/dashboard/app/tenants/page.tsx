'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  listTenants,
  getPlatformAdminSecret,
  ApiError,
  type TenantListItem,
} from '../../lib/api-client';
import { Header } from '../components/header';
import { useDashboardSession } from '../../lib/use-dashboard-session';

export default function TenantsPage() {
  const { logout } = useDashboardSession();
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [platformSecret] = useState(() => getPlatformAdminSecret());

  useEffect(() => {
    if (!platformSecret) {
      setError('Platform admin secret not set. Please login as platform admin first.');
      setLoading(false);
      return;
    }

    listTenants(platformSecret)
      .then((data) => {
        setTenants(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load tenants');
        setLoading(false);
      });
  }, [platformSecret]);

  return (
    <>
      <Header
        tenant={{ name: 'Platform Admin' }}
        onLogout={logout}
      />
      <main className="shell">
        <div className="tab-header">
          <h1>All Tenants</h1>
          <Link href="/" className="primary-btn">
            + Create Tenant
          </Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {loading && <p>Loading tenants…</p>}

        {!loading && !error && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Region</th>
                <th>API Keys</th>
                <th>Staff</th>
                <th>Organizations</th>
                <th>Cases</th>
                <th>Webhook</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td>{tenant.name}</td>
                  <td>{tenant.slug}</td>
                  <td>{tenant.dataResidencyRegion}</td>
                  <td>{tenant._count.apiKeys}</td>
                  <td>{tenant._count.staff}</td>
                  <td>{tenant._count.organizations}</td>
                  <td>{tenant._count.cases}</td>
                  <td>
                    {tenant.webhookUrl ? (
                      <span className="status-badge status-active">Configured</span>
                    ) : (
                      <span className="status-badge status-inactive">Not configured</span>
                    )}
                  </td>
                  <td>{new Date(tenant.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && !error && tenants.length === 0 && (
          <div className="empty-state">
            <p>No tenants found. Create your first tenant to get started.</p>
            <Link href="/" className="primary-btn">
              + Create Tenant
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
