# STAGE 1: Build the Go Binary
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Install dependencies first (allows Docker to cache this step)
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the integrated API Gateway + Worker binary
# CGO_ENABLED=0 ensures a static binary with no external C dependencies
RUN CGO_ENABLED=0 GOOS=linux go build -o /api-gateway ./cmd/api

# STAGE 2: Create the tiny production image
FROM alpine:latest

WORKDIR /root/

# Install CA certificates so the Go binary can make HTTPS calls to GitHub/OpenAI
RUN apk --no-cache add ca-certificates

# Copy the compiled binary from the builder stage
COPY --from=builder /api-gateway .

# Expose the port
EXPOSE 8080

# Start the integrated engine
CMD ["./api-gateway"]