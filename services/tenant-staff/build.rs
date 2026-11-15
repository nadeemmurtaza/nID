fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().compile_protos(
        &["../../proto/nid/tenant_staff/v1/tenant_staff.proto"],
        &["../../proto"],
    )?;
    Ok(())
}
