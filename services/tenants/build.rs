fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().compile_protos(
        &["../../proto/nid/tenants/v1/tenants.proto"],
        &["../../proto"],
    )?;
    Ok(())
}
