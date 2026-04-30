#!/bin/bash

# ProofBridge Liner Paper Compilation Script
# Requires: pdflatex, bibtex

echo "Compiling ProofBridge Liner arXiv Paper..."

# First compilation
pdflatex proofbridge-liner-paper.tex

# Bibliography compilation
bibtex proofbridge-liner-paper

# Second compilation for references
pdflatex proofbridge-liner-paper.tex

# Third compilation for final formatting
pdflatex proofbridge-liner-paper.tex

echo "Compilation complete. Check proofbridge-liner-paper.pdf"

# Optional: Clean auxiliary files
# rm -f *.aux *.bbl *.blg *.log *.out *.toc