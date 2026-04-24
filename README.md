# Revenue Insight Agent

AI-powered business intelligence for small retailers.

**Live Demo:** https://srutee48.github.io/revenue-insight-agent/

## What It Does
- Upload a CSV of sales transactions
- Stores data in normalized MySQL schema
- Analyzes trends via local LLM (Ollama/Llama 3.2)
- Generates plain-English business recommendations

## Tech Stack
- **Backend:** Node.js, Express, Multer (file upload)
- **Database:** MySQL (relational schema with foreign keys)
- **AI:** Ollama (local LLM inference, zero API cost)
- **Frontend:** Vanilla HTML/CSS/JS (drag-and-drop)

## Architecture
Browser → Express API → MySQL (storage)
↓
Ollama LLM (analysis)
↓
JSON Response (report)


## Local Setup
```bash
git clone https://github.com/Srutee48/revenue-insight-agent.git
cd revenue-insight-agent
npm install

# 1. Start MySQL and create database
mysql -u root -p < database/schema.sql

# 2. Start Ollama
ollama run llama3.2

# 3. Start server
node backend/server.js

# 4. Open http://localhost:3000 or open index.html directly