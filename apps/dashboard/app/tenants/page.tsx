'use client';

import { DataTable } from '@newax/design-tokens/DataTable';
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
  const [reload, setReload] = useState(0);
  const [platformSecret] = useState(() => getPlatformAdminSecret());

  useEffect(() => {
    if (!platformSecret) {
      setError('Platform admin secret not set. Please login as platform admin first.');
      setLoading(false);
      return;
    }

    setError('');
    setLoading(true);
    listTenants(platformSecret)
      .then((data) => {
        setTenants(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load tenants');
        setLoading(false);
      });
  }, [platformSecret, reload]);

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
            Create tenant
          </Link>
        </div>

        <DataTable<TenantListItem>
          caption="All tenants"
          rows={error ? null : loading ? null : tenants}
          error={error}
          onRetry={() => setReload((n) => n + 1)}
          rowId={(t) => t.id}
          filterLabel="Filter tenants"
          empty={{ title: 'No tenants yet', hint: 'Create your first tenant to get started.', action: <Link href="/" className="primary-btn">Create tenant</Link> }}
          columns={[
            { key: 'name', header: 'Name', value: (t) => t.name, render: (t) => t.name },
            { key: 'slug', header: 'Slug', value: (t) => t.slug, render: (t) => t.slug },
            { key: 'region', header: 'Region', value: (t) => t.dataResidencyRegion, render: (t) => t.dataResidencyRegion },
            { key: 'keys', header: 'API keys', numeric: true, value: (t) => t._count.apiKeys, render: (t) => t._count.apiKeys },
            { key: 'staff', header: 'Staff', numeric: true, value: (t) => t._count.staff, render: (t) => t._count.staff },
            { key: 'orgs', header: 'Organizations', numeric: true, value: (t) => t._count.organizations, render: (t) => t._count.organizations },
            { key: 'cases', header: 'Cases', numeric: true, value: (t) => t._count.cases, render: (t) => t._count.cases },
            { key: 'hook', header: 'Webhook', value: (t) => (t.webhookUrl ? 'Configured' : 'Not configured'), render: (t) => (t.webhookUrl ? 'Configured' : 'Not configured') },
            { key: 'created', header: 'Created', value: (t) => t.createdAt, render: (t) => new Date(t.createdAt).toLocaleDateString() },
          ]}
        />
      </main>
    </>
  );
}
