'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightIcon } from 'lucide-animated';
import { getMe, getMyProfile, getMyTenantMemberships, getMyOrganizationMemberships, getMyBrandMemberships, type OwnerProfile, type TenantMembership, type OrganizationMembership, type BrandMembership } from '../../lib/owner-api';
import { clearStoredAccountSession, getStoredAccountSession } from '../../lib/session';
import { CreateProfileForm } from './components/CreateProfileForm';
import { ProfileEditor } from './components/ProfileEditor';
import { ServicesManager } from './components/ServicesManager';
import { AvailabilityManager } from './components/AvailabilityManager';
import { HoursManager } from './components/HoursManager';
import { OffersManager } from './components/OffersManager';
import { LinksManager } from './components/LinksManager';
import { ImagesManager } from './components/ImagesManager';
import { AppointmentsPanel } from './components/AppointmentsPanel';
import { MessagesPanel } from './components/MessagesPanel';
import { GrantsManager } from './components/GrantsManager';

type Tab =
  | 'profile'
  | 'work'
  | 'services'
  | 'availability'
  | 'hours'
  | 'offers'
  | 'links'
  | 'images'
  | 'appointments'
  | 'messages'
  | 'privacy';

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'work', label: 'Work' },
  { id: 'services', label: 'Services' },
  { id: 'availability', label: 'Bookable hours' },
  { id: 'hours', label: 'Display hours' },
  { id: 'offers', label: 'Offers' },
  { id: 'links', label: 'Links' },
  { id: 'images', label: 'Photos' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'messages', label: 'Messages' },
  { id: 'privacy', label: 'Private shares' },
];

/**
 * Work Profile panel: shows which tenants and organizations this
 * account is a member of. Tenants represent communication brands,
 * while organizations represent verified business entities within
 * those tenants.
 */
function WorkProfilePanel({ token }: { token: string }) {
  const [tenantMemberships, setTenantMemberships] = useState<TenantMembership[]>([]);
  const [orgMemberships, setOrgMemberships] = useState<OrganizationMembership[]>([]);
  const [brandMemberships, setBrandMemberships] = useState<BrandMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getMyTenantMemberships(token).catch(() => []),
      getMyOrganizationMemberships(token).catch(() => []),
      getMyBrandMemberships(token).catch(() => []),
    ]).then(([tenants, orgs, brands]) => {
      setTenantMemberships(tenants);
      setOrgMemberships(orgs);
      setBrandMemberships(brands);
      setLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load work profiles');
      setLoading(false);
    });
  }, [token]);

  if (loading) {
    return <div style={{ padding: 20, color: 'var(--muted)' }}>Loading work profiles…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <p style={{ color: 'var(--error)' }}>Error: {error}</p>
      </div>
    );
  }

  const hasAny = tenantMemberships.length > 0 || orgMemberships.length > 0 || brandMemberships.length > 0;

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
        Work Profiles
      </h2>
      <p style={{ color: 'var(--muted)', marginBottom: 20, fontSize: 14 }}>
        Tenants, organizations, and brands you are a member of. Tenants represent communication brands, organizations represent verified business entities, and brands are commercial product lines.
      </p>

      {!hasAny ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', border: '1px dashed var(--border)', borderRadius: 8 }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>No work profiles found</p>
          <p style={{ fontSize: 13 }}>
            You are not currently a member of any tenant or organization. Contact your platform admin to be added.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 24 }}>
          {/* Tenants Section */}
          {tenantMemberships.length > 0 && (
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--muted)' }}>
                Tenants ({tenantMemberships.length})
              </h3>
              <div style={{ display: 'grid', gap: 12 }}>
                {tenantMemberships.map((m) => (
                  <div
                    key={m.tenantId}
                    style={{
                      padding: 16,
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 15 }}>{m.tenantName}</p>
                      <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace' }}>
                        {m.tenantSlug}
                      </p>
                    </div>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 500,
                        backgroundColor: m.role === 'ADMIN' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                        color: m.role === 'ADMIN' ? '#10b981' : '#3b82f6',
                      }}
                    >
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Organizations Section */}
          {orgMemberships.length > 0 && (
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--muted)' }}>
                Organizations ({orgMemberships.length})
              </h3>
              <div style={{ display: 'grid', gap: 12 }}>
                {orgMemberships.map((m) => (
                  <div
                    key={m.organizationId}
                    style={{
                      padding: 16,
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 15 }}>{m.organizationName}</p>
                      <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {m.countryCode ? `${m.countryCode} · ` : ''}{m.role}
                      </p>
                    </div>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 500,
                        backgroundColor: m.isAdmin ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.1)',
                        color: m.isAdmin ? '#10b981' : '#8b5cf6',
                      }}
                    >
                      {m.isAdmin ? 'Admin' : m.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Brands Section */}
          {brandMemberships.length > 0 && (
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--muted)' }}>
                Brands ({brandMemberships.length})
              </h3>
              <div style={{ display: 'grid', gap: 12 }}>
                {brandMemberships.map((m) => (
                  <div
                    key={m.brandId}
                    style={{
                      padding: 16,
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 15 }}>{m.brandName}</p>
                      <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace' }}>
                        {m.brandSlug} · {m.organizationName}
                      </p>
                    </div>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 500,
                        backgroundColor: 'rgba(245,158,11,0.1)',
                        color: '#f59e0b',
                      }}
                    >
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<OwnerProfile | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('profile');

  useEffect(() => {
    const stored = getStoredAccountSession();
    if (!stored) {
      router.replace('/dashboard/login');
      return;
    }
    getMe(stored)
      .then(() => {
        setToken(stored);
        return getMyProfile(stored);
      })
      .then((p) => setProfile(p))
      .catch(() => {
        clearStoredAccountSession();
        router.replace('/dashboard/login');
      });
  }, [router]);

  if (!token || profile === undefined) {
    return (
      <main className="center-page">
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      </main>
    );
  }

  if (!profile) {
    return <CreateProfileForm token={token} onCreated={setProfile} />;
  }

  return (
    <main>
      <div className="top-bar">
        <span className="brand">nID Profiles</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a href={`/${profile.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
            View page <ArrowRightIcon size={16} className="nid-icon" />
          </a>
          <button
            type="button"
            className="small-btn"
            onClick={() => {
              clearStoredAccountSession();
              router.replace('/dashboard/login');
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`tab-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="tab-panel">
        {tab === 'profile' && <ProfileEditor token={token} profile={profile} onSaved={setProfile} />}
        {tab === 'work' && <WorkProfilePanel token={token} />}
        {tab === 'services' && <ServicesManager token={token} />}
        {tab === 'availability' && <AvailabilityManager token={token} />}
        {tab === 'hours' && <HoursManager token={token} />}
        {tab === 'offers' && <OffersManager token={token} />}
        {tab === 'links' && <LinksManager token={token} />}
        {tab === 'images' && <ImagesManager token={token} slug={profile.slug} />}
        {tab === 'appointments' && <AppointmentsPanel token={token} />}
        {tab === 'messages' && <MessagesPanel token={token} />}
        {tab === 'privacy' && <GrantsManager token={token} />}
      </div>
    </main>
  );
}
