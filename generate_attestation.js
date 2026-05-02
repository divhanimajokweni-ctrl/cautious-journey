const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  PageBreak, LevelFormat
} = require('docx');
const fs = require('fs');

// ─── Palette ──────────────────────────────────────────────────────
const C = {
  ink:     "0B1120",
  navy:    "0D2137",
  teal:    "0A7E7E",
  accent:  "0ABFBC",
  red:     "C0392B",
  amber:   "B7770D",
  green:   "1A7A4A",
  silver: "8B9BAC",
  mist:   "EAF4F4",
  white:  "FFFFFF",
  rowH:    "0D2137",
  rowA:    "EAF4F4",
  rowB:    "FFFFFF",
  rowOK:   "E4F9F0",
  rowWARN: "FEF6E4",
  rowFAIL: "FDEDEC",
  rowNEW:  "EEF4FF",
};

const b1   = { style: BorderStyle.SINGLE, size: 1, color: "B0C8C8" };
const bNone= { style: BorderStyle.NONE,   size: 0, color: C.white  };
const cB   = { top: b1, bottom: b1, left: b1, right: b1 };
const nB   = { top: bNone, bottom: bNone, left: bNone, right: bNone };

// ─── Helpers ──────────────────────────────────────────────────────
const run = (text, o={}) => new TextRun({
  text,
  font:    o.mono ? "Courier New" : "Garamond",
  size:    o.size || (o.mono ? 18 : 22),
  bold:    o.bold   || false,
  italics: o.italic || false,
  color:   o.color  || C.ink,
});

const para = (children, o={}) => new Paragraph({
  children: Array.isArray(children) ? children : [children],
  alignment: o.align || AlignmentType.LEFT,
  spacing: { before: o.before||0, after: o.after||120 },
  indent: o.indent ? { left: o.indent } : undefined,
  border: o.bb ? { bottom: { style: BorderStyle.SINGLE, size: 3, color: C.teal, space: 4 } } : undefined,
});

const h1 = (text) => new Paragraph({
  children: [new TextRun({ text, font: "Garamond", size: 44, bold: true, color: C.navy })],
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 520, after: 160 },
  border: { bottom: { style: BorderStyle.THICK, size: 10, color: C.teal, space: 8 } },
});
const h2 = (text) => new Paragraph({
  children: [new TextRun({ text, font: "Garamond", size: 30, bold: true, color: C.teal })],
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 360, after: 120 },
});
const h3 = (text, color=C.navy) => new Paragraph({
  children: [new TextRun({ text, font: "Garamond", size: 24, bold: true, color })],
  spacing: { before: 220, after: 80 },
});

const body = (text, o={}) => para([run(text, o)], { after: 120 });
const iBody= (text, color=C.silver) => para([run(text, { italic:true, color })], { after: 100, indent: 360 });
const code = (text) => new Paragraph({
  children: [new TextRun({ text, font: "Courier New", size: 18, color: "114F6E" })],
  spacing: { before: 25, after: 25 },
  indent: { left: 360 },
  shading: { fill: "DFF0F5", type: ShadingType.CLEAR },
});
const divider = () => new Paragraph({
  children: [],
  border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "B0C8C8", space: 2 } },
  spacing: { before: 200, after: 200 },
});
const bullet = (text, ref="b") => new Paragraph({
  children: [new TextRun({ text, font: "Garamond", size: 22, color: C.ink })],
  numbering: { reference: ref, level: 0 },
  spacing: { before: 40, after: 70 },
});

// ─── Cell helpers ─────────────────────────────────────────────────
const cell = (text, width, o={}) => new TableCell({
  borders: o.nB ? nB : cB,
  width: { size: width, type: WidthType.DXA },
  margins: { top: 90, bottom: 90, left: 150, right: 150 },
  shading: { fill: o.fill || C.white, type: ShadingType.CLEAR },
  children: [new Paragraph({ children: [new TextRun({
    text, font: o.mono?"Courier New":"Garamond",
    size: o.size||20, bold: o.bold||false, color: o.color||C.ink,
  })] })],
});

// 5-col delta matrix
const deltaRow = (claim, vol1, vol2, doc2, verdict, vFill=C.rowB) => new TableRow({ children: [
  cell(claim,   2400, { fill: C.rowA }),
  cell(vol1,    1600, { fill: C.rowB,  color: C.navy }),
  cell(vol2,    1600, { fill: C.rowB,  color: C.teal }),
  cell(doc2,    1800, { fill: C.rowB,  color: C.ink  }),
  cell(verdict, 1360, { fill: vFill,   bold: true }),
]});
const deltaHeader = () => new TableRow({ children: [
  cell("Claim / Component",         2400, { fill: C.rowH, bold:true, color: C.white }),
  cell("Blackbook Vol. I",          1600, { fill: C.rowH, bold:true, color: C.white }),
  cell("Blackbook Vol. II",         1600, { fill: C.rowH, bold:true, color: C.white }),
  cell("Doc 2 (New Submission)",    1800, { fill: C.rowH, bold:true, color: C.white }),
  cell("Attestation",               1360, { fill: C.rowH, bold:true, color: C.white }),
]});
const deltaTable = (rows) => new Table({
  width: { size: 8760, type: WidthType.DXA },
  columnWidths: [2400, 1600, 1600, 1800, 1360],
  rows,
});

// 2-col table
const row2 = (l, r, hdr=false) => new TableRow({ children: [
  cell(l, 3600, { fill: hdr?C.rowH:C.rowA, bold:hdr, color: hdr?C.white:C.navy }),
  cell(r, 5760, { fill: hdr?C.rowH:C.rowB, bold:hdr, color: hdr?C.white:C.ink  }),
]});
const table2 = (rows) => new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [3600, 5760],
  rows,
});

// 3-col table
const row3 = (a,b,c, hdr=false) => new TableRow({ children: [
  cell(a, 2880, { fill: hdr?C.rowH:C.rowA, bold:hdr, color: hdr?C.white:C.navy }),
  cell(b, 3600, { fill: hdr?C.rowH:C.rowB, bold:hdr, color: hdr?C.white:C.ink  }),
  cell(c, 2880, { fill: hdr?C.rowH:"EAF8F8", bold:hdr, color: hdr?C.white:C.teal }),
]});
const table3 = (rows) => new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [2880, 3600, 2880],
  rows,
});

// ─── DOCUMENT ─────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      { reference: "b", levels: [{ level:0, format: LevelFormat.BULLET, text:"▸", alignment: AlignmentType.LEFT, style:{ paragraph:{ indent:{ left:480, hanging:240 } } } }] },
      { reference: "n", levels: [{ level:0, format: LevelFormat.DECIMAL, text:"%1.", alignment: AlignmentType.LEFT, style:{ paragraph:{ indent:{ left:480, hanging:240 } } } }] },
    ]
  },
  styles: {
    default: { document: { run: { font:"Garamond", size:22 } } },
    paragraphStyles: [
      { id:"Heading1", name:"Heading 1", basedOn:"Normal", next:"Normal", quickFormat:true,
        run:{ size:44, bold:true, font:"Garamond", color:C.navy },
        paragraph:{ spacing:{ before:520, after:160 }, outlineLevel:0 } },
      { id:"Heading2", name:"Heading 2", basedOn:"Normal", next:"Normal", quickFormat:true,
        run:{ size:30, bold:true, font:"Garamond", color:C.teal },
        paragraph:{ spacing:{ before:360, after:120 }, outlineLevel:1 } },
    ]
  },
  sections: [{
    properties: { page:{ size:{ width:12240, height:15840 }, margin:{ top:1440, right:1300, bottom:1440, left:1300 } } },
    children: [

      // ══════════════════════════════════════════════
      // COVER
      // ══════════════════════════════════════════════
      new Paragraph({ children:[], spacing:{ before:800 } }),

      para([run("PROOFBRIDGE LINER", { bold:true, size:52, color:C.navy })],
           { align:AlignmentType.CENTER, after:80 }),
      para([run("Comparative Attestation & Delta Report", { size:28, italic:true, color:C.teal })],
           { align:AlignmentType.CENTER, after:80 }),
      para([run("Blackbook Vol. I  ·  Vol. II  vs.  New Liveness Submission (Doc 2)", { size:19, italic:true, color:C.silver })],
           { align:AlignmentType.CENTER, after:0 }),

      new Paragraph({ children:[], border:{ bottom:{ style:BorderStyle.THICK, size:12, color:C.teal, space:8 } }, spacing:{ before:120, after:120 } }),
      new Paragraph({ children:[], spacing:{ before:200 } }),

      table2([
        row2("Document",        "ProofBridge Liveness — Comparative Attestation Report"),
        row2("Corpus Under Review", "Blackbook Vol. I · Vol. II (produced) + Doc 2 (new submission)"),
        row2("Attestation Date","May 2026"),
        row2("Attesting Entity","VV Security Spine — SafeKrypte Foundation Layer"),
        row2("Verdict",         "✅ Doc 2 CONFIRMED — Net-additive to canon, one precision delta applied"),
      ]),

      new Paragraph({ children:[new PageBreak()], spacing:{ before:0, after:0 } }),

      // ══════════════════════════════════════════════
      // SECTION 1 — METHODOLOGY
      // ══════════════════════════════════════════════
      h1("Section 1 — Attestation Methodology"),

      h2("1.1  What 'Compare and Attest' Means in Formal Methods"),
      body("Attestation in the context of a formal verification corpus is not a subjective review. It is a claim-by-claim comparison against a canonical reference, producing one of four verdicts for each claim:"),

      table3([
        row3("Verdict",       "Meaning",                                           "Action", true),
        row3("✅ CONFIRMED",   "Claim in Doc 2 matches canon — identical or equivalent formal statement", "Accept as-is"),
        row3("➕ ADDITIVE",    "Claim in Doc 2 is new — not in canon, but consistent with it",            "Integrate into corpus"),
        row3("⚠️ DELTA",       "Claim in Doc 2 differs from canon — requires reconciliation",             "Apply precision correction"),
        row3("❌ CONFLICT",    "Claim in Doc 2 contradicts canon — cannot coexist",                       "Reject with explanation"),
      ]),

      body("The attestation below is performed across six dimensions: TLA+ specification structure, Coq proof content, fairness semantics, module naming and repository layout, liveness property statement, and integration with the existing safety invariants."),

      divider(),
      h2("1.2  Corpus Reference Points"),

      table2([
        row2("Document",                   "Key Contributions", true),
        row2("Vol. I — SafetyKernel.tla",  "Safety invariant (SafetyInvariant), two-state DFA, T1–T5 axioms, gas invariants G1–G3, ERC-20 hook, counterexample table"),
        row2("Vol. I — Coq pseudo-proof",   "halted_is_absorbing theorem, fail_closed theorem, step() total function, State/Authority/Input types"),
        row2("Vol. II — ProofBridgeLiveness.tla", "Liveness property via ~> operator, WF_vars(Recover) fairness clause, Beta(1,10) scorer, PCR TEE binding, recovery protocol"),
        row2("Vol. II — Coq extension",     "liveness_fair theorem stub, reset_instant as single-step liveness, trace model CoInductive Trace"),
        row2("Doc 2 (New Submission)",      "SafetyKernelLiveness.tla (extends SafetyKernel), TLAPS import, LivenessProperty via [] ⇒ <>, WF on Reset, reset_instant theorem, liveness_fair theorem"),
      ]),

      new Paragraph({ children:[new PageBreak()], spacing:{ before:0, after:0 } }),

      // ══════════════════════════════════════════════
      // SECTION 2 — DELTA MATRIX
      // ══════════════════════════════════════════════
      h1("Section 2 — Claim-by-Claim Delta Matrix"),

      body("Every formal claim in Doc 2 is compared against the canon. Width of the table demands precision — each cell is a verdict, not a summary."),

      new Paragraph({ children:[], spacing:{ before:80 } }),

      new Table({
        width: { size: 9660, type: WidthType.DXA },
        columnWidths: [2400, 1600, 1600, 1800, 1360],
        rows: [
          // Header
          new TableRow({ children: [
            cell("Claim / Component",       2400, { fill:C.rowH, bold:true, color:C.white }),
            cell("Vol. I",                  1600, { fill:C.rowH, bold:true, color:C.white }),
            cell("Vol. II",                 1600, { fill:C.rowH, bold:true, color:C.white }),
            cell("Doc 2",                   1800, { fill:C.rowH, bold:true, color:C.white }),
            cell("Verdict",                 1360, { fill:C.rowH, bold:true, color:C.white }),
          ]}),

          // TLA+ structure
          new TableRow({ children:[
            cell("TLA+ module EXTENDS SafetyKernel", 2400, { fill:C.rowA }),
            cell("SafetyKernel.tla is the base module", 1600, { fill:C.rowB, color:C.navy }),
            cell("ProofBridgeLiveness.tla extends implicitly", 1600, { fill:C.rowB, color:C.teal }),
            cell("SafetyKernelLiveness.tla — explicit EXTENDS SafetyKernel, Naturals, TLAPS", 1800),
            cell("✅ CONFIRMED", 1360, { fill:C.rowOK, bold:true, color:C.green }),
          ]}),

          new TableRow({ children:[
            cell("State space {OPEN, HALTED}", 2400, { fill:C.rowA }),
            cell("Defined in SafetyKernel.tla — States == {OPEN, HALTED}", 1600, { fill:C.rowB, color:C.navy }),
            cell("Inherited from Vol. I", 1600, { fill:C.rowB, color:C.teal }),
            cell("Inherited via EXTENDS — not redeclared (correct)", 1800),
            cell("✅ CONFIRMED", 1360, { fill:C.rowOK, bold:true, color:C.green }),
          ]}),

          new TableRow({ children:[
            cell("Fairness clause on Reset", 2400, { fill:C.rowA }),
            cell("Not present in Vol. I safety spec", 1600, { fill:C.rowB, color:C.navy }),
            cell("WF_vars(Recover) on Recover action", 1600, { fill:C.rowB, color:C.teal }),
            cell("WF_<<state,posterior,actor>>(Reset) — correct variable tuple, correct action name", 1800),
            cell("✅ CONFIRMED", 1360, { fill:C.rowOK, bold:true, color:C.green }),
          ]}),

          new TableRow({ children:[
            cell("Liveness property operator", 2400, { fill:C.rowA }),
            cell("Not in Vol. I", 1600, { fill:C.rowB, color:C.navy }),
            cell("(HALTED ∧ AUTH) ~> OPEN using leads-to", 1600, { fill:C.rowB, color:C.teal }),
            cell("[]((state=HALTED ∧ actor=AUTH) => <>(state=OPEN)) — box-diamond formulation", 1800),
            cell("⚠️ DELTA", 1360, { fill:C.rowWARN, bold:true, color:C.amber }),
          ]}),

          new TableRow({ children:[
            cell("THEOREM Spec => LivenessProperty", 2400, { fill:C.rowA }),
            cell("Not in Vol. I", 1600, { fill:C.rowB, color:C.navy }),
            cell("Implicit — proven via TLC trace analysis", 1600, { fill:C.rowB, color:C.teal }),
            cell("Explicit THEOREM declaration — TLAPS-style, correct", 1800),
            cell("➕ ADDITIVE", 1360, { fill:C.rowNEW, bold:true, color:"1A3A8F" }),
          ]}),

          new TableRow({ children:[
            cell("Coq: reset_instant theorem", 2400, { fill:C.rowA }),
            cell("halted_is_absorbing + fail_closed in Vol. I", 1600, { fill:C.rowB, color:C.navy }),
            cell("reset_instant stub in Vol. II", 1600, { fill:C.rowB, color:C.teal }),
            cell("Full proof: intros s i Hs Ha; subst s; simpl; rewrite Ha; reflexivity", 1800),
            cell("✅ CONFIRMED", 1360, { fill:C.rowOK, bold:true, color:C.green }),
          ]}),

          new TableRow({ children:[
            cell("Coq: liveness_fair theorem", 2400, { fill:C.rowA }),
            cell("Not in Vol. I", 1600, { fill:C.rowB, color:C.navy }),
            cell("Introduced as stub in Vol. II", 1600, { fill:C.rowB, color:C.teal }),
            cell("Doc 2 provides proof sketch — fairness → reset_instant → OPEN, honest ellipsis", 1800),
            cell("✅ CONFIRMED", 1360, { fill:C.rowOK, bold:true, color:C.green }),
          ]}),

          new TableRow({ children:[
            cell("Coq: CoInductive Trace model", 2400, { fill:C.rowA }),
            cell("Not in Vol. I", 1600, { fill:C.rowB, color:C.navy }),
            cell("Introduced in Vol. II", 1600, { fill:C.rowB, color:C.teal }),
            cell("Doc 2 retains and correctly uses step : State -> Input -> Trace -> Trace", 1800),
            cell("✅ CONFIRMED", 1360, { fill:C.rowOK, bold:true, color:C.green }),
          ]}),

          new TableRow({ children:[
            cell("Repository layout", 2400, { fill:C.rowA }),
            cell("Vol. I defines proofbridge-liner/ layout", 1600, { fill:C.rowB, color:C.navy }),
            cell("Vol. II extends layout — audit/, docs/", 1600, { fill:C.rowB, color:C.teal }),
            cell("Doc 2 places SafetyKernelLiveness.tla under spec/ alongside SafetyKernel.tla", 1800),
            cell("✅ CONFIRMED", 1360, { fill:C.rowOK, bold:true, color:C.green }),
          ]}),

          new TableRow({ children:[
            cell("WF explanation (why fairness needed)", 2400, { fill:C.rowA }),
            cell("Implicit in Vol. I gas invariants", 1600, { fill:C.rowB, color:C.navy }),
            cell("Explicit in Vol. II: WF encodes deployment assumption", 1600, { fill:C.rowB, color:C.teal }),
            cell("Doc 2 provides correct plain-English rationale: continuously enabled → eventually fires", 1800),
            cell("✅ CONFIRMED", 1360, { fill:C.rowOK, bold:true, color:C.green }),
          ]}),

          new TableRow({ children:[
            cell("TLAPS import in TLA+ spec", 2400, { fill:C.rowA }),
            cell("Not in Vol. I", 1600, { fill:C.rowB, color:C.navy }),
            cell("Not explicitly imported in Vol. II", 1600, { fill:C.rowB, color:C.teal }),
            cell("Doc 2 adds EXTENDS TLAPS — correct for proof-assistant use, not needed for TLC alone", 1800),
            cell("➕ ADDITIVE", 1360, { fill:C.rowNEW, bold:true, color:"1A3A8F" }),
          ]}),

          new TableRow({ children:[
            cell("Next power move declared", 2400, { fill:C.rowA }),
            cell("Vol. I: liveness, TEE, multi-asset", 1600, { fill:C.rowB, color:C.navy }),
            cell("Vol. II: Coq/Lean compilation, SOC 2 Type II harness", 1600, { fill:C.rowB, color:C.teal }),
            cell("Doc 2: Coq/Lean extraction to certified EVM contract — Gallina → Solidity/Yul", 1800),
            cell("➕ ADDITIVE", 1360, { fill:C.rowNEW, bold:true, color:"1A3A8F" }),
          ]}),
        ],
      }),

      new Paragraph({ children:[], spacing:{ before:200 } }),

      // ══════════════════════════════════════════════
      // SECTION 3 — THE ONE DELTA (⚠️)
      // ══════════════════════════════════════════════
      new Paragraph({ children:[new PageBreak()], spacing:{ before:0, after:0 } }),
      h1("Section 3 — The One Delta: Liveness Property Formulation"),

      h2("3.1  The Precise Difference"),
      body("The delta is not an error. It is a formulation choice between two equivalent temporal logic statements for the liveness property. Both are correct. They are not identical. The attestation record requires this to be stated precisely."),

      table2([
        row2("Dimension",           "Detail", true),
        row2("Vol. II formulation", "(state = HALTED ∧ actor_type = AUTH) ~> (state = OPEN)"),
        row2("Doc 2 formulation",   "[]((state = HALTED ∧ actor = AUTHORIZED) ⇒ <>(state = OPEN) )"),
        row2("Are they equivalent?","Yes — in LTL, P ~> Q is defined as [](P ⇒ <>Q). Doc 2 writes the definition out explicitly."),
        row2("Which is idiomatic TLA+?", "Vol. II ~> is idiomatic TLA+ / TLC syntax. Doc 2's box-diamond is standard LTL — both valid in TLA+."),
        row2("Variable name delta", "Vol. II uses actor_type ∈ {AUTH, UNAUTH}. Doc 2 uses actor ∈ {AUTHORIZED, UNAUTHORIZED} — inheriting from Vol. I SafetyKernel.tla variables."),
        row2("Verdict",             "⚠️ DELTA — both correct, Doc 2 inherits Vol. I variable names (preferred for EXTENDS consistency). Recommend aligning Vol. II variable names to match."),
      ]),

      divider(),
      h2("3.2  Reconciliation — Canonical Formulation Going Forward"),
      body("Since Doc 2 uses EXTENDS SafetyKernel, its variable names (actor, AUTHORIZED, UNAUTHORIZED) are authoritative — they are inherited from the base module. Vol. II's standalone module used actor_type / AUTH / UNAUTH for readability in isolation. The canonical corpus should adopt Doc 2's naming for consistency across all liveness specs."),

      h3("Canonical Liveness Property (Reconciled)", C.teal),
      code("LivenessProperty =="),
      code("    []( (state = \"HALTED\" /\\ actor = AUTHORIZED) => <>(state = \"OPEN\") )"),
      code(""),
      code("(* Equivalent ~> shorthand — both are valid in TLA+ *)"),
      code("LivenessShorthand =="),
      code("    (state = \"HALTED\" /\\ actor = AUTHORIZED) ~> (state = \"OPEN\")"),
      code(""),
      code("(* Fairness clause — authoritative form *)"),
      code("Spec =="),
      code("    Init"),
      code("    /\\ [][Next]_<<state, posterior, actor>>"),
      code("    /\\ WF_<<state, posterior, actor>>(Reset)"),

      body("This is the reconciled canonical form. Both LivenessProperty and LivenessShorthand should be included in the final spec — the former for TLAPS proof use, the latter for TLC model-checking readability."),

      new Paragraph({ children:[new PageBreak()], spacing:{ before:0, after:0 } }),

      // ══════════════════════════════════════════════
      // SECTION 4 — NET ADDITIONS
      // ══════════════════════════════════════════════
      h1("Section 4 — Net Additions from Doc 2"),

      h2("4.1  What Doc 2 Contributes That Was Not in Canon"),

      table2([
        row2("Addition",                       "Significance", true),
        row2("Explicit THEOREM declaration",   "Vol. II implied the theorem via TLC trace reasoning. Doc 2 makes it a named, citable formal claim: THEOREM Spec => LivenessProperty. This is the correct form for TLAPS and for auditor citation."),
        row2("EXTENDS TLAPS import",           "Enables proof-assistant-level verification of the liveness theorem. Without this, TLA+ specs are only model-checked (TLC), not proof-checked (TLAPS). Doc 2 opens the path to machine-checked liveness certificates."),
        row2("Box-diamond formulation",        "[]( P ⇒ <>Q ) is the standard LTL form. Having both ~> (TLC-idiomatic) and []⇒<> (TLAPS-idiomatic) in the corpus serves different audiences: operators use ~>, proof engineers use []⇒<>."),
        row2("Plain-English fairness rationale","'A message that can be delivered will be delivered' — this is the deployment-assumption encoding that Vol. II stated technically. Doc 2's narrative framing is suitable for non-specialist auditor review."),
        row2("Coq/Lean extraction as next move","Gallina → Solidity/Yul via certified compilation is a materially different next step than Vol. II's 'compile in Coq.' It proposes a full extraction pipeline — not just proof, but certified code generation."),
      ]),

      divider(),
      h2("4.2  Updated Repository Layout (Canonical)"),
      code("proofbridge-liner/"),
      code("├── spec/"),
      code("│   ├── SafetyKernel.tla              ← safety invariants (Vol. I)"),
      code("│   └── SafetyKernelLiveness.tla       ← liveness + fairness (Doc 2 — canonical)"),
      code("├── proof/"),
      code("│   ├── SafetyKernel.v                 ← Coq: halted_is_absorbing, fail_closed"),
      code("│   └── SafetyKernelLiveness.v          ← Coq: reset_instant, liveness_fair"),
      code("├── src/"),
      code("│   ├── SafetyKernel.sol               ← on-chain kernel"),
      code("│   └── SafeERC20.sol                  ← ERC-20 enforcement hook"),
      code("├── test/"),
      code("│   └── SafetyKernel.t.sol             ← Foundry property tests"),
      code("├── audit/"),
      code("│   ├── soc2-control-matrix.md"),
      code("│   ├── invariants.md"),
      code("│   ├── gas-analysis.md"),
      code("│   └── attestation-delta-report.docx  ← this document"),
      code("├── docs/"),
      code("│   ├── T-BOOK.md                      ← Vol. I Blackbook"),
      code("│   ├── T-BOOK-V2.md                   ← Vol. II Full Smoke"),
      code("│   └── THEORY.md"),
      code("└── README.md"),

      new Paragraph({ children:[new PageBreak()], spacing:{ before:0, after:0 } }),

      // ══════════════════════════════════════════════
      // SECTION 5 — FINAL ATTESTATION
      // ══════════════════════════════════════════════
      h1("Section 5 — Final Attestation"),

      h2("5.1  Attestation Summary"),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [1800, 5760, 1800],
        rows: [
          new TableRow({ children:[
            cell("Count",   1800, { fill:C.rowH, bold:true, color:C.white }),
            cell("Category",5760, { fill:C.rowH, bold:true, color:C.white }),
            cell("Status",  1800, { fill:C.rowH, bold:true, color:C.white }),
          ]}),
          new TableRow({ children:[
            cell("8",  1800, { fill:C.rowOK }),
            cell("Claims CONFIRMED — identical or formally equivalent to canon", 5760, { fill:C.rowOK, color:C.green }),
            cell("✅ ACCEPTED",  1800, { fill:C.rowOK, bold:true, color:C.green }),
          ]}),
          new TableRow({ children:[
            cell("3",  1800, { fill:C.rowNEW }),
            cell("Claims ADDITIVE — new contributions, consistent with canon, integrate as-is", 5760, { fill:C.rowNEW, color:"1A3A8F" }),
            cell("➕ INTEGRATED",1800, { fill:C.rowNEW, bold:true, color:"1A3A8F" }),
          ]}),
          new TableRow({ children:[
            cell("1",  1800, { fill:C.rowWARN }),
            cell("Claim DELTA — liveness property variable naming; reconciled to Doc 2 as canonical (preferred)", 5760, { fill:C.rowWARN, color:C.amber }),
            cell("⚠️ RECONCILED",1800, { fill:C.rowWARN, bold:true, color:C.amber }),
          ]}),
          new TableRow({ children:[
            cell("0",  1800, { fill:C.rowOK }),
            cell("Claims in CONFLICT — none found", 5760, { fill:C.rowOK, color:C.green }),
            cell("❌ NONE",      1800, { fill:C.rowOK, bold:true, color:C.green }),
          ]}),
        ],
      }),

      new Paragraph({ children:[], spacing:{ before: 200 } }),

      h2("5.2  Formal Attestation Statement"),
      body("Having performed a systematic claim-by-claim comparison of Doc 2 (ProofBridgeLiveness.tla + Coq extension) against the established ProofBridge Liner corpus (Blackbook Vol. I and Vol. II), the following is attested:"),

      bullet("Doc 2 is formally consistent with the canon. It does not contradict any safety invariant, liveness property, gas invariant, or architectural principle established in Vols. I and II.", "b"),
      bullet("Doc 2 introduces three net-new contributions of material value: the explicit THEOREM declaration, the EXTENDS TLAPS import, and the Gallina → Yul extraction pipeline as the next power move.", "b"),
      bullet("One precision delta was identified and reconciled: liveness property variable naming. Doc 2's naming (actor, AUTHORIZED) is adopted as canonical going forward, as it correctly inherits from SafetyKernel.tla via EXTENDS.", "b"),
      bullet("The Coq pseudo-proof in Doc 2 is structurally sound. reset_instant is fully proven. liveness_fair is correctly sketched with honest ellipsis — the heavy lifting is correctly attributed to the fairness assumption, not hand-waved.", "b"),
      bullet("The weak fairness rationale in Doc 2 ('a message that can be delivered, will be delivered') is the correct deployment-assumption interpretation of WF_vars(Reset). It is attest-worthy for auditor review.", "b"),

      divider(),
      h2("5.3  Next Power Move — Attested and Queued"),
      body("Doc 2 nominates the following as the next formal step. This attestation endorses it as the correct sequencing:"),

      table2([
        row2("Step",   "Detail", true),
        row2("1. Gallina definitions", "Define State, Authority, Input, step() in Coq's Gallina language — direct translation of the Coq pseudo-proof to compilable source"),
        row2("2. Prove both theorems", "halted_is_absorbing and reset_instant as machine-checked Coq theorems using Qed — not pseudo-proof"),
        row2("3. Extract to EVM",       "Use Coq's Extraction mechanism or a certified Gallina → Yul pipeline to generate EVM bytecode whose correctness is provably tied to the Coq proof"),
        row2("4. PCR-bind the binary",  "TEE-attest the extracted bytecode — PCR11 binds the machine-checked proof to the deployed contract"),
        row2("5. SOC 2 Type II harness","Automate log aggregation and evidence packaging — operational window begins at deployment"),
      ]),

      new Paragraph({ children:[], spacing:{ before: 320 } }),
      new Paragraph({ children:[], border:{ bottom:{ style:BorderStyle.THICK, size:10, color:C.teal, space:8 } }, spacing:{ before:0, after:0 } }),
      new Paragraph({ children:[], spacing:{ before:160 } }),

      para([
        run("\"The kernel is now safe, live, and attested.  ", { italic:true, size:23, color:C.navy }),
        run("What remains is to make it machine-checked and certified.\"", { italic:true, bold:true, size:23, color:C.teal }),
      ], { align:AlignmentType.CENTER, after:80 }),

      new Paragraph({ children:[], spacing:{ before:80 } }),
      para([run("ProofBridge Liner — Attestation Report — VV Security Spine — Vaguely Vanity LLC — May 2026", { size:17, color:C.silver })],
           { align:AlignmentType.CENTER }),

    ]
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("./ProofBridge_Attestation_Report.docx", buf);
  console.log("DONE");
});