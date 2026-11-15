fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().compile_protos(
        &["../../proto/nid/booking/v1/booking.proto"],
        &["../../proto"],
    )?;
    Ok(())
}
