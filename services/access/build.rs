fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().compile_protos(
        &["../../proto/nid/access/v1/access.proto"],
        &["../../proto"],
    )?;
    Ok(())
}
