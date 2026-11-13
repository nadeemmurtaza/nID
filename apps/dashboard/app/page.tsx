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
        <p className="lead">Checking for a saved session…</p>
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
        <DashboardLayout credential={state.credential} />
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
  const [brands, setBrands] = useState<BrandRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    listBrands(credential, selectedOrg)
      .then((data) => setBrands(data))
      .catch(() => setBrands([]));
  }, [credential, selectedOrg]);

  async function handleDeactivate(brandId: string, brandName: string) {
    if (!confirm(`Deactivate brand "${brandName}"? This cannot be easily undone.`)) return;
    try {
      await deactivateBrand(credential, brandId);
      setBrands((prev) => prev.filter((b) => b.id !== brandId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to deactivate brand');
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h1>Brands</h1>
        <button className="primary-btn" onClick={onCreateNew} disabled={!selectedOrg}>
          + Create Brand
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
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', border: '1px dashed var(--border)', borderRadius: 8 }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>No organizations found</p>
          <p style={{ fontSize: 13 }}>Create an organization first, then add brands under it.</p>
        </div>
      ) : brands.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', border: '1px dashed var(--border)', borderRadius: 8 }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>No brands yet</p>
          <p style={{ fontSize: 13 }}>
            Create a brand to manage its identity, products, AI config, and communication channels.
          </p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Description</th>
              <th>Website</th>
              <th>Active</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((brand) => (
              <tr key={brand.id}>
                <td style={{ fontWeight: 500 }}>{brand.name}</td>
                <td><code style={{ fontSize: 12 }}>{brand.slug}</code></td>
                <td>{brand.description ?? '—'}</td>
                <td>{brand.website ?? '—'}</td>
                <td>
                  <span style={{ color: brand.active ? '#10b981' : 'var(--muted)', fontWeight: 500 }}>
                    {brand.active ? '✓ Active' : 'Inactive'}
                  </span>
                </td>
                <td>{new Date(brand.createdAt).toLocaleDateString()}</td>
                <td>
                  <button
                    className="primary-btn"
                    style={{ backgroundColor: '#ef4444' }}
                    onClick={() => handleDeactivate(brand.id, brand.name)}
                  >
                    Deactivate
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

  if (loading) return <p>Loading…</p>;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h1>Create New Brand</h1>
        <button onClick={onCancel}>Cancel</button>
      </div>

      <form onSubmit={handleSubmit} className="create-tenant-form">
        <div className="form-group">
          <label>Organization *</label>
          <select
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

        <div className="form-group">
          <label>Brand Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Clothing Brand"
            required
          />
        </div>

        <div className="form-group">
          <label>Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="my-clothing-brand"
          />
          <small>URL-friendly identifier (auto-generated from name, editable)</small>
        </div>

        <div className="form-group">
          <label>Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Premium sustainable fashion"
          />
        </div>

        <div className="form-group">
          <label>Website</label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://mybrand.com"
          />
        </div>

        <div className="form-group">
          <label>Contact Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="hello@mybrand.com"
          />
        </div>

        <div className="form-group">
          <label>Contact Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1234567890"
          />
        </div>

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

  useEffect(() => {
    loadTenant();
  }, []);

  async function loadTenant() {
    try {
      const data = await apiFetch<any>('/v1/tenants/me', credential);
      setTenant(data);
      await loadGrants(data.id);
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
    if (!tenant) return;
    try {
      await revokeAccessGrant(credential, tenant.id, grantId);
      setSuccess('Access revoked');
      await loadGrants(tenant.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleTransfer(newOwnerId: string) {
    if (!tenant) return;
    try {
      await transferOwnership(credential, tenant.id, { newOwnerId });
      setSuccess('Ownership transferred');
      await loadGrants(tenant.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <p>Loading…</p>;
  if (!tenant) return <p>Failed to load tenant.</p>;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h1>Access Management</h1>
        <button className="primary-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Grant Access'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="create-tenant-form">
          <h3>Grant Access</h3>
          <div className="form-group">
            <label>Account ID *</label>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="ckx7z8a9b000001la2m3n4o5p"
              required
            />
            <small>The nID Account ID of the person to grant access to</small>
          </div>
          <div className="form-group">
            <label>Access Type *</label>
            <select value={accessType} onChange={(e) => setAccessType(e.target.value as any)}>
              <option value="MEMBER">Member — Basic access with role-defined permissions</option>
              <option value="ADMIN">Admin — Full access to entity and sub-entities</option>
              <option value="PARTNER">Partner — Percentage-based ownership share</option>
              <option value="OWNER">Owner — Full tenant access (except ownership transfer)</option>
            </select>
          </div>
          {accessType === 'PARTNER' && (
            <div className="form-group">
              <label>Partnership Percentage *</label>
              <input
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

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Type</th>
              <th>Partnership %</th>
              <th>Status</th>
              <th>Granted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {grants.map((grant) => (
              <tr key={grant.id}>
                <td>
                  <div className="account-cell">
                    <strong>{grant.accountPhone || grant.accountEmail || grant.accountId.slice(0, 8)}</strong>
                  </div>
                </td>
                <td><span className={`badge badge-${grant.accessType.toLowerCase()}`}>{grant.accessType}</span></td>
                <td>{grant.partnershipPercentage ? `${grant.partnershipPercentage}%` : '—'}</td>
                <td><span className={`badge badge-${grant.status.toLowerCase()}`}>{grant.status}</span></td>
                <td>{new Date(grant.createdAt).toLocaleDateString()}</td>
                <td>
                  <button
                    className="btn-danger"
                    onClick={() => handleRevoke(grant.id)}
                    disabled={grant.accessType === 'OWNER'}
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
            {grants.length === 0 && (
              <tr><td colSpan={6}>No access grants yet. Use "Grant Access" to add a member.</td></tr>
            )}
          </tbody>
        </table>
      </div>
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

  if (loading) return <p>Loading…</p>;
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
            <label>Department Name *</label>
            <input
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
          <div className="form-group">
            <label>Slug</label>
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="finance" />
            <small>URL-friendly identifier (auto-generated)</small>
          </div>
          <div className="form-group">
            <label>Icon</label>
            <input type="text" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="💰" />
          </div>
          <div className="form-group">
            <label>Color</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
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

  if (loading) return <p>Loading…</p>;
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
          <div className="form-group">
            <label>Role Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Finance Manager" required />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Manages all finance-related operations" rows={2} />
          </div>

          <div className="form-group">
            <label>Permissions ({selectedPerms.length} selected)</label>
            <div className="permission-tree">
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
    if (!tenant) return;
    try {
      await revokeInvitation(credential, tenant.id, invitationId);
      setSuccess('Invitation revoked');
      await loadInvitations(tenant.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <p>Loading…</p>;
  if (!tenant) return <p>Failed to load tenant.</p>;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h1>Invitations</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSend} className="create-tenant-form">
        <h3>Send Invitation</h3>
        <div className="form-group">
          <label>Invite Method</label>
          <div className="radio-group">
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
          <div className="form-group">
            <label>Email Address *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" required />
          </div>
        ) : (
          <div className="form-group">
            <label>Username *</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" required />
            <small>Share this form with the user, or have them provide their username</small>
          </div>
        )}
        <button type="submit" className="primary-btn" disabled={sending || (inviteType === 'email' ? !email.trim() : !username.trim())}>
          {sending ? 'Sending…' : 'Send Invitation'}
        </button>
      </form>

      <div className="data-table">
        <h3>Pending Invitations</h3>
        <table>
          <thead>
            <tr>
              <th>Email / Username</th>
              <th>Scope</th>
              <th>Status</th>
              <th>Expires</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invitations.filter(inv => inv.status === 'PENDING').map(inv => (
              <tr key={inv.id}>
                <td>{inv.email || inv.username || '—'}</td>
                <td><span className="badge badge-info">{inv.scope}</span></td>
                <td><span className="badge badge-pending">{inv.status}</span></td>
                <td>{new Date(inv.expiresAt).toLocaleDateString()}</td>
                <td>
                  <button className="btn-danger" onClick={() => handleRevoke(inv.id)}>Revoke</button>
                </td>
              </tr>
            ))}
            {invitations.filter(inv => inv.status === 'PENDING').length === 0 && (
              <tr><td colSpan={5}>No pending invitations.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
