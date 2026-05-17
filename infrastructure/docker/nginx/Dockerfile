FROM nginx:1.25-alpine

RUN apk add --no-cache \
    openssl \
    curl \
    fcgiwrap

RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nginx.key \
    -out /etc/nginx/ssl/nginx.crt \
    -subj "/C=US/ST=State/L=City/O=OmniMind"

COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  curl -f http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]