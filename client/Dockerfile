FROM node:18-slim as build

WORKDIR /app

# Copy package.json and pnpm-lock.yaml if present
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install dependencies using npm (as per instructions)
RUN npm install

# Copy source
COPY . .

# Build the frontend
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets to Nginx
COPY --from=build /app/dist/public /usr/share/nginx/html

# Copy nginx config if needed, otherwise use default
# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
