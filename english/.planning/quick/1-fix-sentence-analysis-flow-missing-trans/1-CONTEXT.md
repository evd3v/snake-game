# Quick Task 1: Fix sentence analysis flow - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Task Boundary

Improve Telegram bot sentence analysis response: add sentence translation, show collocations and grammar details, mark known vs new words.

</domain>

<decisions>
## Implementation Decisions

### Message Format
- All analysis results in ONE message (not split across multiple)
- Format: original sentence → translation → vocabulary → collocations → grammar

### Known vs New Words
- Mark with ✅ (already in system) vs 🆕 (new word)
- Show count summary: "3 new, 7 known"
- Need API to check which words already have SRS cards

### Collocations Display
- Show full text + Russian translation + CEFR level
- Currently only count is shown, need to display details

### Grammar Display
- Show pattern notation + Russian description
- Currently only count is shown, need to display details

### Claude's Discretion
- Exact emoji and formatting within the agreed structure
- How to determine "known" — word exists in words table with an SRS card

</decisions>

<specifics>
## Specific Ideas

Target format agreed with user:
```
📝 The press noted she was the only black state leader...

🔄 Пресса отметила, что она была единственным чернокожим лидером штата...

📚 Vocabulary (3 new, 7 known):
  ✅ press — пресса [B1]
  🆕 note — отметила [B1]
  ✅ only — единственный [A1]
  ...

🔗 Collocations:
  state leader — лидер штата [B1]
  ...

📖 Grammar:
  • was the only + N — единственный
  • while + clause — тогда как...
```

</specifics>
