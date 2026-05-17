FROM redis:7-alpine

RUN apk add --no-cache redis-cli

COPY redis.conf /usr/local/etc/redis/redis.conf

EXPOSE 6379

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  redis-cli ping

CMD ["redis-server", "/usr/local/etc/redis/redis.conf"]