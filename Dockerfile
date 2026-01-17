# Use the official Node.js runtime as the base image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY index.js ./

# Expose the port that the app runs on
EXPOSE 8080

# Set environment variable for port
ENV PORT=8080

# Run the application
CMD ["npm", "start"]

