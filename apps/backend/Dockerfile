FROM golang:1.25-alpine AS builder

WORKDIR /app

# Install tools
RUN apk add --no-cache git

# Cache dependencies FIRST
COPY go.mod go.sum ./
RUN go mod download

# Copy source code later
COPY . .

# Build app
RUN go build -o server ./cmd/server/main.go


FROM alpine:latest

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY --from=builder /app/server .
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/.env ./.env

EXPOSE 8080

CMD ["./server"]