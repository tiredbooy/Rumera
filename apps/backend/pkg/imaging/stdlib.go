//go:build !vips

package imaging

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif" // register GIF decoder
	"image/jpeg"
	"image/png"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp" // register WebP decoder (input only)
)

// New returns the pure-Go transformer. It is the default backend; build with
// `-tags vips` to get libvips/AVIF/WebP output instead.
func New() Transformer { return stdlibTransformer{} }

type stdlibTransformer struct{}

// CanEncode reports the formats this backend can emit. AVIF/WebP need libvips,
// so they are not encodable here and callers fall back to JPEG.
func (stdlibTransformer) CanEncode(f Format) bool {
	return f == FormatJPEG || f == FormatPNG
}

func (stdlibTransformer) Probe(src []byte) (int, int, string, error) {
	cfg, format, err := image.DecodeConfig(bytes.NewReader(src))
	if err != nil {
		return 0, 0, "", fmt.Errorf("imaging: decode config: %w", err)
	}
	return cfg.Width, cfg.Height, format, nil
}

func (t stdlibTransformer) Transform(src []byte, opts Options) ([]byte, string, error) {
	img, _, err := image.Decode(bytes.NewReader(src))
	if err != nil {
		return nil, "", fmt.Errorf("imaging: decode: %w", err)
	}

	img = t.resize(img, opts)

	out := opts.Format
	if !t.CanEncode(out) {
		out = FormatJPEG // AVIF/WebP unsupported without libvips → degrade to JPEG
	}

	var buf bytes.Buffer
	switch out {
	case FormatPNG:
		if err := (&png.Encoder{CompressionLevel: png.DefaultCompression}).Encode(&buf, img); err != nil {
			return nil, "", fmt.Errorf("imaging: png encode: %w", err)
		}
	default:
		q := opts.Quality
		if q <= 0 {
			q = 80
		}
		if q > 100 {
			q = 100
		}
		if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: q}); err != nil {
			return nil, "", fmt.Errorf("imaging: jpeg encode: %w", err)
		}
		out = FormatJPEG
	}
	return buf.Bytes(), out.ContentType(), nil
}

// resize scales img per opts using a high-quality Catmull-Rom kernel. It returns
// the original image untouched when no resize is requested.
func (stdlibTransformer) resize(img image.Image, opts Options) image.Image {
	b := img.Bounds()
	dw, dh, sx0, sy0, sx1, sy1 := computeResize(b.Dx(), b.Dy(), opts)
	if dw == b.Dx() && dh == b.Dy() && sx0 == 0 && sy0 == 0 && sx1 == b.Dx() && sy1 == b.Dy() {
		return img
	}
	srcRect := image.Rect(sx0, sy0, sx1, sy1).Add(b.Min)
	dst := image.NewRGBA(image.Rect(0, 0, dw, dh))
	draw.CatmullRom.Scale(dst, dst.Bounds(), img, srcRect, draw.Over, nil)
	return dst
}
