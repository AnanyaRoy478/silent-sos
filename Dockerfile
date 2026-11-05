# Build the React client
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client ./
RUN npm run build

# Run the API and serve the built client from the same origin
FROM node:20-alpine
WORKDIR /app/server
ENV NODE_ENV=production
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server ./
COPY --from=client-build /app/client/dist /app/client/dist
EXPOSE 5000
CMD ["node", "src/index.js"]
