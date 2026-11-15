fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().compile_protos(
        &["../../proto/nid/profile_content/v1/profile_content.proto"],
        &["../../proto"],
    )?;
    Ok(())
}
