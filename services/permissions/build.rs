fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().compile_protos(
        &["../../proto/nid/permissions/v1/permissions.proto"],
        &["../../proto"],
    )?;
    Ok(())
}
