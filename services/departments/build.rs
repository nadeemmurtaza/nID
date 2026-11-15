fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().compile_protos(
        &["../../proto/nid/departments/v1/departments.proto"],
        &["../../proto"],
    )?;
    Ok(())
}
