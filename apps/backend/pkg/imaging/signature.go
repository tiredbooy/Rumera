package imaging

import (
	"bytes"
	"encoding/binary"
	"errors"
)

var ErrUnsupportedSignature = errors.New("imaging: unsupported image signature")

var (
	jpegSignature = []byte{0xff, 0xd8, 0xff}
	pngSignature  = []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}
)

// DetectFormat identifies supported input bytes from their container signature.
// It intentionally excludes GIF and generic HEIF even when a linked decoder can
// read them; the public upload contract is JPEG, PNG, WebP, or AVIF.
func DetectFormat(src []byte) (Format, error) {
	switch {
	case bytes.HasPrefix(src, jpegSignature):
		return FormatJPEG, nil
	case bytes.HasPrefix(src, pngSignature):
		return FormatPNG, nil
	case len(src) >= 12 && string(src[:4]) == "RIFF" && string(src[8:12]) == "WEBP":
		return FormatWebP, nil
	case hasAVIFBrand(src):
		return FormatAVIF, nil
	default:
		return "", ErrUnsupportedSignature
	}
}

func hasAVIFBrand(src []byte) bool {
	if len(src) < 16 || string(src[4:8]) != "ftyp" {
		return false
	}

	boxSize := uint64(binary.BigEndian.Uint32(src[:4]))
	brandOffset := 8
	if boxSize == 1 {
		if len(src) < 24 {
			return false
		}
		boxSize = binary.BigEndian.Uint64(src[8:16])
		brandOffset = 16
	} else if boxSize == 0 {
		boxSize = uint64(len(src))
	}
	if boxSize > uint64(len(src)) || boxSize < uint64(brandOffset+8) {
		return false
	}

	end := int(boxSize)
	if isAVIFBrand(src[brandOffset : brandOffset+4]) {
		return true
	}
	for offset := brandOffset + 8; offset+4 <= end; offset += 4 {
		if isAVIFBrand(src[offset : offset+4]) {
			return true
		}
	}
	return false
}

func isAVIFBrand(brand []byte) bool {
	return bytes.Equal(brand, []byte("avif")) || bytes.Equal(brand, []byte("avis"))
}
