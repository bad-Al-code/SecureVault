FROM node:alpine3.20 AS base 

WORKDIR /app 

COPY package*.json ./

RUN npm ci 

COPY main.ts tsconfig.json ./

RUN npm run build

FROM node:alpine3.20 

RUN apk add --no-cache tini 

WORKDIR /vault 

COPY --from=base /app/package*.json ./

RUN npm ci --only=production 

RUN npm install -g pkg

COPY --from=base /app/main.js ./

RUN pkg . --targets node18-linux-x64 --output /vault/vault

RUN addgroup -S vaultgroup && adduser -S vaultuser -G vaultgroup

RUN chown -R vaultuser:vaultgroup /vault 

USER vaultuser

ENTRYPOINT [ "/sbin/tini", "--", "/vault/vault" ]

CMD ["help"]
