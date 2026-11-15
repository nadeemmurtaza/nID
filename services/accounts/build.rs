fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().compile_protos(
        &["../../proto/nid/accounts/v1/accounts.proto"],
        &["../../proto"],
    )?;
    Ok(())
}
