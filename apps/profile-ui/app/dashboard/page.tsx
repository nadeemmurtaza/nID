'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, getMyProfile, type OwnerProfile } from '../../lib/owner-api';
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

type Tab = 'profile' | 'services' | 'availability' | 'hours' | 'offers' | 'links' | 'images' | 'appointments' | 'messages';

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'services', label: 'Services' },
  { id: 'availability', label: 'Bookable hours' },
  { id: 'hours', label: 'Display hours' },
  { id: 'offers', label: 'Offers' },
  { id: 'links', label: 'Links' },
  { id: 'images', label: 'Photos' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'messages', label: 'Messages' },
];

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
            View page →
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
        {tab === 'services' && <ServicesManager token={token} />}
        {tab === 'availability' && <AvailabilityManager token={token} />}
        {tab === 'hours' && <HoursManager token={token} />}
        {tab === 'offers' && <OffersManager token={token} />}
        {tab === 'links' && <LinksManager token={token} />}
        {tab === 'images' && <ImagesManager token={token} slug={profile.slug} />}
        {tab === 'appointments' && <AppointmentsPanel token={token} />}
        {tab === 'messages' && <MessagesPanel token={token} />}
      </div>
    </main>
  );
}
