use wasm_bindgen::prelude::*;
use image::{
    imageops::FilterType,
    ImageEncoder,
};
use std::io::Cursor;

#[wasm_bindgen]
pub fn compress_image(
    bytes: &[u8],
    width: u32,
    height: u32,
    quality: u8,
) -> Vec<u8> {

    let img = image::load_from_memory(bytes)
        .expect("Unable to decode image");

    let resized = img.resize(
        width,
        height,
        FilterType::Lanczos3,
    );

    let mut output = Cursor::new(Vec::new());

    let encoder =
        image::codecs::jpeg::JpegEncoder::new_with_quality(
            &mut output,
            quality,
        );

    encoder
        .write_image(
            resized.as_bytes(),
            resized.width(),
            resized.height(),
            resized.color(),
        )
        .unwrap();

    output.into_inner()
}
