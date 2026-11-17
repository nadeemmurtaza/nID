'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@newax/design-tokens/Skeleton';
import {
  listMyTenantMemberships,
  listMyOrganizationMemberships,
  listMyBrandMemberships,
  type TenantMembership,
  type OrganizationMembershipSummary,
  type BrandMembership,
} from '../../lib/api-client';

interface BrandNode {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface OrgNode {
  id: string;
  name: string;
  role: string;
  isAdmin: boolean;
  brands: Map<string, BrandNode>;
}

interface TenantNode {
  id: string;
  name: string;
  slug: string | null;
  role: string | null;
  organizations: Map<string, OrgNode>;
}

/** nID is this ecosystem's single identity provider: tenantId/
 * organizationId/brandId below are the same ids every connected
 * project (Communicator, ERP, ...) will read once they consume this
 * data, not local copies -- see COMMUNICATION.md. This tab is read-only:
 * it shows the account's own place in that structure, assembled
 * client-side from three independent "my-memberships" endpoints
 * because there is no single combined one, and no endpoint is
 * authoritative over another -- a brand membership can name a tenant
 * the account never got a tenant_staff_membership row for. */
function buildTree(
  tenants: TenantMembership[],
  orgs: OrganizationMembershipSummary[],
  brands: BrandMembership[],
): TenantNode[] {
  const tenantMap = new Map<string, TenantNode>();

  function tenantNode(id: string, name: string, slug: string | null, role: string | null): TenantNode {
    let node = tenantMap.get(id);
    if (!node) {
      node = { id, name, slug, role, organizations: new Map() };
      tenantMap.set(id, node);
    }
    return node;
  }

  for (const t of tenants) {
    tenantNode(t.tenantId, t.tenantName, t.tenantSlug, t.role);
  }

  for (const o of orgs) {
    const tenant = tenantNode(o.tenantId, o.tenantId, null, null);
    if (!tenant.organizations.has(o.organizationId)) {
      tenant.organizations.set(o.organizationId, {
        id: o.organizationId,
        name: o.organizationName,
        role: o.role,
        isAdmin: o.isAdmin,
        brands: new Map(),
      });
    }
  }

  for (const b of brands) {
    const tenant = tenantNode(b.tenantId, b.tenantName, null, null);
    let org = tenant.organizations.get(b.organizationId);
    if (!org) {
      org = { id: b.organizationId, name: b.organizationName, role: '—', isAdmin: false, brands: new Map() };
      tenant.organizations.set(b.organizationId, org);
    }
    org.brands.set(b.brandId, { id: b.brandId, name: b.brandName, slug: b.brandSlug, role: b.role });
  }

  return Array.from(tenantMap.values());
}

export function HierarchyTab({ credential }: { credential: string }) {
  const [tree, setTree] = useState<TenantNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      listMyTenantMemberships(credential),
      listMyOrganizationMemberships(credential),
      listMyBrandMemberships(credential),
    ])
      .then(([tenants, orgs, brands]) => setTree(buildTree(tenants, orgs, brands)))
      .catch(() => setError('Could not load your tenant/organization/brand hierarchy.'));
  }, [credential]);

  if (error) return <p className="error-text">{error}</p>;
  if (!tree) return <div aria-busy="true" aria-label="Loading"><Skeleton count={4} /></div>;

  if (tree.length === 0) {
    return <p className="empty-state">You are not staff, a member, or a brand contact anywhere yet.</p>;
  }

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        Your place in the tenant → organization → brand structure. These ids are nID&apos;s own and are the same
        ids any connected project (Communicator, ERP, …) reads once it consumes this data — nID is the single
        source of truth for identity in this ecosystem.
      </p>
      {tree.map((tenant) => (
        <div key={tenant.id} className="panel-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong>{tenant.name}</strong>
            {tenant.role && <span className="badge APPROVED">{tenant.role}</span>}
          </div>
          <div style={{ marginBottom: 8, color: 'var(--muted)', fontSize: 12 }}>
            tenantId: <code>{tenant.id}</code>
          </div>

          {Array.from(tenant.organizations.values()).length === 0 ? (
            <p className="empty-state" style={{ marginLeft: 12 }}>
              No organizations here yet.
            </p>
          ) : (
            Array.from(tenant.organizations.values()).map((org) => (
              <div key={org.id} style={{ marginLeft: 16, marginTop: 8, borderLeft: '2px solid var(--border)', paddingLeft: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{org.name}</span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <span className="badge APPROVED">{org.role}</span>
                    {org.isAdmin && <span className="badge DOCUMENT_VERIFIED">admin</span>}
                  </span>
                </div>
                <div style={{ marginBottom: 6, color: 'var(--muted)', fontSize: 12 }}>
                  organizationId: <code>{org.id}</code>
                </div>

                {Array.from(org.brands.values()).length === 0 ? (
                  <p className="empty-state" style={{ marginLeft: 12, fontSize: 12 }}>
                    No brands here yet.
                  </p>
                ) : (
                  Array.from(org.brands.values()).map((brand) => (
                    <div
                      key={brand.id}
                      style={{
                        marginLeft: 16,
                        marginTop: 6,
                        borderLeft: '2px solid var(--border)',
                        paddingLeft: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>
                        {brand.name} <span style={{ color: 'var(--muted)', fontSize: 12 }}>({brand.slug})</span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="badge APPROVED">{brand.role}</span>
                        <code style={{ color: 'var(--muted)', fontSize: 12 }}>{brand.id}</code>
                      </span>
                    </div>
                  ))
                )}
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
