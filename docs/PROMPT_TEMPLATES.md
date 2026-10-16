# Templates for ongoing work

## Change request
```
Change: <what should change, in one sentence>
Why: <the user need or problem>
Who it affects: <patient / nutritionist / doctor / clinic staff / lead>
Acceptance criteria:
- [ ] ...
Read CLAUDE.md first. Propose the change and the files you will touch, wait for my OK, then build it with tests.
```

## Bug report
```
Bug: <what happens>
Expected: <what should happen>
Steps: 1. ... 2. ... 3. ...
Role and device: <role, phone or desktop, browser>
Write a failing test that reproduces it first, then fix it, then show me the test passing.
```

## Review
```
Review the last change against CLAUDE.md, docs/DESIGN.md and docs/COMPLIANCE.md.
List: bugs, security or privacy risks, rule breaches, copy that breaks the copy rules, missing tests.
Do not change code in this step.
```

## Clinical change
```
The clinical lead approved this change to scoring: <change>.
Update docs/SCORING.md, bump SCORE_VERSION, update the config and tests, and keep old snapshots unchanged.
```
