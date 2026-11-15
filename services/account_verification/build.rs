fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().compile_protos(
        &["../../proto/nid/account_verification/v1/account_verification.proto"],
        &["../../proto"],
    )?;
    Ok(())
}
