package media

import (
	"testing"

	"github.com/tiredbooy/pkg/imaging"
)

func testMediaService() *Service {
	return &Service{
		tr:  imaging.New(),
		cfg: Config{DefaultQuality: 80, MaxDimension: 4000},
	}
}

func TestMediaNormalize(t *testing.T) {
	s := testMediaService()

	got := s.normalize(imaging.Options{})
	if got.Format != imaging.FormatJPEG || got.Quality != 80 || got.Fit != imaging.FitInside {
		t.Fatalf("defaults not applied: %+v", got)
	}

	got = s.normalize(imaging.Options{Quality: 250, Width: 99999, Height: -5})
	if got.Quality != 100 {
		t.Fatalf("quality clamp = %d; want 100", got.Quality)
	}
	if got.Width != 4000 {
		t.Fatalf("width clamp = %d; want 4000", got.Width)
	}
	if got.Height != 0 {
		t.Fatalf("negative height = %d; want 0", got.Height)
	}
}

func TestMediaCacheKey(t *testing.T) {
	s := testMediaService()
	o := imaging.Options{Format: imaging.FormatWebP, Quality: 70, Width: 600, Fit: imaging.FitInside}

	k1 := s.cacheKey("products/a.jpg", o, imaging.FormatWebP)
	k2 := s.cacheKey("products/a.jpg", o, imaging.FormatWebP)
	if k1 != k2 {
		t.Fatalf("cache key not deterministic: %q vs %q", k1, k2)
	}

	// A different quality must produce a different key.
	o2 := o
	o2.Quality = 71
	if s.cacheKey("products/a.jpg", o2, imaging.FormatWebP) == k1 {
		t.Fatalf("cache key collided across differing quality")
	}
	// A different source key must produce a different key.
	if s.cacheKey("products/b.jpg", o, imaging.FormatWebP) == k1 {
		t.Fatalf("cache key collided across differing source")
	}
	// The cache extension must track the effective output format.
	if got := s.cacheKey("products/a.jpg", o, imaging.FormatWebP); got[len(got)-5:] != ".webp" {
		t.Fatalf("cache key ext = %q; want .webp", got[len(got)-5:])
	}
}
