fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().compile_protos(
        &["../../proto/nid/sessions/v1/sessions.proto"],
        &["../../proto"],
    )?;
    Ok(())
}
