fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure()
        .compile_protos(
            &["../../proto/nid/organization_profiles/v1/organization_profiles.proto"],
            &["../../proto"],
        )?;
    Ok(())
}
