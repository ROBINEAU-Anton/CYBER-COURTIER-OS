package cache

import (
	"github.com/redis/go-redis/v9"
)

// NewRedisClient configure et retourne une nouvelle connexion au client Redis en utilisant une URL.
func NewRedisClient(url string) (*redis.Client, error) {
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}

	client := redis.NewClient(opts)
	return client, nil
}
