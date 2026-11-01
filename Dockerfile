# NTT DATA HRMS: one container that serves the built web app and the API (Cloud Run ready).

# 1) Build the React app. VITE_* values are public and baked into the bundle at build time.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_CLIENT_ID=
ARG VITE_TENANT_ID=
ENV VITE_CLIENT_ID=$VITE_CLIENT_ID VITE_TENANT_ID=$VITE_TENANT_ID
RUN npm run build

# 2) Runtime: the API server uses only Node built-ins, so no node_modules are needed.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY server ./server
COPY --from=build /app/dist ./dist
RUN mkdir -p server/.cache && chown -R node:node server/.cache
USER node
EXPOSE 8080
CMD ["node", "server/index.js"]
