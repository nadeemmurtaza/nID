import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiUrl, getPublicProfileBundle } from '../../lib/api';
import { BookingWidget } from '../components/BookingWidget';
import { ContactForm } from '../components/ContactForm';
import { badgeLabel, formatPrice, mapUrl, minuteOfDayLabel, sortByWeekday, waLink, weekdayLabel } from './format';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await getPublicProfileBundle(slug);
  if (!bundle) {
    return { title: 'Profile not found' };
  }
  return {
    title: bundle.profile.displayName,
    description: bundle.profile.headline ?? bundle.profile.bio ?? undefined,
  };
}

export default async function ProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const bundle = await getPublicProfileBundle(slug);
  if (!bundle) {
    notFound();
  }
  const { profile, services, offers, businessHours, links, images } = bundle;

  const initials = profile.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  const map = mapUrl(profile);
  const banner = images.find((img) => img.kind === 'BANNER');
  const gallery = images.filter((img) => img.kind === 'GALLERY');
  const hasLinks = links.customLinks.length > 0 || links.socialLinks.length > 0;

  return (
    <main className="page">
      {banner && (
        <img className="banner-img" src={apiUrl(`/v1/profiles/${slug}/images/${banner.id}`)} alt="" />
      )}

      <div className="hero">
        <div className="photo-wrap">
          {profile.photoKey ? (
            <img className="hero-photo" src={apiUrl(`/v1/profiles/${slug}/photo`)} alt={profile.displayName} />
          ) : (
            <div className="hero-photo-fallback">{initials || '?'}</div>
          )}
          {/* No mechanism in this system ties an uploaded profile photo to
              any verified identity evidence — always shown as unverified,
              never implied otherwise. */}
          <span className="verify-tag unverified" title="This photo has not been independently verified">
            ○ Unverified photo
          </span>
        </div>

        <div className="name-row">
          <h1>{profile.displayName}</h1>
          {profile.realName && profile.realName !== profile.displayName ? (
            <span className="verify-tag verified" title={`Independently verified as ${profile.realName}`}>
              ✓ Verified name
            </span>
          ) : (
            <span className="verify-tag unverified" title="This name is self-reported and has not been independently verified">
              ○ Unverified name
            </span>
          )}
        </div>
        {profile.realName && profile.realName !== profile.displayName && (
          <p className="real-name">Verified as {profile.realName}</p>
        )}
        {profile.headline && <p className="headline">{profile.headline}</p>}
        <span className="category-chip">{profile.category}</span>

        {profile.badges && profile.badges.length > 0 && (
          <div className="badges-row">
            {profile.badges.map((badge) => (
              <span className="badge-chip" key={badge.claimType}>
                ✓ {badgeLabel(badge.claimType, badge.level)}
              </span>
            ))}
          </div>
        )}

        {profile.bio && <p className="bio">{profile.bio}</p>}
      </div>

      <div className="actions-row">
        {profile.phone && (
          <div className="action-item">
            <a className="action-btn primary" href={`tel:${profile.phone}`}>
              Call
            </a>
            {profile.phoneVerified ? (
              <span className="verify-tag verified" title="This number matches the phone the owner verified with an OTP code">
                ✓ Verified
              </span>
            ) : (
              <span className="verify-tag unverified" title="This number is self-reported and has not been independently verified">
                ○ Unverified
              </span>
            )}
          </div>
        )}
        {profile.whatsapp && (
          <div className="action-item">
            <a className="action-btn whatsapp" href={waLink(profile.whatsapp)} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
            {profile.whatsappVerified ? (
              <span className="verify-tag verified" title="This number matches the phone the owner verified with an OTP code">
                ✓ Verified
              </span>
            ) : (
              <span className="verify-tag unverified" title="This number is self-reported and has not been independently verified">
                ○ Unverified
              </span>
            )}
          </div>
        )}
        {profile.publicEmail && (
          <div className="action-item">
            <a className="action-btn" href={`mailto:${profile.publicEmail}`}>
              Email
            </a>
            {/* No email verification exists anywhere in this system (no
                confirm-email flow) — always unverified, never implied
                otherwise. */}
            <span className="verify-tag unverified" title="This email address has not been independently verified">
              ○ Unverified
            </span>
          </div>
        )}
        {map && (
          <a className="action-btn" href={map} target="_blank" rel="noreferrer">
            Directions
          </a>
        )}
      </div>

      {offers.length > 0 && (
        <section className="section">
          <h2>Offers</h2>
          {offers.map((offer) => (
            <div className="section-card" key={offer.id}>
              <h3>{offer.title}</h3>
              {offer.description && <p>{offer.description}</p>}
              {offer.validUntil && (
                <div className="meta-row">
                  <span>Valid until {new Date(offer.validUntil).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {businessHours.length > 0 && (
        <section className="section">
          <h2>Hours</h2>
          <div className="hours-table">
            {sortByWeekday(businessHours).map((hour) => (
              <div className="hours-row" key={hour.day}>
                <span className="day">{weekdayLabel(hour.day)}</span>
                {hour.isClosed || hour.openMinute === null || hour.closeMinute === null ? (
                  <span className="closed">Closed</span>
                ) : (
                  <span>
                    {minuteOfDayLabel(hour.openMinute)} – {minuteOfDayLabel(hour.closeMinute)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {(profile.addressLine1 || profile.city) && (
        <section className="section">
          <h2>Address</h2>
          <div className="section-card">
            <p>
              {[profile.addressLine1, profile.addressLine2, profile.city, profile.region, profile.countryCode]
                .filter(Boolean)
                .join(', ')}
            </p>
          </div>
        </section>
      )}

      {profile.showBooking && services.length > 0 && (
        <section className="section">
          <h2>Book an appointment</h2>
          <div className="section-card">
            <BookingWidget slug={slug} services={services} />
          </div>
          <div style={{ marginTop: 6 }}>
            {services.map((s) => {
              const price = formatPrice(s.price, s.currency);
              return (
                <div className="meta-row" key={s.id}>
                  <span>{s.name}</span>
                  <span>
                    {s.durationMinutes} min{price ? ` · ${price}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {gallery.length > 0 && (
        <section className="section">
          <h2>Gallery</h2>
          <div className="gallery-grid">
            {gallery.map((img) => (
              <img key={img.id} src={apiUrl(`/v1/profiles/${slug}/images/${img.id}`)} alt="" />
            ))}
          </div>
        </section>
      )}

      {hasLinks && (
        <section className="section">
          <h2>Links</h2>
          <div className="links-grid">
            {links.customLinks.map((link) => (
              <a className="link-btn" key={link.id} href={link.url} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
            {links.socialLinks.map((link) => (
              <a className="link-btn" key={link.id} href={link.url} target="_blank" rel="noreferrer">
                {link.platform}
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <h2>Contact</h2>
        <div className="section-card">
          <ContactForm slug={slug} />
        </div>
      </section>

      <p className="footer-brand">Powered by nID</p>
    </main>
  );
}
