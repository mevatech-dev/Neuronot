# syntax=docker/dockerfile:1.7

FROM golang:1.22-alpine AS build
WORKDIR /src
RUN apk add --no-cache git
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api /usr/local/bin/api
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/api"]
