/**
 * Template: Professional Resume / CV
 *
 * One-page resume with sections: header, summary, experience, education, skills.
 * Features: clean typography, bullet points, section separators, skill table.
 *
 * Usage: npx tsx templates/resume.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const { render } = await import('../dist/index.js')

const pdf = await render({
  pageSize: 'A4',
  margins: { top: 40, bottom: 40, left: 52, right: 52 },
  defaultFontSize: 10,
  hyphenation: { language: 'en-us' },
  content: [
    // Name + Title
    {
      type: 'heading',
      level: 1,
      text: 'Alex Morgan',
      fontSize: 24,
      color: '#1a1a2e',
      spaceAfter: 2,
    },
    {
      type: 'paragraph',
      text: 'Full Stack Engineer  ·  San Francisco, CA  ·  alex.morgan@email.com',
      fontSize: 10.5,
      color: '#555555',
      spaceAfter: 1,
    },
    {
      type: 'rich-paragraph',
      fontSize: 9.5,
      spans: [
        { text: '+1 (415) 555-0123', color: '#555555' },
        { text: '  ·  linkedin.com/in/alexmorgan', color: '#0070f3', url: 'https://linkedin.com' },
        { text: '  ·  github.com/alexmorgan', color: '#0070f3', url: 'https://github.com' },
      ],
      spaceAfter: 8,
    },
    {
      type: 'hr',
      color: '#1a1a2e',
      thickness: 1,
      spaceBelow: 10,
    },

    // Summary
    {
      type: 'heading',
      level: 3,
      text: 'PROFILE',
      fontSize: 8.5,
      color: '#888888',
      letterSpacing: 2,
      smallCaps: true,
      spaceAfter: 4,
    },
    {
      type: 'paragraph',
      text: 'Full-stack engineer with 6+ years building scalable web applications. Deep expertise in React, Node.js, TypeScript, and cloud infrastructure (AWS, GCP). Strong track record of leading feature development from design through production deployment.',
      fontSize: 9.5,
      spaceAfter: 10,
    },

    // Experience
    {
      type: 'heading',
      level: 3,
      text: 'EXPERIENCE',
      fontSize: 8.5,
      color: '#888888',
      letterSpacing: 2,
      smallCaps: true,
      spaceAfter: 6,
    },

    {
      type: 'rich-paragraph',
      fontSize: 10.5,
      spans: [
        { text: 'Senior Full Stack Engineer', fontWeight: 700 },
        { text: '  ·  TechFlow Inc.', color: '#333333' },
        { text: '  ·  2023 – Present', color: '#888888' },
      ],
      spaceAfter: 3,
    },
    {
      type: 'list',
      style: 'unordered',
      fontSize: 9.5,
      spaceAfter: 8,
      items: [
        { text: 'Led redesign of core analytics dashboard — 40% faster, used by 5K+ users daily' },
        { text: 'Architected microservices migration reducing API response time from 800ms to 120ms' },
        { text: 'Mentored team of 4 junior engineers; conducted 20+ code reviews and technical interviews' },
      ],
    },

    {
      type: 'rich-paragraph',
      fontSize: 10.5,
      spans: [
        { text: 'Full Stack Engineer', fontWeight: 700 },
        { text: '  ·  StartupXYZ', color: '#333333' },
        { text: '  ·  2020 – 2023', color: '#888888' },
      ],
      spaceAfter: 3,
    },
    {
      type: 'list',
      style: 'unordered',
      fontSize: 9.5,
      spaceAfter: 10,
      items: [
        { text: 'Built customer-facing React app from scratch; launched with 100K+ signups in month 1' },
        { text: 'Implemented CI/CD pipeline with GitHub Actions reducing deployment time to 2 minutes' },
        { text: 'Scaled PostgreSQL database to handle 10M+ queries/day with query optimization' },
      ],
    },

    // Education
    {
      type: 'heading',
      level: 3,
      text: 'EDUCATION',
      fontSize: 8.5,
      color: '#888888',
      letterSpacing: 2,
      smallCaps: true,
      spaceAfter: 6,
    },

    {
      type: 'rich-paragraph',
      fontSize: 10.5,
      spans: [
        { text: 'B.S. Computer Science', fontWeight: 700 },
        { text: '  ·  University of California, Berkeley', color: '#333333' },
        { text: '  ·  2018', color: '#888888' },
      ],
      spaceAfter: 8,
    },

    // Skills
    {
      type: 'heading',
      level: 3,
      text: 'SKILLS & TECHNOLOGIES',
      fontSize: 8.5,
      color: '#888888',
      letterSpacing: 2,
      smallCaps: true,
      spaceAfter: 6,
    },

    {
      type: 'table',
      columns: [
        { width: '1*', align: 'left' },
        { width: '1*', align: 'left' },
      ],
      rows: [
        {
          cells: [
            { text: 'Frontend: React, TypeScript, TailwindCSS, Next.js', fontSize: 9 },
            { text: 'Backend: Node.js, Express, GraphQL, REST APIs', fontSize: 9 },
          ],
        },
        {
          cells: [
            { text: 'Databases: PostgreSQL, MongoDB, Redis', fontSize: 9 },
            { text: 'Cloud: AWS (EC2, S3, Lambda), GCP, Docker', fontSize: 9 },
          ],
        },
        {
          cells: [
            { text: 'Testing: Jest, React Testing Library, Cypress', fontSize: 9 },
            { text: 'DevOps: GitHub Actions, Kubernetes, Terraform', fontSize: 9 },
          ],
        },
      ],
      borderWidth: 0,
      cellPaddingH: 6,
      cellPaddingV: 4,
      spaceAfter: 8,
    },

    // Certifications
    {
      type: 'heading',
      level: 3,
      text: 'CERTIFICATIONS',
      fontSize: 8.5,
      color: '#888888',
      letterSpacing: 2,
      smallCaps: true,
      spaceAfter: 4,
    },

    {
      type: 'list',
      style: 'unordered',
      fontSize: 9.5,
      items: [
        { text: 'AWS Certified Solutions Architect – Professional (2024)' },
        { text: 'Google Cloud Professional Data Engineer (2023)' },
      ],
    },
  ],
})

const outPath = path.join(__dirname, 'output', 'resume.pdf')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, pdf)

console.log(`✓ Resume PDF: ${outPath} (${(pdf.byteLength / 1024).toFixed(1)} KB)`)
