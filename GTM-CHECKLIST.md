# GTM Launch Checklist — pretext-pdf v2.0.14 + pretext-pdf-mcp v1.5.11

**Release Date:** 2026-05-30  
**Status:** Ready for announcement  
**Owner:** [Your name]

---

## ✅ Pre-Launch Verification (COMPLETED)

### Package Registry
- [x] pretext-pdf@2.0.14 published to npm
- [x] pretext-pdf-mcp@1.5.11 published to npm
- [x] Both packages have 0 vulnerabilities
- [x] Both packages build cleanly (tsc)
- [x] Smoke test: fresh install works

### Git & Tags
- [x] Himaan1998Y/pretext → v0.0.7-patched.1 tag pushed
- [x] Himaan1998Y/pretext-pdf → v2.0.14 tag pushed
- [x] Himaan1998Y/pretext-pdf-mcp → v1.5.11 tag pushed
- [x] All commits pushed to origin/main

### Documentation
- [x] CHANGELOG.md entries added (both repos)
- [x] UPSTREAM.md updated with vendor provenance
- [x] VERSION.ts matches fork commit SHA
- [x] README.md files are current

### Testing
- [x] pretext-pdf: 337/337 tests passing
- [x] pretext-pdf-mcp: 240/244 tests passing (expected)
- [x] No TypeScript compilation errors
- [x] No security vulnerabilities reported

---

## 📢 Launch Announcement (DO THIS NOW)

### [ ] 1. GitHub Releases

**For each repository, create a Release:**

#### pretext-pdf v2.0.14
Go to: https://github.com/Himaan1998Y/pretext-pdf/releases/new

```
Tag: v2.0.14
Title: pretext-pdf v2.0.14 — Upgraded Text Layout Engine

Description:
[Copy from GTM-RELEASE-NOTES.md, "pretext-pdf v2.0.14" section]

Mark as: Latest release
```

#### pretext-pdf-mcp v1.5.11
Go to: https://github.com/Himaan1998Y/pretext-pdf-mcp/releases/new

```
Tag: v1.5.11
Title: pretext-pdf-mcp v1.5.11 — Synced with pretext-pdf v2.0.14

Description:
[Copy from GTM-RELEASE-NOTES.md, "pretext-pdf-mcp v1.5.11" section]

Mark as: Latest release
```

#### pretext (fork) v0.0.7-patched.1
Go to: https://github.com/Himaan1998Y/pretext/releases/new

```
Tag: v0.0.7-patched.1
Title: v0.0.7-patched.1 — Clean Rebase + 11 Cherry-Picked Improvements

Description:
Rebased clean onto upstream v0.0.7. Includes:
• German low-opening-quote fix („)
• Bidi surrogate handling
• Trailing collapsible space reconstruction
• Stream-friendly chunk layout
• No-op merge pass optimization

+ upstream v0.0.7 improvements (22 commits)
```

---

### [ ] 2. Twitter/X Announcement

Post from your account (or @pretext_pdf if you have a team account):

Use **Post 1 (Main Announcement)** from GTM-SOCIAL-ASSETS.md

**Timing:** 9am local time (when your audience is active)

**Action:**
1. Go to https://twitter.com/compose/tweet
2. Paste the tweet text
3. Add image (optional — screenshot of npm page or feature graphic)
4. Pin this tweet to your profile
5. Reply with **Post 2 (Technical Deep Dive)** as a thread

---

### [ ] 3. LinkedIn Announcement

Post from your personal or company account:

Use **Main Announcement** from GTM-SOCIAL-ASSETS.md

**Action:**
1. Go to https://www.linkedin.com/feed/
2. Click "Start a post"
3. Paste the LinkedIn version
4. Add relevant hashtags (#PDF #OpenSource #TypeScript #AI)
5. Tag collaborators if applicable

---

### [ ] 4. npm Registry Announcement

Go to: https://www.npmjs.com/package/pretext-pdf

1. Verify the package shows v2.0.14 as latest
2. Check the "Versions" tab shows the new release
3. Verify GitHub link points to the correct release

Do the same for pretext-pdf-mcp.

---

### [ ] 5. Email to Stakeholders

Send email to:
- Early users / beta testers
- Team members
- Related projects (anyone who mentioned pretext-pdf)

**Subject:** pretext-pdf v2.0.14 — Major Layout Engine Upgrade

**Body:** Use email copy from GTM-SOCIAL-ASSETS.md

---

## 📊 Post-Launch Metrics (Track over 1 week)

Track these in a spreadsheet:

| Metric | Baseline | Day 1 | Day 3 | Day 7 |
|--------|----------|-------|-------|-------|
| npm weekly downloads | ~[current] | +10%? | +15%? | +20%? |
| GitHub stars (both repos) | [current] | +5? | +10? | +15? |
| GitHub issues (quality/spam) | [current] | Monitor | Monitor | Monitor |
| Twitter impressions | — | [record] | [record] | [record] |
| npm.org page visits | — | [record] | [record] | [record] |
| GitHub traffic (from npm/social) | — | [record] | [record] | [record] |

**How to measure:**
- npm: `npm view pretext-pdf` → check "downloads per week"
- GitHub: Go to Insights → Traffic → check referrers
- Twitter: Go to Analytics on your tweets (in post notifications)

---

## 📝 Documentation Housekeeping

### [ ] 1. Update README Headlines

In both repos, ensure top section mentions v2.0.14:

```markdown
# pretext-pdf v2.0.14

> The PDF library AI agents speak natively — and humans love writing.
> Now with upgraded text layout (pretext v0.0.7).
```

### [ ] 2. Update GitHub About / Description

**For Himaan1998Y/pretext-pdf:**
```
📄 Serverless PDF generation for AI agents (v2.0.14). 
No Chromium, strict TypeScript, 337+ tests. Invoices, reports, resumes.
```

**For Himaan1998Y/pretext-pdf-mcp:**
```
🤖 MCP server for Claude, Cursor, Windsurf. Generate PDFs via pretext-pdf v2.0.14.
```

**For Himaan1998Y/pretext:**
```
Text layout engine (v0.0.7-patched.1). Vendored by pretext-pdf. 
MIT licensed. 22 upstream commits + 11 patches.
```

### [ ] 3. Add GitHub Topics

Go to: https://github.com/Himaan1998Y/pretext-pdf/settings

Add topics:
- `pdf-generation`
- `pdf`
- `typescript`
- `ai`
- `agents`
- `mcp`
- `declarative`
- `serverless`

---

## 🎯 Outreach & Community

### [ ] 1. Open Source Communities

- [ ] Post in Hacker News (https://news.ycombinator.com/submit)
  - Title: "pretext-pdf v2.0.14: Serverless PDF generation for AI agents"
  - Avoid self-promotion tone; focus on technical achievement

- [ ] Post in r/typescript (if you're active there)
  - Title: "[Release] pretext-pdf v2.0.14 — improved text layout"
  - Include: npm link, GitHub link, feature highlights

- [ ] Post in r/node (if applicable)
  - Similar approach

### [ ] 2. Direct Outreach (Optional)

Send a brief note to:
- Cheng Lou (pretext upstream author) — thank for the foundation
- Any projects using pretext-pdf — highlight the upgrade

Email template:
```
Hi [Name],

We just released pretext-pdf v2.0.14, which upgrades to the new 
pretext v0.0.7 text layout engine. Better CJK handling, smarter 
punctuation, and 7-12% performance gains.

[Link to release]

Would love your feedback if you get a chance to try it!

Best,
[Your name]
```

### [ ] 3. Documentation Links

Update any internal wikis or documentation that reference pretext-pdf:
- Add link to [GitHub release](https://github.com/Himaan1998Y/pretext-pdf/releases/tag/v2.0.14)
- Update version numbers in examples
- Add to changelog/updates page (if you have one)

---

## 🚀 Follow-Up Actions (Next 1-2 weeks)

### [ ] 1. Monitor Issues

Watch for:
- New bug reports (respond within 24hrs)
- Upgrade feedback (was migration smooth?)
- Feature requests (log them for future planning)

**Action:** Triage and label all new issues

### [ ] 2. Collect Feedback

Send a survey or informal poll:
- "Did you upgrade? How did it go?"
- "Did you hit any issues?"
- "What would help you most in the next version?"

### [ ] 3. Write a Blog Post (Optional)

Write a detailed post about:
- Why the upgrade was necessary
- How the text layout engine works
- Performance benchmarks
- Migration guide (if needed)

**Publish on:**
- Medium (https://medium.com)
- Dev.to (https://dev.to)
- Hashnode (https://hashnode.com)
- Your personal blog

---

## 📋 Communication Log

### Day 1 (Release Day)
- [ ] Created GitHub releases (all 3 repos)
- [ ] Posted on Twitter
- [ ] Posted on LinkedIn
- [ ] Sent email to stakeholders
- [ ] **Time:** [HH:MM]

### Day 2
- [ ] Posted on Hacker News (if applicable)
- [ ] Responded to initial feedback
- [ ] Verified npm page is updated
- [ ] **Time:** [HH:MM]

### Day 3
- [ ] Checked metrics/analytics
- [ ] Responded to GitHub issues
- [ ] Posted "update" thread on Twitter (metrics/feedback)
- [ ] **Time:** [HH:MM]

### Day 7
- [ ] Weekly metrics review
- [ ] Summarize feedback
- [ ] Plan for next version
- [ ] **Time:** [HH:MM]

---

## 🎁 Bonus: Milestone Asset

Consider creating a "milestone card" to share:

```
📦 SHIPPED

pretext-pdf v2.0.14
+ pretext-pdf-mcp v1.5.11

Upgraded text layout engine
Better CJK, faster renders, zero breaking changes

Download now: npm install pretext-pdf@2.0.14

Built for AI agents. Made for humans.
```

---

## 🔗 Quick Links

- **GitHub (pretext-pdf):** https://github.com/Himaan1998Y/pretext-pdf
- **npm (pretext-pdf):** https://www.npmjs.com/package/pretext-pdf
- **GitHub (pretext-pdf-mcp):** https://github.com/Himaan1998Y/pretext-pdf-mcp
- **npm (pretext-pdf-mcp):** https://www.npmjs.com/package/pretext-pdf-mcp
- **Demo:** https://himaan1998y.github.io/pretext-pdf/
- **Release Notes:** [GTM-RELEASE-NOTES.md](./GTM-RELEASE-NOTES.md)
- **Social Assets:** [GTM-SOCIAL-ASSETS.md](./GTM-SOCIAL-ASSETS.md)

---

**Last updated:** 2026-05-30  
**Status:** Ready to launch 🚀
