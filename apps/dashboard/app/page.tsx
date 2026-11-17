'use client';

import { Skeleton } from '@newax/design-tokens/Skeleton';
import { useConfirm } from '@newax/design-tokens/ConfirmDialog';
import { DataTable } from '@newax/design-tokens/DataTable';
import { Field, v } from '@newax/design-tokens/Field';
import { CommandPalette, type Command } from '@newax/design-tokens/CommandPalette';
import { useHotkeys } from '@newax/design-tokens/hooks';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  apiFetch,
  createTenant,
  updateTenant,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  listStaff,
  inviteStaff,
  removeStaff,
  getPlatformAdminSecret,
  setPlatformAdminSecret,
  createOrganization,
  listOrganizations,
  createBrand,
  listBrands,
  deactivateBrand,
  createAccessGrant,
  listAccessGrants,
  revokeAccessGrant,
  transferOwnership,
  addPartner,
  getMyPermissions,
  createDepartment,
  listDepartments,
  createRole,
  listRoles,
  getPermissionCatalog,
  sendEmailInvitation,
  sendUsernameInvitation,
  listInvitations,
  revokeInvitation,
  ApiError,
  type Tenant,
  type CreateTenantResponse,
  type TenantApiKey,
  type TenantStaffMember,
  type OrganizationRecord,
  type BrandRecord,
  type CreateBrandRequest,
  type AccessGrantRecord,
  type MyPermissionsResponse,
  type PermissionEntry,
  type DepartmentRecord,
  type RoleDefinitionRecord,
  type PermissionCatalogGroup,
  type InvitationRecord,
} from '../lib/api-client';
import { useDashboardSession } from '../lib/use-dashboard-session';
import { Header } from './components/header';
import { Logomark } from './components/logomark';

export default function DashboardHome() {
  const { state, login, logout, loginError, loggingIn } = useDashboardSession();

  if (state.kind === 'checking') {
    return (
      <div className="login-wrap">
        <p className="lead">Checking for a saved session…</p>
      </div>
    );
  }

  if (state.kind === 'signed-out') {
    return (
      <LoginScreen
        onLogin={login}
        // handlePlatformAdminLogin already persists the secret
        // (setPlatformAdminSecret(platformSecret.trim())) before calling
        // this -- it previously immediately wiped that same secret back
        // out with setPlatformAdminSecret(''), so the "Platform Admin"
        // login never actually worked. It's picked up by DashboardLayout
        // after a real staff sign-in (see getPlatformAdminSecret() there);
        // nothing else needs to happen here.
        onPlatformAdminLogin={() => {}}
        error={loginError}
        loading={loggingIn}
      />
    );
  }

  return (
    <>
      <Header tenant={state.tenant} onLogout={logout} />
      <main className="shell">
        <DashboardLayout credential={state.credential} />
      </main>
    </>
  );
}

type TabId = 'overview' | 'organizations' | 'brands' | 'api-keys' | 'staff' | 'access' | 'departments' | 'roles' | 'invitations' | 'settings';

// Grouped so ten flat items become three short lists (Hick's law). `key` is
// the second key of the "g then ..." shortcut.
const NAV: Array<{ heading: string; items: Array<{ id: TabId; label: string; key: string }> }> = [
  { heading: 'Workspace', items: [
    { id: 'overview', label: 'Overview', key: 'o' },
    { id: 'organizations', label: 'Organizations', key: 'z' },
    { id: 'brands', label: 'Brands', key: 'b' },
  ] },
  { heading: 'People', items: [
    { id: 'staff', label: 'Staff', key: 's' },
    { id: 'access', label: 'Access', key: 'a' },
    { id: 'departments', label: 'Departments', key: 'd' },
    { id: 'roles', label: 'Roles', key: 'r' },
    { id: 'invitations', label: 'Invitations', key: 'i' },
  ] },
  { heading: 'Developer', items: [
    { id: 'api-keys', label: 'API keys', key: 'k' },
    { id: 'settings', label: 'Settings', key: 'e' },
  ] },
];
const TAB_IDS = NAV.flatMap((g) => g.items.map((i) => i.id));

function tabFromHash(): TabId {
  const h = typeof window === 'undefined' ? '' : window.location.hash.replace(/^#\/?/, '');
  return (TAB_IDS as string[]).includes(h) ? (h as TabId) : 'overview';
}

function DashboardLayout({ credential }: { credential: string }) {
  // The tab lives in the URL hash, so Back and Forward move between tabs
  // and a tab can be bookmarked or shared.
  const [activeTab, setActiveTabState] = useState<TabId>('overview');
  const [platformSecret, setPlatformSecret] = useState<string | null>(null);
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [showCreateOrganization, setShowCreateOrganization] = useState(false);
  const [showCreateBrand, setShowCreateBrand] = useState(false);
  const [selectedOrgForBrands, setSelectedOrgForBrands] = useState<string | null>(null);

  useEffect(() => {
    setPlatformSecret(getPlatformAdminSecret());
    setActiveTabState(tabFromHash());
    const onHash = () => setActiveTabState(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setActiveTab = (id: TabId) => {
    setShowCreateOrganization(false);
    setShowCreateBrand(false);
    setShowCreateTenant(false);
    window.location.hash = id;
  };

  useHotkeys(NAV.flatMap((g) => g.items.map((i) => ({ keys: `g ${i.key}`, run: () => setActiveTab(i.id) }))));

  const commands: Command[] = [
    ...NAV.flatMap((g) => g.items.map((i) => ({ id: `go-${i.id}`, group: 'Go to', label: i.label, shortcut: `g ${i.key}`, run: () => setActiveTab(i.id) }))),
    { id: 'new-org', group: 'Actions', label: 'Create organization', run: () => { setActiveTab('organizations'); setShowCreateOrganization(true); } },
    { id: 'new-brand', group: 'Actions', label: 'Create brand', run: () => { setActiveTab('brands'); setShowCreateBrand(true); } },
    { id: 'new-key', group: 'Actions', label: 'Go to API keys to create a key', run: () => setActiveTab('api-keys') },
  ];

  return (
    <div className="dashboard-layout">
      <CommandPalette commands={commands} />
      <aside className="dashboard-sidebar">
        <nav className="sidebar-nav" aria-label="Dashboard sections">
          {NAV.map((group) => (
            <div key={group.heading} className="nav-group">
              <p className="nav-heading">{group.heading}</p>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                  aria-current={activeTab === item.id ? 'page' : undefined}
                  onClick={() => setActiveTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
          <p className="nav-hint">Press <kbd>/</kbd> for the command palette</p>
        </nav>

        {platformSecret && (
          <div className="sidebar-platform-admin">
            <h3>Platform admin</h3>
            <button
              className="create-tenant-btn"
              onClick={() => setShowCreateTenant(true)}
            >
              Create tenant
            </button>
            <Link href="/tenants" className="view-tenants-link">
              View all tenants
            </Link>
          </div>
        )}
      </aside>

      <div className="dashboard-content">
        {showCreateTenant ? (
          <CreateTenantForm
            secret={platformSecret!}
            onSuccess={() => setShowCreateTenant(false)}
            onCancel={() => setShowCreateTenant(false)}
          />
        ) : showCreateOrganization ? (
          <CreateOrganizationForm
            credential={credential}
            onSuccess={() => setShowCreateOrganization(false)}
            onCancel={() => setShowCreateOrganization(false)}
          />
        ) : showCreateBrand ? (
          <CreateBrandForm
            credential={credential}
            onSuccess={() => setShowCreateBrand(false)}
            onCancel={() => setShowCreateBrand(false)}
          />
        ) : activeTab === 'overview' ? (
          <OverviewTab credential={credential} />
        ) : activeTab === 'organizations' ? (
          <OrganizationsTab
            credential={credential}
            onCreateNew={() => setShowCreateOrganization(true)}
            onSelectOrg={(orgId) => {
              setSelectedOrgForBrands(orgId);
              setActiveTab('brands');
            }}
          />
        ) : activeTab === 'brands' ? (
          <BrandsTab
            credential={credential}
            onCreateNew={() => setShowCreateBrand(true)}
            preselectedOrgId={selectedOrgForBrands}
          />
        ) : activeTab === 'api-keys' ? (
          <ApiKeysTab credential={credential} />
        ) : activeTab === 'staff' ? (
          <StaffTab credential={credential} />
        ) : activeTab === 'access' ? (
          <AccessTab credential={credential} />
        ) : activeTab === 'departments' ? (
          <DepartmentsTab credential={credential} />
        ) : activeTab === 'roles' ? (
          <RolesTab credential={credential} />
        ) : activeTab === 'invitations' ? (
          <InvitationsTab credential={credential} />
        ) : (
          <SettingsTab credential={credential} />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ credential }: { credential: string }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Tenant>('/v1/tenants/me', credential).then((data) => {
      setTenant(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [credential]);

  if (loading) return <div aria-busy="true" aria-label="Loading"><Skeleton count={4} /></div>;
  if (!tenant) return <p>Failed to load tenant info.</p>;

  return (
    <div className="tab-content">
      <h1>Tenant Overview</h1>
      <div className="info-card">
        <div className="info-row">
          <span className="label">Name</span>
          <span className="value">{tenant.name}</span>
        </div>
        <div className="info-row">
          <span className="label">Slug</span>
          <span className="value">{tenant.slug}</span>
        </div>
        <div className="info-row">
          <span className="label">Region</span>
          <span className="value">{tenant.dataResidencyRegion}</span>
        </div>
        <div className="info-row">
          <span className="label">Webhook URL</span>
          <span className="value">{tenant.webhookUrl ?? 'Not configured'}</span>
        </div>
        <div className="info-row">
          <span className="label">Created</span>
          <span className="value">{new Date(tenant.createdAt).toLocaleDateString()}</span>
        </div>
        <div className="info-row">
          <span className="label">Signed in as</span>
          <span className="value">{tenant.signedInAs === 'TENANT_STAFF' ? 'Staff Account' : 'API Key'}</span>
        </div>
      </div>
    </div>
  );
}

function ApiKeysTab({ credential }: { credential: string }) {
  const { confirm, dialog } = useConfirm();
  const [keys, setKeys] = useState<TenantApiKey[] | null>(null);
  const [newKeyPlaintext, setNewKeyPlaintext] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);

  const tenantId = typeof window !== 'undefined'
    ? JSON.parse(window.localStorage.getItem('nid_dashboard_tenant') || '{}').id
    : '';

  useEffect(() => {
    if (!tenantId) return;
    setLoadError('');
    listApiKeys(credential, tenantId).then(setKeys).catch((err) => setLoadError(err.message || 'Could not load API keys.'));
  }, [credential, tenantId, reload]);

  async function handleCreateKey() {
    if (!tenantId) return;
    setError('');
    try {
      const result = await createApiKey(credential, tenantId);
      setNewKeyPlaintext(result.plaintext);
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create API key');
    }
  }

  async function revokeMany(rows: TenantApiKey[]) {
    try {
      for (const k of rows) await revokeApiKey(credential, tenantId, k.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke key');
    }
    setReload((n) => n + 1);
  }

  async function handleRevoke(key: TenantApiKey) {
    if (!(await confirm({ title: 'Revoke this API key?', body: 'Integrations that use it stop working immediately. This cannot be undone.', confirmLabel: 'Revoke key' }))) return;
    await revokeMany([key]);
  }

  return (
    <div className="tab-content">
      {dialog}
      <div className="tab-header">
        <h1>API keys</h1>
        <button className="primary-btn" onClick={handleCreateKey}>
          Create API key
        </button>
      </div>

      {newKeyPlaintext && (
        <div className="alert alert-warning">
          <strong>New API key created.</strong> Save it now, it cannot be recovered:
          <pre className="key-display">{newKeyPlaintext}</pre>
          <button onClick={() => setNewKeyPlaintext(null)}>Dismiss</button>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      <DataTable<TenantApiKey>
        caption="API keys"
        rows={keys}
        error={loadError}
        onRetry={() => setReload((n) => n + 1)}
        rowId={(k) => k.id}
        filterLabel="Filter keys"
        empty={{ title: 'No API keys yet', hint: 'Create a key to let a server call the nID API for this tenant.' }}
        columns={[
          { key: 'prefix', header: 'Prefix', value: (k) => k.keyPrefix, render: (k) => k.keyPrefix },
          { key: 'scopes', header: 'Scopes', value: (k) => k.scopes.join(', '), render: (k) => k.scopes.join(', ') },
          { key: 'rate', header: 'Rate limit', numeric: true, value: (k) => k.rateLimitPerMinute, render: (k) => `${k.rateLimitPerMinute}/min` },
          { key: 'status', header: 'Status', value: (k) => (k.revokedAt ? 'Revoked' : 'Active'), render: (k) => (k.revokedAt ? 'Revoked' : 'Active') },
          { key: 'created', header: 'Created', value: (k) => k.createdAt, render: (k) => new Date(k.createdAt).toLocaleDateString() },
        ]}
        bulkActions={[{ label: 'Revoke', destructive: true, run: (rows) => revokeMany(rows.filter((k) => !k.revokedAt)) }]}
        rowActions={(k) => !k.revokedAt && (
          <button className="danger-btn" onClick={() => handleRevoke(k)}>Revoke</button>
        )}
      />
    </div>
  );
}

function StaffTab({ credential }: { credential: string }) {
  const { confirm, dialog } = useConfirm();
  const [staff, setStaff] = useState<TenantStaffMember[] | null>(null);
  const [accountId, setAccountId] = useState('');
  const [role, setRole] = useState<'STAFF' | 'ADMIN'>('STAFF');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [success, setSuccess] = useState('');
  const [reload, setReload] = useState(0);

  const tenantId = typeof window !== 'undefined'
    ? JSON.parse(window.localStorage.getItem('nid_dashboard_tenant') || '{}').id
    : '';

  useEffect(() => {
    if (!tenantId) return;
    setLoadError('');
    listStaff(credential, tenantId).then(setStaff).catch((err) => setLoadError(err.message || 'Could not load staff.'));
  }, [credential, tenantId, reload]);

  async function handleInvite() {
    if (!tenantId || !accountId.trim()) return;
    setError('');
    setSuccess('');
    try {
      await inviteStaff(credential, tenantId, accountId.trim(), role);
      setSuccess('Staff member invited.');
      setAccountId('');
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to invite staff');
    }
  }

  async function removeMany(rows: TenantStaffMember[]) {
    setError('');
    try {
      for (const m of rows) await removeStaff(credential, tenantId, m.accountId);
      setSuccess(rows.length === 1 ? 'Staff member removed.' : `${rows.length} staff members removed.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove staff');
    }
    setReload((n) => n + 1);
  }

  async function handleRemove(m: TenantStaffMember) {
    if (!(await confirm({ title: 'Remove this staff member?', body: 'They lose access to this tenant.', confirmLabel: 'Remove staff member' }))) return;
    await removeMany([m]);
  }

  return (
    <div className="tab-content">
      {dialog}
      <h1>Staff</h1>

      <div className="invite-form">
        <h3>Invite staff</h3>
        <Field
          label="Account ID"
          value={accountId}
          onChange={setAccountId}
          validate={v.required('Account ID')}
          hint="The person's nID account ID, from their account page."
        />
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value as 'STAFF' | 'ADMIN')}>
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        <button className="primary-btn" onClick={handleInvite} disabled={!accountId.trim()}>
          Invite
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success" role="status">{success}</div>}

      <DataTable<TenantStaffMember>
        caption="Staff members"
        rows={staff}
        error={loadError}
        onRetry={() => setReload((n) => n + 1)}
        rowId={(m) => m.id}
        filterLabel="Filter staff"
        empty={{ title: 'No staff yet', hint: 'Invite someone above by their account ID.' }}
        columns={[
          { key: 'acct', header: 'Account ID', value: (m) => m.accountId, render: (m) => `${m.accountId.slice(0, 12)}...` },
          { key: 'role', header: 'Role', value: (m) => m.role, render: (m) => m.role },
          { key: 'phone', header: 'Phone', value: (m) => m.phone ?? '', render: (m) => m.phone ?? 'None' },
          { key: 'ver', header: 'Verified', value: (m) => (m.phoneVerified ? 'Yes' : 'No'), render: (m) => (m.phoneVerified ? 'Yes' : 'No') },
        ]}
        bulkActions={[{ label: 'Remove', destructive: true, run: removeMany }]}
        rowActions={(m) => <button className="danger-btn" onClick={() => handleRemove(m)}>Remove</button>}
      />
    </div>
  );
}

function SettingsTab({ credential }: { credential: string }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [name, setName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const tenantId = typeof window !== 'undefined'
    ? JSON.parse(window.localStorage.getItem('nid_dashboard_tenant') || '{}').id
    : '';

  useEffect(() => {
    apiFetch<Tenant>('/v1/tenants/me', credential).then((data) => {
      setTenant(data);
      setName(data.name);
      setWebhookUrl(data.webhookUrl ?? '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [credential]);

  async function handleSave() {
    if (!tenantId) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const secret = getPlatformAdminSecret();
      if (!secret) {
        setError('Platform admin secret not set. Please configure it first.');
        return;
      }
      await updateTenant(secret, tenantId, {
        name: name.trim(),
        webhookUrl: webhookUrl.trim() || null,
      });
      setSuccess('Settings saved successfully.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div aria-busy="true" aria-label="Loading"><Skeleton count={4} /></div>;

  return (
    <div className="tab-content">
      <h1>Tenant Settings</h1>

      <div className="settings-form">
        <Field label="Tenant Name" value={name} onChange={(val) => setName(val)} validate={v.required('Name')} placeholder="My Brand" />

        <Field label="Webhook URL" type="url" value={webhookUrl} onChange={(val) => setWebhookUrl(val)} validate={v.url()} placeholder="https://your-app.com/webhooks/nid" hint="URL for receiving real-time tenant events (used by Communicator sync)" />

        <div className="form-group">
          <label htmlFor="f1">Platform Admin Secret</label>
          <input id="f1"
            type="password"
            value={getPlatformAdminSecret() ?? ''}
            onChange={(e) => setPlatformAdminSecret(e.target.value)}
            placeholder="Enter platform admin secret"
          />
          <small>Required for tenant management operations. Set in .env as PLATFORM_ADMIN_SECRET.</small>
        </div>

        <button className="primary-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="info-card" style={{ marginTop: '2rem' }}>
        <h3>Tenant Info</h3>
        <div className="info-row">
          <span className="label">ID</span>
          <span className="value">{tenantId}</span>
        </div>
        <div className="info-row">
          <span className="label">Slug</span>
          <span className="value">{tenant?.slug}</span>
        </div>
        <div className="info-row">
          <span className="label">Region</span>
          <span className="value">{tenant?.dataResidencyRegion}</span>
        </div>
      </div>
    </div>
  );
}

function OrganizationsTab({ credential, onCreateNew, onSelectOrg }: {
  credential: string;
  onCreateNew: () => void;
  onSelectOrg?: (orgId: string) => void;
}) {
  const [organizations, setOrganizations] = useState<OrganizationRecord[] | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setError('');
    listOrganizations(credential).then(setOrganizations).catch((err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to load organizations');
    });
  }, [credential, reload]);

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h1>Organizations</h1>
        <button className="primary-btn" onClick={onCreateNew}>
          Create organization
        </button>
      </div>

      <DataTable<OrganizationRecord>
        caption="Organizations"
        rows={organizations}
        error={error}
        onRetry={() => setReload((n) => n + 1)}
        rowId={(o) => o.id}
        filterLabel="Filter organizations"
        empty={{
          title: 'No organizations yet',
          hint: 'Create an organization to manage employees, verification and brand profiles.',
          action: <button className="primary-btn" onClick={onCreateNew}>Create organization</button>,
        }}
        columns={[
          { key: 'name', header: 'Legal name', value: (o) => o.legalName, render: (o) => o.legalName },
          { key: 'reg', header: 'Registration number', value: (o) => o.registrationNumber ?? '', render: (o) => o.registrationNumber ?? 'None' },
          { key: 'cc', header: 'Country', value: (o) => o.countryCode ?? '', render: (o) => o.countryCode ?? 'None' },
          { key: 'ver', header: 'Verified', value: (o) => (o.isVerified ? 1 : 0), render: (o) => (o.isVerified ? (o.verifiedLevel ?? 'Verified') : 'Not verified') },
          { key: 'created', header: 'Created', value: (o) => o.createdAt, render: (o) => new Date(o.createdAt).toLocaleDateString() },
        ]}
        rowActions={(o) => (
          <button className="primary-btn" onClick={() => (onSelectOrg ? onSelectOrg(o.id) : (window.location.hash = `#org-${o.id}`))}>
            Manage brands
          </button>
        )}
      />
    </div>
  );
}

function CreateOrganizationForm({
  credential,
  onSuccess,
  onCancel,
}: {
  credential: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [legalName, setLegalName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OrganizationRecord | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await createOrganization(credential, {
        legalName: legalName.trim(),
        registrationNumber: registrationNumber.trim() || undefined,
        countryCode: countryCode.trim() || undefined,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="tab-content">
        <h1>Organization Created Successfully</h1>
        <div className="alert alert-success">
          <p>Your organization has been created. You can now invite employees and start the verification process.</p>
          <div className="info-card">
            <div className="info-row">
              <span className="label">ID</span>
              <span className="value">{result.id}</span>
            </div>
            <div className="info-row">
              <span className="label">Legal Name</span>
              <span className="value">{result.legalName}</span>
            </div>
            <div className="info-row">
              <span className="label">Registration #</span>
              <span className="value">{result.registrationNumber ?? 'Not set'}</span>
            </div>
            <div className="info-row">
              <span className="label">Country</span>
              <span className="value">{result.countryCode ?? 'Not set'}</span>
            </div>
          </div>
        </div>
        <button className="primary-btn" onClick={onSuccess}>
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h1>Create New Organization</h1>
        <button onClick={onCancel}>Cancel</button>
      </div>

      <form onSubmit={handleSubmit} className="create-tenant-form">
        <Field label="Legal Name" value={legalName} onChange={(val) => setLegalName(val)} validate={v.required('Legal name')} placeholder="Acme Corporation Ltd." />

        <div className="form-group">
          <label htmlFor="f2">Registration Number</label>
          <input id="f2"
            type="text"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            placeholder="Company registration number"
          />
          <small>Business registration or tax ID number (optional but recommended for verification)</small>
        </div>

        <Field label="Country Code" value={countryCode} onChange={(val) => setCountryCode(val.toUpperCase())} validate={v.all((x) => (!x || /^[A-Z]{2}$/.test(x) ? null : 'Use two letters, like US.'))} placeholder="US" hint="ISO 3166-1 alpha-2 country code (e.g., US, GB, DE)" />

        {error && <div className="alert alert-error">{error}</div>}

        <button type="submit" className="primary-btn" disabled={loading || !legalName.trim()}>
          {loading ? 'Creating…' : 'Create organization'}
        </button>
      </form>
    </div>
  );
}


function CreateTenantForm({
  secret,
  onSuccess,
  onCancel,
}: {
  secret: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CreateTenantResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await createTenant(secret, {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        webhookUrl: webhookUrl.trim() || undefined,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create tenant');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="tab-content">
        <h1>Tenant Created Successfully</h1>
        <div className="alert alert-success">
          <p>{result.message}</p>
          <div className="info-card">
            <div className="info-row">
              <span className="label">ID</span>
              <span className="value">{result.id}</span>
            </div>
            <div className="info-row">
              <span className="label">Name</span>
              <span className="value">{result.name}</span>
            </div>
            <div className="info-row">
              <span className="label">Slug</span>
              <span className="value">{result.slug}</span>
            </div>
            <div className="info-row">
              <span className="label">Webhook Secret</span>
              <span className="value">{result.webhookSecret}</span>
            </div>
            <div className="info-row">
              <span className="label">Billing Webhook Secret</span>
              <span className="value">{result.billingWebhookSecret}</span>
            </div>
          </div>
          <p className="warning">Save the webhook secrets, they cannot be recovered.</p>
        </div>
        <button className="primary-btn" onClick={onSuccess}>
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h1>Create New Tenant</h1>
        <button onClick={onCancel}>Cancel</button>
      </div>

      <form onSubmit={handleSubmit} className="create-tenant-form">
        <Field label="Tenant Name" value={name} onChange={(val) => setName(val)} validate={v.required('Name')} placeholder="My Brand" />

        <Field label="Slug" value={slug} onChange={(val) => setSlug(val.toLowerCase())} validate={v.slug()} placeholder="my-brand" hint="3-64 lowercase alphanumeric characters or hyphens" />

        <div className="form-group">
          <label htmlFor="f3">Data Residency Region</label>
          <input id="f3"
            type="text"
            defaultValue="global"
            placeholder="global"
          />
        </div>

        <Field label="Webhook URL" type="url" value={webhookUrl} onChange={(val) => setWebhookUrl(val)} validate={v.url()} placeholder="https://communicator.example.com/webhooks/nid" hint="URL for real-time sync to Communicator" />

        {error && <div className="alert alert-error">{error}</div>}

        <button type="submit" className="primary-btn" disabled={loading || !name.trim() || !slug.trim()}>
          {loading ? 'Creating…' : 'Create tenant'}
        </button>
      </form>
    </div>
  );
}

function LoginScreen({
  onLogin,
  onPlatformAdminLogin,
  error,
  loading: _loading,
}: {
  onLogin: (credential: string) => void;
  onPlatformAdminLogin: () => void;
  error: string | null;
  loading: boolean;
}) {
  const [mode, setMode] = useState<'staff' | 'platform'>('staff');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [platformSecret, setPlatformSecret] = useState('');
  const [stepError, setStepError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setStepError('');
    setSubmitting(true);
    try {
      const { startStaffOtp } = await import('../lib/api-client');
      await startStaffOtp(phone.trim());
      setStep('code');
    } catch (err) {
      setStepError(err instanceof ApiError ? err.message : 'Could not send a code.');
    } finally {
      setSubmitting(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setStepError('');
    setSubmitting(true);
    try {
      const { verifyStaffOtp } = await import('../lib/api-client');
      const { sessionToken } = await verifyStaffOtp(phone.trim(), code);
      onLogin(sessionToken);
    } catch (err) {
      setStepError(err instanceof ApiError ? err.message : 'That code did not work.');
    } finally {
      setSubmitting(false);
    }
  }

  function handlePlatformAdminLogin() {
    if (platformSecret.trim().length < 32) {
      setStepError('Platform admin secret must be 32+ characters.');
      return;
    }
    setPlatformAdminSecret(platformSecret.trim());
    onPlatformAdminLogin();
    setMode('platform');
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <Logomark size={44} />
        </div>
        <p className="brand">nID Dashboard</p>

        <div className="login-mode-toggle">
          <button
            className={mode === 'staff' ? 'active' : ''}
            onClick={() => setMode('staff')}
          >
            Staff Login
          </button>
          <button
            className={mode === 'platform' ? 'active' : ''}
            onClick={() => setMode('platform')}
          >
            Platform Admin
          </button>
        </div>

        {mode === 'staff' ? (
          <>
            <h1>Sign in as staff</h1>
            <p className="lead">
              {step === 'phone'
                ? 'Sign in with your nID account.'
                : `Enter the code sent to ${phone.trim()}.`}
            </p>

            {step === 'phone' ? (
              <form onSubmit={sendCode}>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1234567890"
                  required
                />
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={verify}>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="OTP code"
                  required
                />
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Verifying…' : 'Verify'}
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            <h1>Platform Admin</h1>
            <p className="lead">Enter your platform admin secret to manage tenants.</p>
            <form onSubmit={(e) => { e.preventDefault(); handlePlatformAdminLogin(); }}>
              <input
                type="password"
                value={platformSecret}
                onChange={(e) => setPlatformSecret(e.target.value)}
                placeholder="Platform admin secret"
                required
              />
              <button type="submit">Login</button>
            </form>
          </>
        )}

        {stepError && <p className="error">{stepError}</p>}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}

function BrandsTab({
  credential,
  onCreateNew,
  preselectedOrgId,
}: {
  credential: string;
  onCreateNew: () => void;
  preselectedOrgId?: string | null;
}) {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const [brands, setBrands] = useState<BrandRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [brandError, setBrandError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    listOrganizations(credential).then((data) => {
      setOrganizations(data);
      if (preselectedOrgId && data.some((o) => o.id === preselectedOrgId)) {
        setSelectedOrg(preselectedOrgId);
      } else if (data.length > 0) {
        setSelectedOrg(data[0].id);
      }
      setLoading(false);
    }).catch((err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to load organizations');
      setLoading(false);
    });
  }, [credential, preselectedOrgId]);

  useEffect(() => {
    if (!selectedOrg) return;
    setBrandError('');
    setBrands(null);
    listBrands(credential, selectedOrg)
      .then((data) => setBrands(data))
      .catch((err) => setBrandError(err instanceof ApiError ? err.message : 'Could not load brands.'));
  }, [credential, selectedOrg, reload]);

  async function deactivateMany(rows: BrandRecord[]) {
    try {
      for (const b of rows) await deactivateBrand(credential, b.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to deactivate brand');
    }
    setReload((n) => n + 1);
  }

  async function handleDeactivate(brand: BrandRecord) {
    if (!(await confirm({ title: `Deactivate ${brand.name}?`, body: 'The brand stops appearing in verification flows. This cannot be easily undone.', confirmLabel: 'Deactivate brand' }))) return;
    await deactivateMany([brand]);
  }

  if (loading) return <div aria-busy="true" aria-label="Loading"><Skeleton count={4} /></div>;

  return (
    <div className="tab-content">
      {dialog}
      <div className="tab-header">
        <h1>Brands</h1>
        <button className="primary-btn" onClick={onCreateNew} disabled={!selectedOrg}>
          Create brand
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 8, fontWeight: 500 }}>Organization:</label>
        <select
          value={selectedOrg ?? ''}
          onChange={(e) => setSelectedOrg(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14 }}
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.legalName}
            </option>
          ))}
        </select>
      </div>

      {!selectedOrg ? (
        <div className="nid-state nid-state-empty">
          <p className="nid-state-title">No organizations found</p>
          <p>Create an organization first, then add brands under it.</p>
        </div>
      ) : (
        <DataTable<BrandRecord>
          caption="Brands"
          rows={brands}
          error={brandError}
          onRetry={() => setReload((n) => n + 1)}
          rowId={(b) => b.id}
          filterLabel="Filter brands"
          empty={{ title: 'No brands yet', hint: 'Create a brand to manage its identity, products and channels.', action: <button className="primary-btn" onClick={onCreateNew}>Create brand</button> }}
          columns={[
            { key: 'name', header: 'Name', value: (b) => b.name, render: (b) => b.name },
            { key: 'slug', header: 'Slug', value: (b) => b.slug, render: (b) => <code>{b.slug}</code> },
            { key: 'desc', header: 'Description', value: (b) => b.description ?? '', render: (b) => b.description ?? 'None' },
            { key: 'site', header: 'Website', value: (b) => b.website ?? '', render: (b) => b.website ?? 'None' },
            { key: 'active', header: 'Active', value: (b) => (b.active ? 'Active' : 'Inactive'), render: (b) => (b.active ? 'Active' : 'Inactive') },
            { key: 'created', header: 'Created', value: (b) => b.createdAt, render: (b) => new Date(b.createdAt).toLocaleDateString() },
          ]}
          bulkActions={[{ label: 'Deactivate', destructive: true, run: deactivateMany }]}
          rowActions={(b) => <button className="danger-btn" onClick={() => handleDeactivate(b)}>Deactivate</button>}
        />
      )}
    </div>
  );
}

function CreateBrandForm({
  credential,
  onSuccess,
  onCancel,
}: {
  credential: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [orgId, setOrgId] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BrandRecord | null>(null);

  useEffect(() => {
    listOrganizations(credential).then((data) => {
      setOrganizations(data);
      if (data.length === 1) setOrgId(data[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [credential]);

  // Auto-generate slug from name
  useEffect(() => {
    if (name && !slug) {
      setSlug(
        name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      );
    }
  }, [name]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !name.trim()) return;
    setCreating(true);
    setError('');
    try {
      const dto: CreateBrandRequest = {
        organizationId: orgId,
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || undefined,
        website: website.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      };
      const data = await createBrand(credential, dto);
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create brand');
    } finally {
      setCreating(false);
    }
  }

  if (result) {
    return (
      <div className="tab-content">
        <h1>Brand Created Successfully</h1>
        <div className="alert alert-success">
          <p>Your brand has been created and will be synced to your connected services.</p>
          <div className="info-card">
            <div className="info-row">
              <span className="label">ID</span>
              <span className="value">{result.id}</span>
            </div>
            <div className="info-row">
              <span className="label">Name</span>
              <span className="value">{result.name}</span>
            </div>
            <div className="info-row">
              <span className="label">Slug</span>
              <span className="value">{result.slug}</span>
            </div>
          </div>
        </div>
        <button className="primary-btn" onClick={onSuccess}>
          Done
        </button>
      </div>
    );
  }

  if (loading) return <div aria-busy="true" aria-label="Loading"><Skeleton count={4} /></div>;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h1>Create New Brand</h1>
        <button onClick={onCancel}>Cancel</button>
      </div>

      <form onSubmit={handleSubmit} className="create-tenant-form">
        <div className="form-group">
          <label htmlFor="f4">Organization *</label>
          <select id="f4"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            required
          >
            <option value="">Select an organization</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.legalName}
              </option>
            ))}
          </select>
          <small>The organization this brand will belong to</small>
        </div>

        <Field label="Brand Name" value={name} onChange={(val) => setName(val)} validate={v.required('Name')} placeholder="My Clothing Brand" />

        <Field label="Slug" value={slug} onChange={(val) => setSlug(val)} validate={v.slug()} placeholder="my-clothing-brand" hint="URL-friendly identifier (auto-generated from name, editable)" />

        <div className="form-group">
          <label htmlFor="f5">Description</label>
          <input id="f5"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Premium sustainable fashion"
          />
        </div>

        <Field label="Website" type="url" value={website} onChange={(val) => setWebsite(val)} validate={v.url()} placeholder="https://mybrand.com" />

        <Field label="Contact Email" type="email" value={email} onChange={(val) => setEmail(val)} validate={v.email()} placeholder="hello@mybrand.com" />

        <Field label="Contact Phone" type="tel" value={phone} onChange={(val) => setPhone(val)} validate={v.phone()} placeholder="+1234567890" />

        {error && <div className="alert alert-error">{error}</div>}

        <button type="submit" className="primary-btn" disabled={creating || !orgId || !name.trim()}>
          {creating ? 'Creating…' : 'Create Brand'}
        </button>
      </form>
    </div>
  );
}

/* ============================================================================
   THREE-LAYER ACCESS CONTROL TABS
   ============================================================================ */

// ---- Layer 1: Access Management Tab ----

function AccessTab({ credential }: { credential: string }) {
  const { confirm, dialog } = useConfirm();
  const [tenant, setTenant] = useState<{ id: string; name: string } | null>(null);
  const [grants, setGrants] = useState<AccessGrantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [accessType, setAccessType] = useState<'OWNER' | 'PARTNER' | 'ADMIN' | 'MEMBER'>('MEMBER');
  const [partnershipPercentage, setPartnershipPercentage] = useState<number>(50);
  const [creating, setCreating] = useState(false);

  const [showTransferForm, setShowTransferForm] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [transferring, setTransferring] = useState(false);

  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [partnerAccountId, setPartnerAccountId] = useState('');
  const [partnerPercentage, setPartnerPercentage] = useState<number>(10);
  const [addingPartner, setAddingPartner] = useState(false);

  const [myPermissions, setMyPermissions] = useState<MyPermissionsResponse | null>(null);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);

  useEffect(() => {
    loadTenant();
  }, []);

  async function loadTenant() {
    try {
      const data = await apiFetch<any>('/v1/tenants/me', credential);
      setTenant(data);
      await loadGrants(data.id);
      await loadMyPermissions(data.id);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  async function loadGrants(tenantId: string) {
    try {
      const data = await listAccessGrants(credential, tenantId);
      setGrants(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMyPermissions(tenantId: string) {
    setPermissionsError(null);
    try {
      setMyPermissions(await getMyPermissions(credential, tenantId));
    } catch (e) {
      setPermissionsError((e as Error).message);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !accountId.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createAccessGrant(credential, tenant.id, {
        accountId: accountId.trim(),
        accessType,
        partnershipPercentage: accessType === 'PARTNER' ? partnershipPercentage : undefined,
      });
      setSuccess('Access grant created successfully');
      setAccountId('');
      setShowForm(false);
      await loadGrants(tenant.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(grantId: string) {
    if (!(await confirm({ title: 'Revoke this access grant?', body: 'The person loses access to this tenant right away.', confirmLabel: 'Revoke access' }))) return;
    if (!tenant) return;
    try {
      await revokeAccessGrant(credential, tenant.id, grantId);
      setSuccess('Access revoked');
      await loadGrants(tenant.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleTransferOwnership(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !newOwnerId.trim()) return;
    if (!(await confirm({
      title: 'Transfer tenant ownership?',
      body: 'The new owner gets full tenant access, including the ability to transfer ownership again. This cannot be undone by revoking a grant alone.',
      confirmLabel: 'Transfer ownership',
    }))) return;
    setTransferring(true);
    setError(null);
    try {
      await transferOwnership(credential, tenant.id, { newOwnerId: newOwnerId.trim() });
      setSuccess('Ownership transferred');
      setNewOwnerId('');
      setShowTransferForm(false);
      await loadGrants(tenant.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTransferring(false);
    }
  }

  async function handleAddPartner(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !partnerAccountId.trim()) return;
    setAddingPartner(true);
    setError(null);
    try {
      await addPartner(credential, tenant.id, { accountId: partnerAccountId.trim(), percentage: partnerPercentage });
      setSuccess('Partner added');
      setPartnerAccountId('');
      setShowPartnerForm(false);
      await loadGrants(tenant.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAddingPartner(false);
    }
  }

  if (loading) return <div aria-busy="true" aria-label="Loading"><Skeleton count={4} /></div>;
  if (!tenant) return <p>Failed to load tenant.</p>;

  return (
    <div className="tab-content">
      {dialog}
      <div className="tab-header">
        <h1>Access Management</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="secondary-btn" onClick={() => setShowPartnerForm(!showPartnerForm)}>
            {showPartnerForm ? 'Cancel' : '+ Add Partner'}
          </button>
          <button className="secondary-btn" onClick={() => setShowTransferForm(!showTransferForm)}>
            {showTransferForm ? 'Cancel' : 'Transfer Ownership'}
          </button>
          <button className="primary-btn" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Grant Access'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showTransferForm && (
        <form onSubmit={handleTransferOwnership} className="create-tenant-form">
          <h3>Transfer Ownership</h3>
          <div className="form-group">
            <label>New Owner's Account ID *</label>
            <input
              type="text"
              value={newOwnerId}
              onChange={(e) => setNewOwnerId(e.target.value)}
              placeholder="ckx7z8a9b000001la2m3n4o5p"
              required
            />
            <small>This account becomes the tenant's sole OWNER. This cannot be undone by revoking a grant.</small>
          </div>
          <button type="submit" className="btn-danger" disabled={transferring || !newOwnerId.trim()}>
            {transferring ? 'Transferring…' : 'Transfer Ownership'}
          </button>
        </form>
      )}

      {showPartnerForm && (
        <form onSubmit={handleAddPartner} className="create-tenant-form">
          <h3>Add Partner</h3>
          <div className="form-group">
            <label>Account ID *</label>
            <input
              type="text"
              value={partnerAccountId}
              onChange={(e) => setPartnerAccountId(e.target.value)}
              placeholder="ckx7z8a9b000001la2m3n4o5p"
              required
            />
          </div>
          <div className="form-group">
            <label>Ownership Percentage *</label>
            <input
              type="number"
              min={1}
              max={100}
              value={partnerPercentage}
              onChange={(e) => setPartnerPercentage(Number(e.target.value))}
            />
          </div>
          <button type="submit" className="primary-btn" disabled={addingPartner || !partnerAccountId.trim()}>
            {addingPartner ? 'Adding…' : 'Add Partner'}
          </button>
        </form>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="create-tenant-form">
          <h3>Grant Access</h3>
          <div className="form-group">
            <label htmlFor="f6">Account ID *</label>
            <input id="f6"
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="ckx7z8a9b000001la2m3n4o5p"
              required
            />
            <small>The nID Account ID of the person to grant access to</small>
          </div>
          <div className="form-group">
            <label htmlFor="f7">Access Type *</label>
            <select id="f7" value={accessType} onChange={(e) => setAccessType(e.target.value as any)}>
              <option value="MEMBER">Member: Basic access with role-defined permissions</option>
              <option value="ADMIN">Admin: Full access to entity and sub-entities</option>
              <option value="PARTNER">Partner: Percentage-based ownership share</option>
              <option value="OWNER">Owner: Full tenant access (except ownership transfer)</option>
            </select>
          </div>
          {accessType === 'PARTNER' && (
            <div className="form-group">
              <label htmlFor="f8">Partnership Percentage *</label>
              <input id="f8"
                type="number"
                min={1}
                max={100}
                value={partnershipPercentage}
                onChange={(e) => setPartnershipPercentage(Number(e.target.value))}
              />
              <small>Ownership share percentage (1-100)</small>
            </div>
          )}
          <button type="submit" className="primary-btn" disabled={creating || !accountId.trim()}>
            {creating ? 'Granting…' : 'Grant Access'}
          </button>
        </form>
      )}

      <DataTable<AccessGrantRecord>
        caption="Access grants"
        rows={grants}
        rowId={(g) => g.id}
        filterLabel="Filter grants"
        empty={{ title: 'No access grants yet', hint: 'Use Grant access to add a member.' }}
        columns={[
          { key: 'acct', header: 'Account', value: (g) => g.accountPhone || g.accountEmail || g.accountId, render: (g) => <strong>{g.accountPhone || g.accountEmail || g.accountId.slice(0, 8)}</strong> },
          { key: 'type', header: 'Type', value: (g) => g.accessType, render: (g) => g.accessType },
          { key: 'pct', header: 'Partnership %', numeric: true, value: (g) => g.partnershipPercentage ?? 0, render: (g) => (g.partnershipPercentage ? `${g.partnershipPercentage}%` : 'None') },
          { key: 'status', header: 'Status', value: (g) => g.status, render: (g) => g.status },
          { key: 'granted', header: 'Granted', value: (g) => g.createdAt, render: (g) => new Date(g.createdAt).toLocaleDateString() },
        ]}
        bulkActions={[{
          label: 'Revoke',
          destructive: true,
          run: async (rows) => {
            try { for (const g of rows.filter((r) => r.accessType !== 'OWNER')) await revokeAccessGrant(credential, tenant.id, g.id); setSuccess('Access revoked'); }
            catch (e) { setError((e as Error).message); }
            await loadGrants(tenant.id);
          },
        }]}
        rowActions={(g) => (
          <button className="btn-danger" onClick={() => handleRevoke(g.id)} disabled={g.accessType === 'OWNER'}>Revoke</button>
        )}
      />

      <div className="tab-header" style={{ marginTop: 32 }}>
        <h2>My Permissions</h2>
      </div>
      {permissionsError && <div className="alert alert-error">{permissionsError}</div>}
      {!permissionsError && !myPermissions && <p>Loading…</p>}
      {myPermissions && (
        <DataTable<PermissionEntry>
          caption="My permissions"
          rows={myPermissions.permissions}
          rowId={(p) => p.permissionKey}
          filterLabel="Filter permissions"
          empty={{ title: 'No permissions defined in the catalog yet.' }}
          columns={[
            { key: 'group', header: 'Group', value: (p) => p.groupName, render: (p) => p.groupName },
            { key: 'service', header: 'Service', value: (p) => p.serviceName, render: (p) => p.serviceName },
            { key: 'permission', header: 'Permission', value: (p) => p.label, render: (p) => p.label },
            { key: 'granted', header: 'Granted', value: (p) => (p.granted ? 'Granted' : 'Not granted'), render: (p) => <span className={`badge badge-${p.granted ? 'active' : 'revoked'}`}>{p.granted ? 'Granted' : 'Not granted'}</span> },
          ]}
        />
      )}
    </div>
  );
}

// ---- Layer 2: Departments Tab ----

function DepartmentsTab({ credential }: { credential: string }) {
  const [tenant, setTenant] = useState<{ id: string; name: string } | null>(null);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [icon, setIcon] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadTenant();
  }, []);

  async function loadTenant() {
    try {
      const data = await apiFetch<any>('/v1/tenants/me', credential);
      setTenant(data);
      await loadDepartments(data.id);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  async function loadDepartments(tenantId: string) {
    try {
      const data = await listDepartments(credential, tenantId);
      setDepartments(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createDepartment(credential, tenant.id, {
        name: name.trim(),
        slug: slug.trim() || undefined,
        color,
        icon: icon.trim() || undefined,
      });
      setSuccess('Department created');
      setName('');
      setSlug('');
      setShowForm(false);
      await loadDepartments(tenant.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div aria-busy="true" aria-label="Loading"><Skeleton count={4} /></div>;
  if (!tenant) return <p>Failed to load tenant.</p>;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h1>Departments</h1>
        <button className="primary-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Department'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="create-tenant-form">
          <h3>Create Department</h3>
          <div className="form-group">
            <label htmlFor="f9">Department Name *</label>
            <input id="f9"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
              }}
              placeholder="Finance"
              required
            />
          </div>
          <Field label="Slug" value={slug} onChange={(val) => setSlug(val)} validate={v.slug()} placeholder="finance" hint="URL-friendly identifier (auto-generated)" />
          <div className="form-group">
            <label htmlFor="f10">Icon</label>
            <input id="f10" type="text" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="finance" />
          </div>
          <div className="form-group">
            <label htmlFor="f11">Color</label>
            <input id="f11" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          <button type="submit" className="primary-btn" disabled={creating || !name.trim()}>
            {creating ? 'Creating…' : 'Create Department'}
          </button>
        </form>
      )}

      <div className="departments-grid">
        {departments.map((dept) => (
          <div key={dept.id} className="department-card">
            <div className="department-icon" style={{ color: dept.color || '#3b82f6' }}>
              {dept.icon || '📁'}
            </div>
            <h3>{dept.name}</h3>
            <p className="department-slug">{dept.slug}</p>
            {dept.inheritedFromTenant && <span className="badge badge-info">Inherited</span>}
            {dept.defaultPermissions && (
              <p className="department-perms">{dept.defaultPermissions.length} permissions</p>
            )}
          </div>
        ))}
        {departments.length === 0 && (
          <p>No departments yet. Create one to organize access by function.</p>
        )}
      </div>
    </div>
  );
}

// ---- Layer 3: Roles Tab with Permission Tree Builder ----

function RolesTab({ credential }: { credential: string }) {
  const [tenant, setTenant] = useState<{ id: string; name: string } | null>(null);
  const [roles, setRoles] = useState<RoleDefinitionRecord[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalogGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTenant();
  }, []);

  async function loadTenant() {
    try {
      const data = await apiFetch<any>('/v1/tenants/me', credential);
      setTenant(data);
      await Promise.all([loadRoles(data.id), loadCatalog()]);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  async function loadRoles(tenantId: string) {
    try {
      const data = await listRoles(credential, tenantId);
      setRoles(data);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function loadCatalog() {
    try {
      const data = await getPermissionCatalog(credential);
      setCatalog(data);
      // Expand all groups by default
      setExpandedGroups(new Set(data.map(g => g.groupName)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createRole(credential, tenant.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        permissions: selectedPerms,
      });
      setSuccess('Role created');
      setName('');
      setDescription('');
      setSelectedPerms([]);
      setShowForm(false);
      await loadRoles(tenant.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  function toggleGroup(groupName: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  }

  function togglePermission(key: string) {
    setSelectedPerms(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  }

  function toggleService(serviceName: string, group: PermissionCatalogGroup) {
    const servicePerms = group.services
      .find(s => s.serviceName === serviceName)
      ?.permissions.map(p => p.permissionKey) ?? [];
    const allSelected = servicePerms.every(p => selectedPerms.includes(p));
    if (allSelected) {
      setSelectedPerms(prev => prev.filter(p => !servicePerms.includes(p)));
    } else {
      setSelectedPerms(prev => [...new Set([...prev, ...servicePerms])]);
    }
  }

  if (loading) return <div aria-busy="true" aria-label="Loading"><Skeleton count={4} /></div>;
  if (!tenant) return <p>Failed to load tenant.</p>;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h1>Roles & Permissions</h1>
        <button className="primary-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Role'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="create-tenant-form">
          <h3>Create Custom Role</h3>
          <Field label="Role Name" value={name} onChange={(val) => setName(val)} validate={v.required('Name')} placeholder="Finance Manager" />
          <div className="form-group">
            <label htmlFor="f12">Description</label>
            <textarea id="f12" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Manages all finance-related operations" rows={2} />
          </div>

          <div className="form-group">
            <span className="form-label" id="perm-label">Permissions ({selectedPerms.length} selected)</span>
            <div className="permission-tree" role="group" aria-labelledby="perm-label">
              {catalog.map(group => (
                <div key={group.groupName} className="permission-group">
                  <button
                    type="button"
                    className="permission-group-header"
                    onClick={() => toggleGroup(group.groupName)}
                  >
                    {expandedGroups.has(group.groupName) ? '▼' : '▶'} {group.groupName}
                    <span className="perm-count">
                      {group.services.reduce((sum, s) => sum + s.permissions.length, 0)} perms
                    </span>
                  </button>
                  {expandedGroups.has(group.groupName) && group.services.map(service => (
                    <div key={service.serviceName} className="permission-service">
                      <label className="permission-service-header">
                        <input
                          type="checkbox"
                          checked={service.permissions.every(p => selectedPerms.includes(p.permissionKey))}
                          onChange={() => toggleService(service.serviceName, group)}
                        />
                        {service.serviceName}
                      </label>
                      {service.permissions.map(perm => (
                        <label key={perm.permissionKey} className="permission-item">
                          <input
                            type="checkbox"
                            checked={selectedPerms.includes(perm.permissionKey)}
                            onChange={() => togglePermission(perm.permissionKey)}
                          />
                          <span>{perm.label}</span>
                          {perm.description && <small>{perm.description}</small>}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="primary-btn" disabled={creating || !name.trim()}>
            {creating ? 'Creating…' : 'Create Role'}
          </button>
        </form>
      )}

      <div className="roles-grid">
        {roles.map(role => (
          <div key={role.id} className="role-card">
            {role.isBuiltIn && <span className="badge badge-info">Built-in</span>}
            <h3>{role.name}</h3>
            <p className="role-slug">{role.slug}</p>
            {role.description && <p className="role-desc">{role.description}</p>}
            <p className="role-perm-count">{role.permissions.length} permissions</p>
          </div>
        ))}
        {roles.length === 0 && <p>No roles yet.</p>}
      </div>
    </div>
  );
}

// ---- Invitations Tab ----

function InvitationsTab({ credential }: { credential: string }) {
  const { confirm, dialog } = useConfirm();
  const [tenant, setTenant] = useState<{ id: string; name: string } | null>(null);
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviteType, setInviteType] = useState<'email' | 'username'>('email');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadTenant();
  }, []);

  async function loadTenant() {
    try {
      const data = await apiFetch<any>('/v1/tenants/me', credential);
      setTenant(data);
      await loadInvitations(data.id);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  async function loadInvitations(tenantId: string) {
    try {
      const data = await listInvitations(credential, tenantId);
      setInvitations(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setSending(true);
    setError(null);
    try {
      if (inviteType === 'email') {
        await sendEmailInvitation(credential, tenant.id, { email: email.trim() });
      } else {
        await sendUsernameInvitation(credential, tenant.id, { username: username.trim() });
      }
      setSuccess('Invitation sent');
      setEmail('');
      setUsername('');
      await loadInvitations(tenant.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function handleRevoke(invitationId: string) {
    if (!(await confirm({ title: 'Revoke this invitation?', body: 'The invitation link stops working.', confirmLabel: 'Revoke invitation' }))) return;
    if (!tenant) return;
    try {
      await revokeInvitation(credential, tenant.id, invitationId);
      setSuccess('Invitation revoked');
      await loadInvitations(tenant.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <div aria-busy="true" aria-label="Loading"><Skeleton count={4} /></div>;
  if (!tenant) return <p>Failed to load tenant.</p>;

  return (
    <div className="tab-content">
      {dialog}
      <div className="tab-header">
        <h1>Invitations</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSend} className="create-tenant-form">
        <h3>Send Invitation</h3>
        <div className="form-group">
          <span className="form-label" id="invite-label">Invite method</span>
          <div className="radio-group" role="radiogroup" aria-labelledby="invite-label">
            <label>
              <input
                type="radio"
                name="inviteType"
                checked={inviteType === 'email'}
                onChange={() => setInviteType('email')}
              />
              Email Invite
            </label>
            <label>
              <input
                type="radio"
                name="inviteType"
                checked={inviteType === 'username'}
                onChange={() => setInviteType('username')}
              />
              Username Lookup
            </label>
          </div>
        </div>
        {inviteType === 'email' ? (
          <Field label="Email Address" type="email" value={email} onChange={(val) => setEmail(val)} validate={v.email()} placeholder="user@example.com" />
        ) : (
          <div className="form-group">
            <label htmlFor="f13">Username *</label>
            <input id="f13" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" required />
            <small>Share this form with the user, or have them provide their username</small>
          </div>
        )}
        <button type="submit" className="primary-btn" disabled={sending || (inviteType === 'email' ? !email.trim() : !username.trim())}>
          {sending ? 'Sending…' : 'Send Invitation'}
        </button>
      </form>

      <h3>Pending invitations</h3>
      <DataTable<InvitationRecord>
        caption="Pending invitations"
        rows={invitations.filter((inv) => inv.status === 'PENDING')}
        rowId={(i) => i.id}
        filterLabel="Filter invitations"
        empty={{ title: 'No pending invitations', hint: 'Invitations you send appear here until they are accepted or expire.' }}
        columns={[
          { key: 'who', header: 'Email or username', value: (i) => i.email || i.username || '', render: (i) => i.email || i.username || 'None' },
          { key: 'scope', header: 'Scope', value: (i) => i.scope, render: (i) => i.scope },
          { key: 'status', header: 'Status', value: (i) => i.status, render: (i) => i.status },
          { key: 'exp', header: 'Expires', value: (i) => i.expiresAt, render: (i) => new Date(i.expiresAt).toLocaleDateString() },
        ]}
        bulkActions={[{
          label: 'Revoke',
          destructive: true,
          run: async (rows) => {
            try { for (const i of rows) await revokeInvitation(credential, tenant.id, i.id); setSuccess(`${rows.length} revoked`); }
            catch (e) { setError((e as Error).message); }
            await loadInvitations(tenant.id);
          },
        }]}
        rowActions={(i) => <button className="danger-btn" onClick={() => handleRevoke(i.id)}>Revoke</button>}
      />
    </div>
  );
}
