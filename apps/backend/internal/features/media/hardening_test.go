package media

import (
	"bytes"
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/pkg/imaging"
	"go.uber.org/zap"
)

func TestMediaInspectUploadRequiresMatchingSignatureAndSafeDimensions(t *testing.T) {
	pngData := testPNG(t)
	tests := []struct {
		name   string
		data   []byte
		probe  hardeningTransformer
		config Config
		want   error
	}{
		{
			name: "declared decoder format disagrees with signature",
			data: pngData, probe: hardeningTransformer{width: 2, height: 2, format: "jpeg"},
			want: ErrUnsupportedImage,
		},
		{
			name: "unsupported gif signature",
			data: []byte("GIF89a"), probe: hardeningTransformer{width: 2, height: 2, format: "gif"},
			want: ErrUnsupportedImage,
		},
		{
			name: "source axis exceeds limit",
			data: pngData, probe: hardeningTransformer{width: 12001, height: 1, format: "png"},
			config: Config{MaxSourceDimension: 12000, MaxSourcePixels: 40_000_000},
			want:   ErrImageDimensionsTooLarge,
		},
		{
			name: "source pixel budget exceeded",
			data: pngData, probe: hardeningTransformer{width: 10000, height: 5000, format: "png"},
			config: Config{MaxSourceDimension: 12000, MaxSourcePixels: 40_000_000},
			want:   ErrImageDimensionsTooLarge,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			transformer := tt.probe
			service := NewService(
				nil, nil, nil, nil, nil, nil, &transformer, tt.config, zap.NewNop(),
			)
			if _, _, _, err := service.inspectUpload(tt.data); !errors.Is(err, tt.want) {
				t.Fatalf("inspectUpload error = %v; want %v", err, tt.want)
			}
		})
	}
}

func TestMediaTransformValidatesSourceAndCanonicalizesCacheLimits(t *testing.T) {
	ctx := context.Background()
	const key = "products/7-bottle/gallery-image.png"

	t.Run("unsafe source dimensions never reach decoder", func(t *testing.T) {
		store := newTestLocalStorage(t)
		if err := store.Put(ctx, key, bytes.NewReader(testPNG(t))); err != nil {
			t.Fatalf("seed source: %v", err)
		}
		transformer := &hardeningTransformer{width: 2, height: 2, format: "png"}
		service := NewService(
			store, newTestLocalStorage(t), &mediaImageRepositoryStub{},
			&productMediaRepositoryStub{}, &contentMediaRepositoryStub{}, nil,
			transformer,
			Config{MaxUploadBytes: 1 << 20, MaxSourceDimension: 1, MaxSourcePixels: 1},
			zap.NewNop(),
		)
		if _, _, err := service.Transform(ctx, key, imaging.Options{}); !errors.Is(err, ErrImageDimensionsTooLarge) {
			t.Fatalf("Transform error = %v; want ErrImageDimensionsTooLarge", err)
		}
		if transformer.transformCalls != 0 {
			t.Fatalf("transform calls = %d; want 0", transformer.transformCalls)
		}
	})

	t.Run("equivalent clamped requests share one cache entry", func(t *testing.T) {
		store := newTestLocalStorage(t)
		cache := newTestLocalStorage(t)
		if err := store.Put(ctx, key, bytes.NewReader(testPNG(t))); err != nil {
			t.Fatalf("seed source: %v", err)
		}
		transformer := &hardeningTransformer{width: 2, height: 2, format: "png"}
		service := NewService(
			store, cache, &mediaImageRepositoryStub{},
			&productMediaRepositoryStub{}, &contentMediaRepositoryStub{}, nil,
			transformer,
			Config{MaxUploadBytes: 1 << 20, DefaultQuality: 80, MaxDimension: 4000},
			zap.NewNop(),
		)

		first, _, err := service.Transform(ctx, key, imaging.Options{Width: 99999})
		if err != nil {
			t.Fatalf("first transform: %v", err)
		}
		second, _, err := service.Transform(ctx, key, imaging.Options{Width: 4000, Quality: 80})
		if err != nil {
			t.Fatalf("second transform: %v", err)
		}
		if !bytes.Equal(first, second) || transformer.transformCalls != 1 {
			t.Fatalf("cache result/calls = %q/%q, %d; want equal bytes and 1 call", first, second, transformer.transformCalls)
		}
		objects, err := cache.List(ctx, "")
		if err != nil || len(objects) != 1 {
			t.Fatalf("cache objects = %+v, %v; want one", objects, err)
		}
	})
}

type hardeningTransformer struct {
	width          int
	height         int
	format         string
	probeErr       error
	transformCalls int
}

func (t *hardeningTransformer) Probe([]byte) (int, int, string, error) {
	return t.width, t.height, t.format, t.probeErr
}

func (t *hardeningTransformer) Transform([]byte, imaging.Options) ([]byte, string, error) {
	t.transformCalls++
	return []byte("rendered"), "image/jpeg", nil
}

func (*hardeningTransformer) CanEncode(imaging.Format) bool { return true }
