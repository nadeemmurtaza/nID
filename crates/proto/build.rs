const PROTOS: &[&str] = &["../../proto/nid/permissions/v1/permissions.proto"];

fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().build_server(false).compile_protos(PROTOS, &["../../proto"])?;
    Ok(())
}
