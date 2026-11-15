fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().compile_protos(
        &["../../proto/nid/invitations/v1/invitations.proto"],
        &["../../proto"],
    )?;
    Ok(())
}
