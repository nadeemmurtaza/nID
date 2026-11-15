const PROTOS: &[&str] = &[
    "../../proto/nid/permissions/v1/permissions.proto",
    "../../proto/nid/tenant_staff/v1/tenant_staff.proto",
    "../../proto/nid/departments/v1/departments.proto",
];

fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().build_server(false).compile_protos(PROTOS, &["../../proto"])?;
    Ok(())
}
