'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  apiFetch,
  platformApiFetch,
  createTenant,
  listTenants,
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
  getOrganization,
  listMembers,
  inviteEmployee,
  createBrand,
  listBrands,
  getBrand,
  updateBrand,
  deactivateBrand,
  createAccessGrant,
  listAccessGrants,
  updateAccessGrant,
  revokeAccessGrant,
  transferOwnership,
  addPartner,
  getMyPermissions,
  createDepartment,
  listDepartments,
  updateDepartment,
  assignToDepartment,
  removeDepartmentAssignment,
  createRole,
  listRoles,
  updateRole,
  deleteRole,
  assignRole,
  removeRoleAssignment,
  getPermissionCatalog,
  sendEmailInvitation,
  sendUsernameInvitation,
  listInvitations,
  revokeInvitation,
  ApiError,
  type TenantListItem,
  type TenantApiKey,
  type TenantStaffMember,
  type OrganizationRecord,
  type OrganizationMember,
  type InviteEmployeeRequest,
  type BrandRecord,
  type CreateBrandRequest,
  type AccessGrantRecord,
  type DepartmentRecord,
  type DepartmentAssignmentRecord,
  type RoleDefinitionRecord,
  type RoleAssignmentRecord,
  type PermissionCatalogGroup,
  type PermissionCatalogEntry,
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
        <div className="loading-row">
          <span className="spinner" aria-hidden="true" />
          Checking for a saved session…
        </div>
      </div>
    );
  }

  if (state.kind === 'signed-out') {
    return (
      <LoginScreen
        onLogin={login}
        onPlatformAdminLogin={() => setPlatformAdminSecret('')}
        error={loginError}
        loading={loggingIn}
      />
    );
  }

  return (
    <>
      <Header tenant={state.tenant} onLogout={logout} />
      <main className="shell">
        <CaseList credential={state.credential} />
      </main>
    </>
  );
}

function DashboardLayout({ credential }: { credential: string }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'organizations' | 'brands' | 'api-keys' | 'staff' | 'access' | 'departments' | 'roles' | 'invitations' | 'settings'>('overview');
  const [platformSecret, setPlatformSecret] = useState<string | null>(null);
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [showCreateOrganization, setShowCreateOrganization] = useState(false);
  const [showCreateBrand, setShowCreateBrand] = useState(false);
  const [selectedOrgForBrands, setSelectedOrgForBrands] = useState<string | null>(null);

  useEffect(() => {
    setPlatformSecret(getPlatformAdminSecret());
  }, []);

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`nav-item ${activeTab === 'organizations' ? 'active' : ''}`}
            onClick={() => setActiveTab('organizations')}
          >
            Organizations
          </button>
          <button
            className={`nav-item ${activeTab === 'brands' ? 'active' : ''}`}
            onClick={() => setActiveTab('brands')}
          >
            Brands
          </button>
          <button
            className={`nav-item ${activeTab === 'api-keys' ? 'active' : ''}`}
            onClick={() => setActiveTab('api-keys')}
          >
            API Keys
          </button>
          <button
            className={`nav-item ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => setActiveTab('staff')}
          >
            Staff
          </button>
          <button
            className={`nav-item ${activeTab === 'access' ? 'active' : ''}`}
            onClick={() => setActiveTab('access')}
          >
            Access
          </button>
          <button
            className={`nav-item ${activeTab === 'departments' ? 'active' : ''}`}
            onClick={() => setActiveTab('departments')}
          >
            Departments
          </button>
          <button
            className={`nav-item ${activeTab === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            Roles
          </button>
          <button
            className={`nav-item ${activeTab === 'invitations' ? 'active' : ''}`}
            onClick={() => setActiveTab('invitations')}
          >
            Invitations
          </button>
          <button
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </nav>

        {platformSecret && (
          <div className="sidebar-platform-admin">
            <h3>Platform Admin</h3>
            <button
              className="create-tenant-btn"
              onClick={() => setShowCreateTenant(true)}
            >
              + Create Tenant
            </button>
            <Link href="/tenants" className="view-tenants-link">
              View All Tenants
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
        ) : showCreateBrand ? (
          <CreateBrandForm
            credential={credential}
            onSuccess={() => setShowCreateBrand(false)}
            onCancel={() => setShowCreateBrand(false)}
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
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/v1/tenants/me', credential).then((data) => {
      setTenant(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [credential]);

  if (loading) return <p>Loading…</p>;
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
  const [keys, setKeys] = useState<TenantApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyPlaintext, setNewKeyPlaintext] = useState<string | null>(null);
  const [error, setError] = useState('');

  const tenantId = typeof window !== 'undefined'
    ? JSON.parse(window.localStorage.getItem('nid_dashboard_tenant') || '{}').id
    : '';

  useEffect(() => {
    if (!tenantId) return;
    listApiKeys(credential, tenantId).then((data) => {
      setKeys(data);
      setLoading(false);
    }).catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, [credential, tenantId]);

  async function handleCreateKey() {
    if (!tenantId) return;
    setError('');
    try {
      const result = await createApiKey(credential, tenantId);
      setNewKeyPlaintext(result.plaintext);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create API key');
    }
  }

  async function handleRevoke(id: string) {
    if (!tenantId) return;
    try {
      await revokeApiKey(credential, tenantId, id);
      setKeys(keys.filter((k) => k.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke key');
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h1>API Keys</h1>
        <button className="primary-btn" onClick={handleCreateKey}>
          + Create API Key
        </button>
      </div>

      {newKeyPlaintext && (
        <div className="alert alert-warning">
          <strong>New API key created!</strong> Save this key now — it cannot be recovered:
          <pre className="key-display">{newKeyPlaintext}</pre>
          <button onClick={() => setNewKeyPlaintext(null)}>Dismiss</button>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      <table className="data-table">
        <thead>
          <tr>
            <th>Prefix</th>
            <th>Scopes</th>
            <th>Rate Limit</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key.id}>
              <td>{key.keyPrefix}</td>
              <td>{key.scopes.join(', ')}</td>
              <td>{key.rateLimitPerMinute}/min</td>
              <td>{key.revokedAt ? 'Revoked' : 'Active'}</td>
              <td>{new Date(key.createdAt).toLocaleDateString()}</td>
              <td>
                {!key.revokedAt && (
                  <button className="danger-btn" onClick={() => handleRevoke(key.id)}>
                    Revoke
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StaffTab({ credential }: { credential: string }) {
  const [staff, setStaff] = useState<TenantStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState('');
  const [role, setRole] = useState<'STAFF' | 'ADMIN'>('STAFF');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const tenantId = typeof window !== 'undefined'
    ? JSON.parse(window.localStorage.getItem('nid_dashboard_tenant') || '{}').id
    : '';

  useEffect(() => {
    if (!tenantId) return;
    listStaff(credential, tenantId).then((data) => {
      setStaff(data);
      setLoading(false);
    }).catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, [credential, tenantId]);

  async function handleInvite() {
    if (!tenantId || !accountId.trim()) return;
    setError('');
    setSuccess('');
    try {
      await inviteStaff(credential, tenantId, accountId.trim(), role);
      setSuccess('Staff member invited successfully.');
      setAccountId('');
      setStaff(await listStaff(credential, tenantId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to invite staff');
    }
  }

  async function handleRemove(accountId: string) {
    if (!tenantId) return;
    try {
      await removeStaff(credential, tenantId, accountId);
      setStaff(staff.filter((s) => s.accountId !== accountId));
      setSuccess('Staff member removed.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove staff');
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div className="tab-content">
      <h1>Staff Members</h1>

      <div className="invite-form">
        <h3>Invite Staff</h3>
        <input
          type="text"
          placeholder="Account ID"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        />
        <select value={role} onChange={(e) => setRole(e.target.value as 'STAFF' | 'ADMIN')}>
          <option value="STAFF">Staff</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button className="primary-btn" onClick={handleInvite}>
          Invite
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <table className="data-table">
        <thead>
          <tr>
            <th>Account ID</th>
            <th>Role</th>
            <th>Phone</th>
            <th>Verified</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => (
            <tr key={member.id}>
              <td>{member.accountId.slice(0, 12)}…</td>
              <td>{member.role}</td>
              <td>{member.phone ?? 'N/A'}</td>
              <td>{member.phoneVerified ? 'Yes' : 'No'}</td>
              <td>
                <button className="danger-btn" onClick={() => handleRemove(member.accountId)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingsTab({ credential }: { credential: string }) {
  const [tenant, setTenant] = useState(null);
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
    apiFetch('/v1/tenants/me', credential).then((data) => {
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

  if (loading) return <p>Loading…</p>;

  return (
    <div className="tab-content">
      <h1>Tenant Settings</h1>

      <div className="settings-form">
        <div className="form-group">
          <label>Tenant Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Brand"
          />
        </div>

        <div className="form-group">
          <label>Webhook URL</label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-app.com/webhooks/nid"
          />
          <small>URL for receiving real-time tenant events (used by Communicator sync)</small>
        </div>

        <div className="form-group">
          <label>Platform Admin Secret</label>
          <input
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
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listOrganizations(credential).then((data) => {
      setOrganizations(data);
      setLoading(false);
    }).catch((err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to load organizations');
      setLoading(false);
    });
  }, [credential]);

  if (loading) return <p>Loading…</p>;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h1>Organizations</h1>
        <button className="primary-btn" onClick={onCreateNew}>
          + Create Organization
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {organizations.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', border: '1px dashed var(--border)', borderRadius: 8 }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>No organizations yet</p>
          <p style={{ fontSize: 13 }}>
            Create an organization to manage employees, verification, and brand profiles.
          </p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Legal Name</th>
              <th>Registration #</th>
              <th>Country</th>
              <th>Verified</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((org) => (
              <tr key={org.id}>
                <td>{org.legalName}</td>
                <td>{org.registrationNumber ?? '—'}</td>
                <td>{org.countryCode ?? '—'}</td>
                <td>
                  {org.isVerified ? (
                    <span style={{ color: '#10b981', fontWeight: 500 }}>✓ {org.verifiedLevel ?? 'Verified'}</span>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>Not verified</span>
                  )}
                </td>
                <td>{new Date(org.createdAt).toLocaleDateString()}</td>
                <td>
                  <button className="primary-btn" onClick={() => {
                    if (onSelectOrg) {
                      onSelectOrg(org.id);
                    } else {
                      window.location.hash = `#org-${org.id}`;
                    }
                  }}>
                    Manage Brands
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
        <div className="form-group">
          <label>Legal Name *</label>
          <input
            type="text"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="Acme Corporation Ltd."
            required
          />
        </div>

        <div className="form-group">
          <label>Registration Number</label>
          <input
            type="text"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            placeholder="Company registration number"
          />
          <small>Business registration or tax ID number (optional but recommended for verification)</small>
        </div>

        <div className="form-group">
          <label>Country Code</label>
          <input
            type="text"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
            placeholder="US"
            maxLength={2}
          />
          <small>ISO 3166-1 alpha-2 country code (e.g., US, GB, DE)</small>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? 'Creating…' : 'Create Organization'}
        </button>
      </form>
    </div>
  );
}

function OrganizationDetailPanel({
  credential,
  organizationId,
  onBack,
}: {
  credential: string;
  organizationId: string;
  onBack: () => void;
}) {
  const [org, setOrg] = useState<OrganizationRecord | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    Promise.all([
      getOrganization(credential, organizationId),
      listMembers(credential, organizationId),
    ]).then(([orgData, membersData]) => {
      setOrg(orgData);
      setMembers(membersData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [credential, organizationId]);

  async function handleInvite() {
    if (!invitePhone.trim()) return;
    setInviteLoading(true);
    setError('');
    setSuccess('');
    try {
      await inviteEmployee(credential, organizationId, {
        phone: invitePhone.trim(),
        role: inviteRole,
        isAdmin: false,
      });
      setSuccess('Invitation sent successfully.');
      setInvitePhone('');
      setMembers(await listMembers(credential, organizationId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  }

  if (loading) return <p>Loading…</p>;
  if (!org) return <p>Organization not found.</p>;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <div>
          <button onClick={onBack} style={{ marginBottom: 8 }}>← Back to Organizations</button>
          <h1>{org.legalName}</h1>
        </div>
      </div>

      <div className="info-card" style={{ marginBottom: '2rem' }}>
        <div className="info-row">
          <span className="label">Legal Name</span>
          <span className="value">{org.legalName}</span>
        </div>
        <div className="info-row">
          <span className="label">Registration #</span>
          <span className="value">{org.registrationNumber ?? 'Not set'}</span>
        </div>
        <div className="info-row">
          <span className="label">Country</span>
          <span className="value">{org.countryCode ?? 'Not set'}</span>
        </div>
        <div className="info-row">
          <span className="label">Verified</span>
          <span className="value">
            {org.isVerified ? `✓ ${org.verifiedLevel ?? 'Verified'}` : 'Not verified'}
          </span>
        </div>
        <div className="info-row">
          <span className="label">Created</span>
          <span className="value">{new Date(org.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <h2>Invite Employee</h2>
      <div className="invite-form">
        <input
          type="tel"
          placeholder="Phone number"
          value={invitePhone}
          onChange={(e) => setInvitePhone(e.target.value)}
        />
        <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
          <option value="employee">Employee</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
        <button className="primary-btn" onClick={handleInvite} disabled={inviteLoading}>
          {inviteLoading ? 'Sending…' : 'Invite'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <h2 style={{ marginTop: '2rem' }}>Members ({members.length})</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Role</th>
            <th>Admin</th>
            <th>Status</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td>{m.role}</td>
              <td>{m.isAdmin ? 'Yes' : 'No'}</td>
              <td>
                <span style={{
                  color: m.status === 'ACTIVE' ? '#10b981' : m.status === 'PENDING' ? '#f59e0b' : '#6b7280',
                  fontWeight: 500,
                }}>
                  {m.status}
                </span>
              </td>
              <td>{new Date(m.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const [result, setResult] = useState(null);

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
          <p className="warning">Save the webhook secrets — they cannot be recovered.</p>
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
        <div className="form-group">
          <label>Tenant Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Brand"
            required
          />
        </div>

        <div className="form-group">
          <label>Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="my-brand"
            required
            pattern="[a-z0-9][a-z0-9-]{2,63}"
          />
          <small>3-64 lowercase alphanumeric characters or hyphens</small>
        </div>

        <div className="form-group">
          <label>Data Residency Region</label>
          <input
            type="text"
            defaultValue="global"
            placeholder="global"
          />
        </div>

        <div className="form-group">
          <label>Webhook URL (optional)</label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://communicator.example.com/webhooks/nid"
          />
          <small>URL for real-time sync to Communicator</small>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? 'Creating…' : 'Create Tenant'}
        </button>
      </form>
    </div>
  );
}

function LoginScreen({
  onLogin,
  onPlatformAdminLogin,
  error,
  loading,
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
              inputMode="tel"
              placeholder="+1 555 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={submitting}
              autoFocus
            />
            {stepError && <p className="error-text">{stepError}</p>}
            <button className="primary-block" type="submit" disabled={submitting || phone.trim().length === 0}>
              {submitting ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <OtpInput value={code} onChange={setCode} disabled={submitting} autoFocus />
            {stepError && <p className="error-text">{stepError}</p>}
            {error && <p className="error-text">{error}</p>}
            <button
              className="primary-block"
              type="submit"
              disabled={submitting || loading || code.length < 6}
            >
              {submitting || loading ? 'Verifying…' : 'Verify code'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setStep('phone');
                setCode('');
                setStepError(null);
              }}
              disabled={submitting}
            >
              Use a different number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ---- Invitations Tab ----

function InvitationsTab({ credential }: { credential: string }) {
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

  if (error) return <p className="error-text">{error}</p>;
  if (!cases) return <p className="lead">Loading cases…</p>;
  if (cases.length === 0) {
    return (
      <div className="empty-state">
        No verification cases yet. Create one with <code>POST /v1/verification-cases</code>.
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

  return (
    <table>
      <thead>
        <tr>
          <th>Subject</th>
          <th>Claim</th>
          <th>Status</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {cases.map((c) => (
          <tr key={c.id}>
            <td>
              <Link href={`/cases/${c.id}`}>{subjectName(c.subject)}</Link>
            </td>
            <td>{c.claimType}</td>
            <td>
              <span className={`badge ${c.status}`}>{c.status}</span>
            </td>
            <td>{new Date(c.createdAt).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
