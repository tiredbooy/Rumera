package migrations

import "embed"

//go:embed main/*.sql
var Main embed.FS

//go:embed analytics/*.sql
var Analytics embed.FS
