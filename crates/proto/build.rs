const PROTOS: &[&str] = &[
    "../../proto/nid/permissions/v1/permissions.proto",
    "../../proto/nid/tenant_staff/v1/tenant_staff.proto",
    "../../proto/nid/departments/v1/departments.proto",
    "../../proto/nid/account_verification/v1/account_verification.proto",
    "../../proto/nid/subjects/v1/subjects.proto",
];

fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().build_server(false).compile_protos(PROTOS, &["../../proto"])?;
    Ok(())
}
