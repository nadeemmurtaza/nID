fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure()
        .compile_protos(
            &["../../proto/nid/verification_cases/v1/verification_cases.proto"],
            &["../../proto"],
        )?;
    Ok(())
}
