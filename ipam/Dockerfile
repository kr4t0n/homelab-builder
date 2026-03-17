# syntax=docker/dockerfile:1
FROM golang:1.24-alpine AS builder

WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /ipam ./cmd/server

FROM alpine:3.19
RUN apk add --no-cache ca-certificates && \
    adduser -D -g '' appuser

COPY --from=builder /ipam /ipam

# Run as non-root user
USER appuser

EXPOSE 8081
ENTRYPOINT ["/ipam"]
