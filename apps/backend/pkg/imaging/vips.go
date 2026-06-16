//go:build vips

package imaging

import (
	"fmt"

	"github.com/h2non/bimg"
)

// New returns the libvips-backed transformer. Built only with `-tags vips`,
// which requires libvips (with HEIF/AOM for AVIF) at build and run time.
func New() Transformer { return vipsTransformer{} }

type vipsTransformer struct{}

func (vipsTransformer) CanEncode(f Format) bool {
	switch f {
	case FormatAVIF, FormatWebP, FormatJPEG, FormatPNG:
		return true
	}
	return false
}

func (vipsTransformer) Probe(src []byte) (int, int, string, error) {
	meta, err := bimg.NewImage(src).Metadata()
	if err != nil {
		return 0, 0, "", fmt.Errorf("imaging: vips metadata: %w", err)
	}
	return meta.Size.Width, meta.Size.Height, meta.Type, nil
}

func (vipsTransformer) Transform(src []byte, opts Options) ([]byte, string, error) {
	o := bimg.Options{Quality: opts.Quality}

	switch opts.Format {
	case FormatAVIF:
		o.Type = bimg.AVIF
	case FormatWebP:
		o.Type = bimg.WEBP
	case FormatPNG:
		o.Type = bimg.PNG
	default:
		o.Type = bimg.JPEG
		opts.Format = FormatJPEG
	}

	if opts.Width > 0 {
		o.Width = opts.Width
	}
	if opts.Height > 0 {
		o.Height = opts.Height
	}

	switch opts.Fit {
	case FitCover:
		o.Crop = true
		o.Gravity = bimg.GravitySmart
	case FitContain:
		o.Embed = true
	default: // inside: fit within the box, never upscaling
		o.Enlarge = false
	}

	out, err := bimg.NewImage(src).Process(o)
	if err != nil {
		return nil, "", fmt.Errorf("imaging: vips process: %w", err)
	}
	return out, opts.Format.ContentType(), nil
}
