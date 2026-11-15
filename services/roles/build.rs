fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().compile_protos(
        &["../../proto/nid/roles/v1/roles.proto"],
        &["../../proto"],
    )?;
    Ok(())
}
