const Redis = require('ioredis');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
    console.error("❌ FATAL: REDIS_URL is not defined in .env");
    process.exit(1);
}

const isSecure = redisUrl.startsWith('rediss://');

const redis = new Redis(redisUrl, {
    tls: isSecure ? { rejectUnauthorized: false } : undefined,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    reconnectOnError: (err) => {
        if (err.code === 'ECONNRESET') return true;
        return false;
    },
    maxRetriesPerRequest: null,
    enableOfflineQueue: false
});

redis.on('connect', () => console.log(`✅ Redis Connected to: ${redisUrl.split('@')[1] || 'localhost'}`));
redis.on('error', (err) => console.error('❌ Redis Connection Error:', err.message));

module.exports = redis;