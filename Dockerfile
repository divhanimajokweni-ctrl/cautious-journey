# Dockerfile for ProofBridge Liner
# Uses Foundry with compatible GLIBC for contract testing

FROM ghcr.io/foundry-rs/foundry:latest

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci

# Copy source code
COPY . .

# Default command: run tests
CMD ["npm", "run", "test:contracts"]