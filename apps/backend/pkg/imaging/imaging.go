// Package imaging performs on-the-fly image transforms — resize plus re-encode
// to a requested format and quality. Two backends are selected at build time:
//
//   - default build: a pure-Go transformer (image/jpeg, image/png and
//     golang.org/x/image scaling). It resizes and encodes JPEG/PNG with no
//     system dependencies, so it always compiles and is used in dev and CI.
//     AVIF/WebP output requests transparently fall back to JPEG.
//   - `-tags vips`: a libvips (bimg) transformer with full AVIF/WebP/JPEG/PNG
//     output. It needs libvips at build and run time, which the production
//     Docker image installs.
//
// Callers build options with the package constants and never branch on the
// backend; New() returns whichever was compiled in.
package imaging

import "fmt"

// Format is an output (or detected input) encoding.
type Format string

const (
	FormatAVIF Format = "avif"
	FormatWebP Format = "webp"
	FormatJPEG Format = "jpeg"
	FormatPNG  Format = "png"
)

// Fit controls how an image is mapped into a target box.
type Fit string

const (
	FitCover   Fit = "cover"   // fill the box, cropping overflow
	FitContain Fit = "contain" // fit inside the box, letterboxing as needed
	FitInside  Fit = "inside"  // fit inside the box, never upscaling (default)
)

// Options describes a single transform. A zero Width or Height means "keep the
// source size on that axis"; a zero Quality means the backend default.
type Options struct {
	Format  Format
	Quality int
	Width   int
	Height  int
	Fit     Fit
}

// Transformer decodes source bytes and re-encodes them per Options.
type Transformer interface {
	// Transform returns the encoded bytes and their MIME content type. When the
	// backend cannot encode the requested format it falls back to JPEG and
	// reports the JPEG content type, so the response is always self-describing.
	Transform(src []byte, opts Options) (out []byte, contentType string, err error)
	// Probe returns the pixel dimensions and detected format of src without a
	// full decode where possible.
	Probe(src []byte) (width, height int, format string, err error)
	// CanEncode reports whether this backend can produce f natively.
	CanEncode(f Format) bool
}

// ParseFormat validates and normalises a format string ("jpg" → jpeg).
func ParseFormat(s string) (Format, error) {
	switch Format(s) {
	case FormatAVIF, FormatWebP, FormatJPEG, FormatPNG:
		return Format(s), nil
	case "jpg":
		return FormatJPEG, nil
	}
	return "", fmt.Errorf("imaging: unsupported format %q", s)
}

// ParseFit normalises a fit string, defaulting to FitInside when empty.
func ParseFit(s string) (Fit, error) {
	switch Fit(s) {
	case "":
		return FitInside, nil
	case FitCover, FitContain, FitInside:
		return Fit(s), nil
	}
	return "", fmt.Errorf("imaging: unsupported fit %q", s)
}

// ContentType returns the MIME type for an output format.
func (f Format) ContentType() string {
	switch f {
	case FormatAVIF:
		return "image/avif"
	case FormatWebP:
		return "image/webp"
	case FormatPNG:
		return "image/png"
	default:
		return "image/jpeg"
	}
}

// computeResize returns the destination canvas size and the source rectangle to
// sample from, honouring Fit. It is backend-agnostic so the stdlib transformer
// (and tests) can share the geometry with confidence. The source rectangle is
// expressed in 0-based coordinates; callers offset it by the image's Min.
func computeResize(srcW, srcH int, opts Options) (dstW, dstH int, sx0, sy0, sx1, sy1 int) {
	maxW, maxH := opts.Width, opts.Height
	if maxW <= 0 && maxH <= 0 {
		return srcW, srcH, 0, 0, srcW, srcH
	}

	switch opts.Fit {
	case FitCover:
		if maxW <= 0 {
			maxW = maxH
		}
		if maxH <= 0 {
			maxH = maxW
		}
		// Scale so the box is fully covered, then centre-crop the source.
		scale := float64(maxW) / float64(srcW)
		if s := float64(maxH) / float64(srcH); s > scale {
			scale = s
		}
		cropW := int(float64(maxW)/scale + 0.5)
		cropH := int(float64(maxH)/scale + 0.5)
		if cropW > srcW {
			cropW = srcW
		}
		if cropH > srcH {
			cropH = srcH
		}
		ox := (srcW - cropW) / 2
		oy := (srcH - cropH) / 2
		return maxW, maxH, ox, oy, ox + cropW, oy + cropH

	default: // inside / contain: fit within the box preserving aspect; never upscale.
		if maxW <= 0 {
			maxW = srcW
		}
		if maxH <= 0 {
			maxH = srcH
		}
		scale := float64(maxW) / float64(srcW)
		if s := float64(maxH) / float64(srcH); s < scale {
			scale = s
		}
		if scale > 1 {
			scale = 1
		}
		dw := int(float64(srcW)*scale + 0.5)
		dh := int(float64(srcH)*scale + 0.5)
		if dw < 1 {
			dw = 1
		}
		if dh < 1 {
			dh = 1
		}
		return dw, dh, 0, 0, srcW, srcH
	}
}
