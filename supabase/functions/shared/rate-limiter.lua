local key = KEYS[1]
local now = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local windowMs = tonumber(ARGV[3])
local memberId = ARGV[4]

local clearBefore = now - windowMs

-- 1. Remove elements outside the current sliding window
redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)

-- 2. Get current request count in the window
local requestCount = redis.call('ZCARD', key)

local allowed = 0
local remaining = 0
local retryAfter = 0

if requestCount < limit then
    -- Allowed! Add current request
    redis.call('ZADD', key, now, memberId)
    -- Update expiry of the key to keep Redis clean (windowMs in seconds, rounded up + 2s buffer)
    redis.call('EXPIRE', key, math.ceil(windowMs / 1000) + 2)
    allowed = 1
    remaining = limit - (requestCount + 1)
else
    -- Blocked! Get oldest element to calculate retry-after
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    if oldest and #oldest >= 2 then
        local oldestTime = tonumber(oldest[2])
        local waitMs = (oldestTime + windowMs) - now
        retryAfter = math.ceil(waitMs / 1000)
    else
        retryAfter = math.ceil(windowMs / 1000)
    end
    if retryAfter < 1 then
        retryAfter = 1
    end
    allowed = 0
    remaining = 0
end

return {allowed, remaining, retryAfter}
