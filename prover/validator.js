// prover/validator.js
// ProofBridge Liner — Deterministic Document Structure Gate
//
// First Principles Build:
//   A South African deed of transfer is authentic if and only if it
//   contains a fixed set of mandatory structural markers. Their presence
//   is a necessary condition for legal validity — not sufficient, but necessary.
//
// Architecture:
//   Pure function. Zero dependencies. Regex-based. Conjunction gate.
//   All six rules must pass for documentValid = true.
//
// Integration:
//   PDF Buffer → extractTextFromPDF() → validateDeed() → scoreAsset()
//   When documentValid = false, scorer clamps triggerScore to ≥ 0.80.
//
// Safety Kernel v1.0: FROZEN — no on-chain changes required.

const RULES = [
  {
    id: 'TITLE_DEED_NUMBER',
    label: 'Title deed number present (e.g. T12345/2023)',
    check: (text) => /T\d{5,}\/20\d{2}/i.test(text),
  },
  {
    id: 'PROPERTY_DESCRIPTION',
    label: 'Property description (ERF, FARM, or SECTIONAL TITLE)',
    check: (text) =>
      /\b(ERF\s+\d+|FARM\s+\d+|SECTIONAL\s+TITLE)\b/i.test(text),
  },
  {
    id: 'VESTING_CLAUSE',
    label: 'Vesting clause present (hereby transferred)',
    check: (text) => /(hereby transferred|do hereby transfer)/i.test(text),
  },
  {
    id: 'EXECUTION_DATE',
    label: 'Execution date present and within last 50 years',
    check: (text) => {
      const match = text.match(
        /(\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i
      );
      if (!match) return false;
      const year = parseInt(match[0].match(/\d{4}/)[0], 10);
      const currentYear = new Date().getFullYear();
      return year >= currentYear - 50 && year <= currentYear;
    },
  },
  {
    id: 'REGISTRAR_SIGNATURE',
    label: 'Registrar of Deeds signature block',
    check: (text) => /REGISTRAR\s+OF\s+DEEDS/i.test(text),
  },
  {
    id: 'MINIMUM_LENGTH',
    label: 'Document text at least 500 characters',
    check: (text) => text.length >= 500,
  },
];

/**
 * Validates extracted deed text against mandatory structural markers.
 * @param {string} text - Extracted PDF text
 * @returns {{ valid: boolean, failures: Array<{id: string, label: string}> }}
 */
function validateDeed(text) {
  if (!text || typeof text !== 'string') {
    return {
      valid: false,
      failures: [{ id: 'INPUT', label: 'No text provided' }],
    };
  }

  const failures = [];
  for (const rule of RULES) {
    try {
      if (!rule.check(text)) {
        failures.push({ id: rule.id, label: rule.label });
      }
    } catch (err) {
      failures.push({
        id: rule.id,
        label: `${rule.label} (error: ${err.message})`,
      });
    }
  }

  return {
    valid: failures.length === 0,
    failures,
  };
}

module.exports = { validateDeed, RULES };