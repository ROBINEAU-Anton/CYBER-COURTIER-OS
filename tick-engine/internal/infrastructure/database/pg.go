package database

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewDBPool configure et retourne un nouveau pool de connexions PostgreSQL.
func NewDBPool(connString string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(context.Background(), connString)
	if err != nil {
		return nil, err
	}
	return pool, nil
}
