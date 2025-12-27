FROM node:alpine3.20 AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

RUN npm install -g pkg

RUN pkg . --targets node18-linux-x64 --output vault-bin

FROM node:alpine3.20

RUN apk add --no-cache tini gcompat libstdc++

WORKDIR /vault

COPY --from=builder /app/vault-bin ./vault

RUN addgroup -S vaultgroup && adduser -S vaultuser -G vaultgroup
RUN chown -R vaultuser:vaultgroup /vault

USER vaultuser

ENTRYPOINT [ "/sbin/tini", "--", "/vault/vault" ]

CMD ["help"]