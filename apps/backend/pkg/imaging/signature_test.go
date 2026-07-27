package imaging

import (
	"encoding/binary"
	"errors"
	"testing"
)

func TestDetectFormat(t *testing.T) {
	avif := make([]byte, 24)
	binary.BigEndian.PutUint32(avif[:4], uint32(len(avif)))
	copy(avif[4:8], "ftyp")
	copy(avif[8:12], "mif1")
	copy(avif[16:20], "avif")

	tests := []struct {
		name string
		data []byte
		want Format
	}{
		{name: "jpeg", data: []byte{0xff, 0xd8, 0xff, 0xe0}, want: FormatJPEG},
		{name: "png", data: append([]byte{}, pngSignature...), want: FormatPNG},
		{name: "webp", data: []byte("RIFF\x04\x00\x00\x00WEBP"), want: FormatWebP},
		{name: "avif compatible brand", data: avif, want: FormatAVIF},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := DetectFormat(tt.data)
			if err != nil || got != tt.want {
				t.Fatalf("DetectFormat = %q, %v; want %q, nil", got, err, tt.want)
			}
		})
	}
}

func TestDetectFormatRejectsUnsupportedOrSpoofedSignatures(t *testing.T) {
	heif := make([]byte, 16)
	binary.BigEndian.PutUint32(heif[:4], uint32(len(heif)))
	copy(heif[4:8], "ftyp")
	copy(heif[8:12], "heic")

	for _, data := range [][]byte{
		[]byte("GIF89a"),
		heif,
		append([]byte("prefix"), pngSignature...),
		[]byte("not an image"),
		{},
	} {
		if _, err := DetectFormat(data); !errors.Is(err, ErrUnsupportedSignature) {
			t.Fatalf("DetectFormat(%q) error = %v; want ErrUnsupportedSignature", data, err)
		}
	}
}
