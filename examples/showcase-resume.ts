/**
 * Showcase: Professional Resume / CV
 * Clean single-page CV layout using pretext-pdf
 */
import { render } from '../dist/index.js'
import { writeFileSync, mkdirSync } from 'fs'
mkdirSync('output', { recursive: true })

const pdf = await render({
  pageSize: 'A4',
  margins: { top: 40, bottom: 40, left: 52, right: 52 },
  defaultFontSize: 10,
  content: [
    // Name + Title
    { type: 'heading', level: 1, text: 'Himanshu Jain', fontSize: 24, color: '#1a1a2e', spaceAfter: 2 },
    { type: 'paragraph', text: 'AI Systems Architect  ·  Entrepreneur  ·  Gurugram, India', fontSize: 11, color: '#555555', spaceAfter: 3 },
    { type: 'rich-paragraph', fontSize: 10, spans: [
      { text: 'himanshu@antigravity.dev', color: '#0070f3' },
      { text: '  ·  github.com/Himaan1998Y', color: '#555555' },
      { text: '  ·  linkedin.com/in/himanshu-jain', color: '#555555' },
      { text: '  ·  +91 98765 43210', color: '#555555' },
    ], spaceAfter: 6 },
    { type: 'hr', color: '#1a1a2e', thickness: 1.5, spaceBelow: 10 },

    // Summary
    { type: 'heading', level: 3, text: 'PROFILE', fontSize: 9, color: '#888888', letterSpacing: 2, smallCaps: true, spaceAfter: 4 },
    { type: 'paragraph', text: 'Founder and AI architect with 4+ years building AI-powered products and automation systems. Deep expertise in LLM integration, multi-agent orchestration, and data pipeline architecture. Built and scaled multiple ventures from 0 to 1 in real estate, legal tech, and SaaS.', spaceAfter: 10 },

    // Experience
    { type: 'heading', level: 3, text: 'EXPERIENCE', fontSize: 9, color: '#888888', letterSpacing: 2, smallCaps: true, spaceAfter: 6 },

    { type: 'rich-paragraph', fontSize: 11, spans: [
      { text: 'Founder & CEO', fontWeight: 700 },
      { text: '  ·  Antigravity Systems Pvt. Ltd.', color: '#333333' },
      { text: '  ·  2022 – Present', color: '#888888' },
    ], spaceAfter: 4 },
    { type: 'list', style: 'unordered', fontSize: 10, spaceAfter: 8, items: [
      { text: 'Built AI infrastructure platform serving 12+ enterprise clients; Rs.2.4Cr ARR' },
      { text: 'Designed multi-agent content pipeline processing 500+ articles/month autonomously' },
      { text: 'Led technical delivery for LLM fine-tuning projects (GPT-4, Claude, Mistral)' },
      { text: 'Open-sourced pretext-pdf — declarative PDF generator with 2K+ npm weekly downloads' },
    ]},

    { type: 'rich-paragraph', fontSize: 11, spans: [
      { text: 'Co-Founder', fontWeight: 700 },
      { text: '  ·  KS Lodhi Realty & Buildwell', color: '#333333' },
      { text: '  ·  2020 – Present', color: '#888888' },
    ], spaceAfter: 4 },
    { type: 'list', style: 'unordered', fontSize: 10, spaceAfter: 8, items: [
      { text: 'Family real estate business: 32 active property listings, Rs.180Cr portfolio under management' },
      { text: 'Built full-stack lead generation platform (Next.js + Supabase); reduced sales cycle by 40%' },
      { text: 'Automated market analysis reports using AI; 3 senior brokers replaced with 1 agent pipeline' },
    ]},

    { type: 'rich-paragraph', fontSize: 11, spans: [
      { text: 'Product & Strategy Consultant', fontWeight: 700 },
      { text: '  ·  Multiple startups (contract)', color: '#333333' },
      { text: '  ·  2021 – 2022', color: '#888888' },
    ], spaceAfter: 4 },
    { type: 'list', style: 'unordered', fontSize: 10, spaceAfter: 10, items: [
      { text: 'Product strategy and 0 to 1 technical roadmaps for 5 early-stage SaaS companies' },
      { text: 'Built automation workflows saving clients 20-40 hrs/week each' },
    ]},

    // Skills
    { type: 'heading', level: 3, text: 'SKILLS & TECHNOLOGIES', fontSize: 9, color: '#888888', letterSpacing: 2, smallCaps: true, spaceAfter: 6 },
    {
      type: 'table',
      columns: [{ width: 110 }, { width: '1*' }],
      rows: [
        { cells: [{ text: 'AI / ML', fontWeight: 700 }, { text: 'LLM APIs (OpenAI, Anthropic, Google), fine-tuning, RAG, vector DBs (Pinecone, LanceDB), multi-agent systems' }] },
        { cells: [{ text: 'Backend', fontWeight: 700 }, { text: 'Node.js, TypeScript, Python, Supabase (PostgreSQL), Redis, REST/GraphQL APIs' }] },
        { cells: [{ text: 'Frontend', fontWeight: 700 }, { text: 'Next.js 14 (App Router), React, Tailwind CSS, Framer Motion' }] },
        { cells: [{ text: 'Infrastructure', fontWeight: 700 }, { text: 'Docker, Coolify, OVH VPS, Cloudflare, n8n, PM2, GitHub Actions CI/CD' }] },
        { cells: [{ text: 'Business', fontWeight: 700 }, { text: 'Real estate (Haryana NCR market), revenue modeling, B2B sales, product strategy' }] },
      ],
      borderColor: '#e8e8e8',
      borderWidth: 0.5,
      cellPaddingH: 8,
      cellPaddingV: 5,
      spaceAfter: 10,
    },

    // Education
    { type: 'heading', level: 3, text: 'EDUCATION', fontSize: 9, color: '#888888', letterSpacing: 2, smallCaps: true, spaceAfter: 6 },
    { type: 'rich-paragraph', fontSize: 10, spans: [
      { text: 'B.E. Mechanical Engineering + MBA (Management)', fontWeight: 700 },
      { text: '  ·  2018–2022', color: '#888888' },
    ], spaceAfter: 3 },
    { type: 'paragraph', text: 'Thapar Institute of Engineering & Technology, Patiala  ·  GPA: 8.4/10', fontSize: 10, color: '#444444', spaceAfter: 10 },

    // Footer note
    { type: 'hr', color: '#e0e0e0', spaceBelow: 6 },
    { type: 'paragraph', text: 'References available on request  ·  This CV was generated programmatically using pretext-pdf (npm: pretext-pdf)', fontSize: 8, color: '#aaaaaa', align: 'center' },
  ],
})

writeFileSync('output/showcase-resume.pdf', pdf)
console.log(`Done: showcase-resume.pdf  (${(pdf.byteLength / 1024).toFixed(0)} KB)`)
