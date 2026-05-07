# ProofBridge Liner v1.1.1 - Quick Start Guide

## Overview
ProofBridge Liner is a production-ready Safety Kernel for property deeds in South Africa, implementing Bayesian scoring with regulatory compliance for Act 47, JS2, POPIA, Cybercrimes Act, and FICA.

## Installation
1. Run `./setup.sh` to install dependencies and create directories.
2. Configure `.env` with your API keys and settings.
3. Run `npm run demo` to see the stratified prover in action.

## Usage
- Use `processProofRequest(cid)` from `prover/main.js` to evaluate deed evidence.
- High-risk events trigger automatic compliance reporting.

## Deployment
Follow the launch checklist in the README for production deployment.