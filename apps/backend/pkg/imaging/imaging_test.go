package imaging

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"testing"
)

func samplePNG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{uint8(x % 256), uint8(y % 256), 128, 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode sample: %v", err)
	}
	return buf.Bytes()
}

func TestParseFormatAndFit(t *testing.T) {
	if f, err := ParseFormat("jpg"); err != nil || f != FormatJPEG {
		t.Fatalf("ParseFormat(jpg) = %v, %v", f, err)
	}
	if _, err := ParseFormat("bmp"); err == nil {
		t.Fatalf("ParseFormat(bmp) should error")
	}
	if fit, err := ParseFit(""); err != nil || fit != FitInside {
		t.Fatalf("ParseFit(empty) = %v, %v; want inside", fit, err)
	}
	if FormatAVIF.ContentType() != "image/avif" || FormatWebP.ContentType() != "image/webp" {
		t.Fatalf("unexpected content types")
	}
}

func TestComputeResize(t *testing.T) {
	// inside: fit within box, preserve aspect, no upscale.
	dw, dh, _, _, _, _ := computeResize(1000, 500, Options{Width: 400, Fit: FitInside})
	if dw != 400 || dh != 200 {
		t.Fatalf("inside w-only = %dx%d; want 400x200", dw, dh)
	}
	// inside must not upscale beyond the source.
	dw, dh, _, _, _, _ = computeResize(100, 100, Options{Width: 500, Height: 500, Fit: FitInside})
	if dw != 100 || dh != 100 {
		t.Fatalf("inside upscale = %dx%d; want 100x100 (no upscale)", dw, dh)
	}
	// cover: destination is exactly the box; source rect is a centred crop.
	dw, dh, sx0, sy0, sx1, sy1 := computeResize(1000, 500, Options{Width: 200, Height: 200, Fit: FitCover})
	if dw != 200 || dh != 200 {
		t.Fatalf("cover dst = %dx%d; want 200x200", dw, dh)
	}
	if (sx1-sx0) != 500 || (sy1-sy0) != 500 {
		t.Fatalf("cover crop = %dx%d; want 500x500 centred square", sx1-sx0, sy1-sy0)
	}
}

func TestStdlibTransform_ResizeAndProbe(t *testing.T) {
	tr := New()
	src := samplePNG(t, 800, 600)

	w, h, format, err := tr.Probe(src)
	if err != nil || w != 800 || h != 600 {
		t.Fatalf("probe = %d,%d,%q,%v; want 800,600,png,nil", w, h, format, err)
	}

	out, ct, err := tr.Transform(src, Options{Format: FormatJPEG, Quality: 70, Width: 400, Fit: FitInside})
	if err != nil {
		t.Fatalf("transform: %v", err)
	}
	if ct != "image/jpeg" {
		t.Fatalf("content type = %q; want image/jpeg", ct)
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(out))
	if err != nil {
		t.Fatalf("decode output: %v", err)
	}
	if cfg.Width != 400 || cfg.Height != 300 {
		t.Fatalf("output = %dx%d; want 400x300", cfg.Width, cfg.Height)
	}
}

func TestStdlibTransform_AVIFFallsBackToJPEG(t *testing.T) {
	tr := New()
	if tr.CanEncode(FormatAVIF) {
		t.Skip("vips backend can encode AVIF; fallback test is for the stdlib build")
	}
	out, ct, err := tr.Transform(samplePNG(t, 64, 64), Options{Format: FormatAVIF, Quality: 80})
	if err != nil {
		t.Fatalf("transform: %v", err)
	}
	if ct != "image/jpeg" {
		t.Fatalf("AVIF request without libvips should fall back to JPEG, got %q", ct)
	}
	if _, format, _ := image.DecodeConfig(bytes.NewReader(out)); format != "jpeg" {
		t.Fatalf("fallback output format = %q; want jpeg", format)
	}
}
