fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().compile_protos(
        &["../../proto/nid/subjects/v1/subjects.proto"],
        &["../../proto"],
    )?;
    Ok(())
}
