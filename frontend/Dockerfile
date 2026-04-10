FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM alpine:3.20

# Copy built files into the image
COPY --from=builder /app/out /build

# At runtime, copy files to the shared volume then stay alive
CMD ["sh", "-c", "cp -r /build/* /app/out/ && echo 'Static files ready' && tail -f /dev/null"]
