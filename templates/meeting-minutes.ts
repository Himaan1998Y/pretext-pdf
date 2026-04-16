/**
 * Template: Meeting Minutes
 *
 * Meeting notes with attendees, agenda items, key decisions,
 * and action items tracking table with owners and deadlines.
 *
 * Usage: npx tsx templates/meeting-minutes.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const { render } = await import('../dist/index.js')

const pdf = await render({
  pageSize: 'A4',
  margins: { top: 40, bottom: 50, left: 52, right: 52 },
  defaultFontSize: 10.5,
  hyphenation: { language: 'en-us' },
  content: [
    // Header
    {
      type: 'heading',
      level: 1,
      text: 'Meeting Minutes',
      fontSize: 24,
      color: '#1a1a2e',
      spaceAfter: 4,
    },
    {
      type: 'rich-paragraph',
      fontSize: 10,
      spans: [
        { text: 'Q2 Product Planning & Engineering Sync', fontWeight: 700 },
        { text: '  |  April 17, 2026', color: '#666666' },
      ],
      spaceAfter: 12,
    },

    // Quick facts
    {
      type: 'table',
      columns: [
        { width: 120, align: 'right' },
        { width: '1*', align: 'left' },
      ],
      rows: [
        { cells: [{ text: 'Date:', fontWeight: 700 }, { text: '17 April 2026' }] },
        { cells: [{ text: 'Time:', fontWeight: 700 }, { text: '10:00 AM – 11:30 AM PST' }] },
        { cells: [{ text: 'Location:', fontWeight: 700 }, { text: 'Zoom + Conference Room B' }] },
        { cells: [{ text: 'Organizer:', fontWeight: 700 }, { text: 'Sarah Chen (VP Product)' }] },
      ],
      borderWidth: 0,
      cellPaddingH: 8,
      cellPaddingV: 4,
      spaceAfter: 14,
    },

    // Attendees
    {
      type: 'heading',
      level: 2,
      text: 'Attendees',
      fontSize: 11,
      spaceAfter: 6,
    },

    {
      type: 'table',
      columns: [
        { width: '2*', align: 'left' },
        { width: 150, align: 'left' },
        { width: 100, align: 'center' },
      ],
      rows: [
        {
          isHeader: true,
          cells: [
            { text: 'Name', fontWeight: 700 },
            { text: 'Role', fontWeight: 700 },
            { text: 'Status', fontWeight: 700 },
          ],
        },
        { cells: [{ text: 'Sarah Chen' }, { text: 'VP Product' }, { text: 'Present' }] },
        { cells: [{ text: 'James Rodriguez' }, { text: 'Engineering Lead' }, { text: 'Present' }] },
        { cells: [{ text: 'Lisa Wang' }, { text: 'Design Lead' }, { text: 'Present' }] },
        { cells: [{ text: 'Mike Thompson' }, { text: 'Backend Architect' }, { text: 'Present' }] },
        { cells: [{ text: 'Emma Davis' }, { text: 'DevOps Engineer' }, { text: 'Absent' }] },
      ],
      headerBgColor: '#f0f4ff',
      borderColor: '#dddddd',
      borderWidth: 0.5,
      cellPaddingH: 8,
      cellPaddingV: 6,
      spaceAfter: 16,
    },

    // Agenda
    {
      type: 'heading',
      level: 2,
      text: 'Agenda & Discussion',
      fontSize: 11,
      spaceAfter: 8,
    },

    {
      type: 'heading',
      level: 3,
      text: 'Q2 Feature Roadmap Review',
      fontSize: 10,
      spaceAfter: 4,
    },
    {
      type: 'list',
      style: 'unordered',
      items: [
        { text: 'New real-time dashboard feature is on track for May 15 release' },
        { text: 'Mobile app performance improvements reduced load time by 40%' },
        { text: 'Discussion on API redesign: consensus to proceed with backward compatibility layer' },
      ],
      spaceAfter: 10,
    },

    {
      type: 'heading',
      level: 3,
      text: 'Infrastructure & Scalability',
      fontSize: 10,
      spaceAfter: 4,
    },
    {
      type: 'list',
      style: 'unordered',
      items: [
        { text: 'Database replication setup is 80% complete; full rollout by May 1' },
        { text: 'Kubernetes cluster expansion approved for June (50% cost increase expected)' },
        { text: 'Emma Davis (DevOps) to provide detailed scaling plan by April 25' },
      ],
      spaceAfter: 10,
    },

    {
      type: 'heading',
      level: 3,
      text: 'Customer Feedback & Priorities',
      fontSize: 10,
      spaceAfter: 4,
    },
    {
      type: 'list',
      style: 'unordered',
      items: [
        { text: 'Top customer request: bulk export capability (scheduled for Q3)' },
        { text: 'Enterprise customers requesting SSO support (Okta integration underway)' },
        { text: 'Security audit findings: 3 medium-priority items to address by Q3 end' },
      ],
      spaceAfter: 16,
    },

    // Key Decisions
    {
      type: 'heading',
      level: 2,
      text: 'Key Decisions',
      fontSize: 11,
      spaceAfter: 8,
    },
    {
      type: 'list',
      style: 'unordered',
      items: [
        { text: 'Approved: Proceed with API v2 redesign with backward compatibility through June 2026' },
        { text: 'Approved: Allocate 20% engineering capacity to technical debt in Q2' },
        { text: 'Deferred: New reporting module pushed to Q3 due to resource constraints' },
      ],
      spaceAfter: 16,
    },

    // Action Items
    {
      type: 'heading',
      level: 2,
      text: 'Action Items',
      fontSize: 11,
      spaceAfter: 8,
    },

    {
      type: 'table',
      columns: [
        { width: '2*', align: 'left' },
        { width: 140, align: 'left' },
        { width: 120, align: 'center' },
        { width: 100, align: 'center' },
      ],
      rows: [
        {
          isHeader: true,
          cells: [
            { text: 'Action Item', fontWeight: 700 },
            { text: 'Owner', fontWeight: 700 },
            { text: 'Deadline', fontWeight: 700 },
            { text: 'Status', fontWeight: 700 },
          ],
        },
        { cells: [{ text: 'Finalize API v2 specification and documentation' }, { text: 'James Rodriguez' }, { text: 'April 24' }, { text: 'In Progress' }] },
        { cells: [{ text: 'Database replication rollout complete' }, { text: 'Emma Davis' }, { text: 'May 1' }, { text: 'In Progress' }] },
        { cells: [{ text: 'Okta SSO integration (phase 1)' }, { text: 'Mike Thompson' }, { text: 'May 10' }, { text: 'Not Started' }] },
        { cells: [{ text: 'Design mockups for real-time dashboard' }, { text: 'Lisa Wang' }, { text: 'April 20' }, { text: 'In Progress' }] },
        { cells: [{ text: 'Performance testing report for mobile app' }, { text: 'James Rodriguez' }, { text: 'April 22' }, { text: 'In Progress' }] },
        { cells: [{ text: 'Security audit findings risk assessment' }, { text: 'Sarah Chen' }, { text: 'April 19' }, { text: 'Not Started' }] },
      ],
      headerBgColor: '#1a1a2e',
      borderColor: '#dddddd',
      borderWidth: 0.5,
      cellPaddingH: 6,
      cellPaddingV: 6,
      spaceAfter: 16,
    },

    // Next Meeting
    {
      type: 'heading',
      level: 2,
      text: 'Next Meeting',
      fontSize: 11,
      spaceAfter: 6,
    },

    {
      type: 'paragraph',
      text: 'Date: Thursday, May 1, 2026 at 10:00 AM PST\nDuration: 90 minutes\nLocation: Zoom + Conference Room B\n\nPlease come prepared to discuss Q2 progress, new feature deployment status, and preliminary Q3 planning.',
      fontSize: 10.5,
      color: '#333333',
      spaceAfter: 20,
    },

    // Signature
    {
      type: 'paragraph',
      text: 'Minutes prepared by Sarah Chen\nDate: 17 April 2026',
      fontSize: 9,
      color: '#888888',
    },
  ],
})

const outPath = path.join(__dirname, 'output', 'meeting-minutes.pdf')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, pdf)

console.log(`✓ Meeting Minutes PDF: ${outPath} (${(pdf.byteLength / 1024).toFixed(1)} KB)`)
