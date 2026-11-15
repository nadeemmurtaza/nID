fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().compile_protos(
        &["../../proto/nid/organizations/v1/organizations.proto"],
        &["../../proto"],
    )?;
    Ok(())
}
