FROM node:22-alpine AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV VITE_OPENAI_PROXY_URL=/api/openai/chat/completions
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package*.json ./
COPY --from=build /app/dist ./dist
COPY server/index.js server/openAiProxy.js ./server/
EXPOSE 8080

CMD ["node", "server/index.js"]
