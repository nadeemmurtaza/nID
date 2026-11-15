const PROTOS: &[&str] = &[
    "../../proto/nid/access/v1/access.proto",
    "../../proto/nid/permissions/v1/permissions.proto",
    "../../proto/nid/tenant_staff/v1/tenant_staff.proto",
    "../../proto/nid/departments/v1/departments.proto",
    "../../proto/nid/account_verification/v1/account_verification.proto",
    "../../proto/nid/subjects/v1/subjects.proto",
    "../../proto/nid/invitations/v1/invitations.proto",
    "../../proto/nid/oauth/v1/oauth.proto",
    "../../proto/nid/accounts/v1/accounts.proto",
    "../../proto/nid/roles/v1/roles.proto",
    "../../proto/nid/booking/v1/booking.proto",
    "../../proto/nid/organization_profiles/v1/organization_profiles.proto",
    "../../proto/nid/verification_cases/v1/verification_cases.proto",
    "../../proto/nid/organizations/v1/organizations.proto",
    "../../proto/nid/tenants/v1/tenants.proto",
    "../../proto/nid/sessions/v1/sessions.proto",
    "../../proto/nid/profile_content/v1/profile_content.proto",
];

fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().build_server(false).compile_protos(PROTOS, &["../../proto"])?;
    Ok(())
}
