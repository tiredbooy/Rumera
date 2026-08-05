package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/storage"
	"go.uber.org/zap"
)

var ErrMediaReconciliationInProgress = errors.New("media reconciliation is already running")

type mediaLifecycleRepository interface {
	IsReferenced(ctx context.Context, key string) (bool, error)
	ReferencedKeys(ctx context.Context) ([]string, error)
	ProductKeys(ctx context.Context, productID int64) ([]string, error)
	VariantKeys(ctx context.Context, variantID int64) ([]string, error)
	LockMediaKeys(ctx context.Context, keys []string) (repositories.MediaKeyLock, error)
	TryReconciliationLock(ctx context.Context) (repositories.MediaReconciliationLock, bool, error)
}

// MediaLifecycleService safely removes detached local originals and every
// derivative derived from them. Database references are checked immediately
// before deletion so legacy/shared media remains intact.
type MediaLifecycleService struct {
	store storage.Storage
	cache storage.Storage
	repo  mediaLifecycleRepository
	log   *zap.Logger
}

func NewMediaLifecycleService(
	store storage.Storage,
	cache storage.Storage,
	repo mediaLifecycleRepository,
	log *zap.Logger,
) *MediaLifecycleService {
	if log == nil {
		log = zap.NewNop()
	}
	return &MediaLifecycleService{store: store, cache: cache, repo: repo, log: log}
}

// ProductKeys captures local images before a product cascade removes their rows.
func (s *MediaLifecycleService) ProductKeys(ctx context.Context, productID int64) ([]string, error) {
	if s == nil || s.repo == nil {
		return nil, nil
	}
	return s.repo.ProductKeys(ctx, productID)
}

// VariantKeys captures local images before a variant cascade removes their rows.
func (s *MediaLifecycleService) VariantKeys(ctx context.Context, variantID int64) ([]string, error) {
	if s == nil || s.repo == nil {
		return nil, nil
	}
	return s.repo.VariantKeys(ctx, variantID)
}

// CleanupURLs best-effort removes canonical local media after the owning DB
// mutation succeeds. Cleanup failures are logged and retried by reconciliation.
func (s *MediaLifecycleService) CleanupURLs(ctx context.Context, values ...*string) {
	keys := make([]string, 0, len(values))
	for _, value := range values {
		if key, ok := mediaStorageKeyFromURL(value); ok {
			keys = append(keys, key)
		}
	}
	s.CleanupKeys(ctx, keys...)
}

// CleanupKeys best-effort removes detached keys. It never reverses a successful
// domain mutation; reconciliation remains the durable retry path.
func (s *MediaLifecycleService) CleanupKeys(ctx context.Context, keys ...string) {
	if s == nil {
		return
	}
	seen := make(map[string]struct{}, len(keys))
	for _, key := range keys {
		if _, duplicate := seen[key]; duplicate {
			continue
		}
		seen[key] = struct{}{}
		deleted, err := s.deleteIfUnreferenced(ctx, key)
		if err != nil {
			s.log.Warn("media lifecycle cleanup deferred",
				zap.String("key", key), zap.Error(err))
		} else if deleted {
			s.log.Info("media lifecycle cleaned detached object", zap.String("key", key))
		}
	}
}

// ReleaseStandalone deletes an explicitly cancelled ownerless upload. A key
// that became referenced in the meantime is a safe no-op.
func (s *MediaLifecycleService) ReleaseStandalone(ctx context.Context, key string) error {
	if err := storage.ValidateKey(key); err != nil {
		return err
	}
	if !strings.HasPrefix(key, "categories/") && !strings.HasPrefix(key, "uploads/") {
		return fmt.Errorf("media lifecycle: key is not a standalone upload: %w", storage.ErrInvalidKey)
	}
	_, err := s.deleteIfUnreferenced(ctx, key)
	return err
}

func (s *MediaLifecycleService) LockMediaKeys(ctx context.Context, keys ...string) (repositories.MediaKeyLock, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("media lifecycle: repository unavailable")
	}
	return s.repo.LockMediaKeys(ctx, keys)
}

func (s *MediaLifecycleService) deleteIfUnreferenced(ctx context.Context, key string) (bool, error) {
	if s == nil || s.repo == nil {
		return false, errors.New("media lifecycle: reference repository unavailable")
	}
	if err := storage.ValidateKey(key); err != nil {
		return false, err
	}
	lock, err := s.repo.LockMediaKeys(ctx, []string{key})
	if err != nil {
		return false, err
	}
	defer func() {
		releaseCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := lock.Release(releaseCtx); err != nil {
			s.log.Warn("media lifecycle key lock release failed", zap.String("key", key), zap.Error(err))
		}
	}()

	referenced, err := s.repo.IsReferenced(ctx, key)
	if err != nil {
		return false, err
	}
	if referenced {
		return false, nil
	}

	if err := s.cache.DeletePrefix(ctx, mediaDerivativePrefix(key)); err != nil {
		return false, fmt.Errorf("delete derivatives: %w", err)
	}
	if err := s.store.Delete(ctx, key); err != nil {
		return false, fmt.Errorf("delete original: %w", err)
	}
	return true, nil
}

func mediaStorageKeyFromURL(value *string) (string, bool) {
	if value == nil || !strings.HasPrefix(*value, "/media/") {
		return "", false
	}
	key := strings.TrimPrefix(*value, "/media/")
	if err := storage.ValidateKey(key); err != nil {
		return "", false
	}
	return key, true
}

func sameMediaURL(left, right *string) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

func mediaDerivativePrefix(key string) string {
	sum := sha256.Sum256([]byte(key))
	hash := hex.EncodeToString(sum[:])
	return "render-v2/" + hash[:2] + "/" + hash
}

type MediaReconcileOptions struct {
	Apply      bool
	MinimumAge time.Duration
	Cutoff     time.Time
	Now        time.Time
}

type MediaReconcileObject struct {
	Key        string    `json:"key"`
	Size       int64     `json:"size"`
	ModifiedAt time.Time `json:"modified_at"`
	Action     string    `json:"action"`
	Error      string    `json:"error,omitempty"`
}

type MissingMediaObject struct {
	Key string `json:"key"`
}

type MediaReconcileSummary struct {
	Stored             int `json:"stored"`
	Referenced         int `json:"referenced"`
	RecentUnreferenced int `json:"recent_unreferenced"`
	MissingReferenced  int `json:"missing_referenced"`
	Candidates         int `json:"candidates"`
	Deleted            int `json:"deleted"`
	SkippedReferenced  int `json:"skipped_referenced"`
	Failed             int `json:"failed"`
}

type MediaReconcileReport struct {
	RunID     string                 `json:"run_id"`
	Mode      string                 `json:"mode"`
	StartedAt time.Time              `json:"started_at"`
	Cutoff    time.Time              `json:"cutoff"`
	Objects   []MediaReconcileObject `json:"objects"`
	Missing   []MissingMediaObject   `json:"missing"`
	Warnings  []string               `json:"warnings,omitempty"`
	Summary   MediaReconcileSummary  `json:"summary"`
}

// Reconcile inventories originals against every live DB media reference. It is
// dry-run by default; apply mode still rechecks each key just before deletion.
func (s *MediaLifecycleService) Reconcile(ctx context.Context, options MediaReconcileOptions) (report MediaReconcileReport, resultErr error) {
	if options.MinimumAge < 0 {
		return report, errors.New("media reconciliation: minimum age cannot be negative")
	}
	now := options.Now.UTC()
	if now.IsZero() {
		now = time.Now().UTC()
	}
	cutoff := options.Cutoff.UTC()
	if cutoff.IsZero() {
		cutoff = now.Add(-options.MinimumAge)
	} else if cutoff.After(now) {
		return report, errors.New("media reconciliation: cutoff cannot be in the future")
	}
	report = MediaReconcileReport{
		RunID:     uuid.NewString(),
		Mode:      map[bool]string{false: "dry-run", true: "apply"}[options.Apply],
		StartedAt: now,
		Cutoff:    cutoff,
		Objects:   make([]MediaReconcileObject, 0),
		Missing:   make([]MissingMediaObject, 0),
	}

	lock, acquired, err := s.repo.TryReconciliationLock(ctx)
	if err != nil {
		return report, err
	}
	if !acquired {
		return report, ErrMediaReconciliationInProgress
	}
	defer func() {
		releaseCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := lock.Release(releaseCtx); err != nil {
			resultErr = errors.Join(resultErr, err)
		}
	}()

	referencedKeys, err := s.repo.ReferencedKeys(ctx)
	if err != nil {
		return report, err
	}
	referenced := make(map[string]struct{}, len(referencedKeys))
	for _, key := range referencedKeys {
		if err := storage.ValidateKey(key); err != nil {
			report.Warnings = append(report.Warnings, fmt.Sprintf("ignored invalid database media key %q", key))
			continue
		}
		referenced[key] = struct{}{}
	}
	report.Summary.Referenced = len(referenced)

	objects, err := s.store.List(ctx, "")
	if err != nil {
		return report, err
	}
	report.Summary.Stored = len(objects)
	stored := make(map[string]struct{}, len(objects))
	for _, object := range objects {
		stored[object.Key] = struct{}{}
		if _, live := referenced[object.Key]; live {
			continue
		}
		if object.ModTime.After(report.Cutoff) {
			report.Summary.RecentUnreferenced++
			continue
		}

		entry := MediaReconcileObject{
			Key: object.Key, Size: object.Size, ModifiedAt: object.ModTime,
			Action: "would_delete",
		}
		report.Summary.Candidates++
		if options.Apply {
			deleted, deleteErr := s.deleteIfUnreferenced(ctx, object.Key)
			switch {
			case deleteErr != nil:
				entry.Action = "failed"
				entry.Error = deleteErr.Error()
				report.Summary.Failed++
				resultErr = errors.Join(resultErr, deleteErr)
			case !deleted:
				entry.Action = "skipped_referenced"
				report.Summary.SkippedReferenced++
			default:
				entry.Action = "deleted"
				report.Summary.Deleted++
			}
		}
		report.Objects = append(report.Objects, entry)
	}

	for key := range referenced {
		if _, exists := stored[key]; !exists {
			report.Missing = append(report.Missing, MissingMediaObject{Key: key})
		}
	}
	if len(report.Missing) > 1 {
		// ReferencedKeys is sorted, and map iteration is not.
		for i := 0; i < len(report.Missing)-1; i++ {
			for j := i + 1; j < len(report.Missing); j++ {
				if report.Missing[j].Key < report.Missing[i].Key {
					report.Missing[i], report.Missing[j] = report.Missing[j], report.Missing[i]
				}
			}
		}
	}
	report.Summary.MissingReferenced = len(report.Missing)
	return report, resultErr
}
