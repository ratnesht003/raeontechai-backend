import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import axios from 'axios';
import * as dotenv from 'dotenv';

import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

dotenv.config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

let vectorStore = undefined;

// ✅ Fixed Local Fake Embeddings
class LocalFakeEmbeddings {
  modelName = 'fake';
  embedDimensions = 1536;

  async embedDocuments(texts) {
    return texts.map(() => Array(this.embedDimensions).fill(0.1));
  }

  async embedQuery(text) {
    return Array(this.embedDimensions).fill(0.1);
  }

  get numDimensions() {
    return this.embedDimensions;
  }
}

// ✅ Live News Context via RapidAPI
async function getLiveContext(query) {
  try {
    const response = await axios.get('https://real-time-news-data.p.rapidapi.com/search-news', {
      params: {
        query,
        limit: 5,
        country: 'US',
        lang: 'en'
      },
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
        'x-rapidapi-host': 'real-time-news-data.p.rapidapi.com'
      }
    });

    const articles = response.data?.data || [];
    const snippets = articles
      .map(article => `📰 ${article.title}\n${article.text}`)
      .join('\n\n');

    return snippets.slice(0, 2000);
  } catch (error) {
    console.error('🔥 Live news error:', error.message);
    return null;
  }
}

// ✅ Ask Endpoint (Ollama + News + Vector Fallback)
// ✅ Ask Endpoint (Simulated response for demo)
app.post('/api/ask', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Missing question.' });
    }

    console.log('👉 Received question:', question);

    // ✅ Simulated response only
    const simulatedAnswer = `🧠 Simulated AI: You asked — "${question}". This is a pretend answer.`;

    return res.json({ answer: simulatedAnswer });

  } catch (err) {
    console.error('🔥 /api/ask error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Upload Endpoint (No OpenAI Required)
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded.' });

    const filePath = path.resolve(file.path);
    console.log('📄 Uploaded PDF:', filePath);

    const loader = new PDFLoader(filePath);
    const docs = await loader.load();

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const chunks = await splitter.splitDocuments(docs);

    const fakeEmbeddings = new LocalFakeEmbeddings();
    vectorStore = await Chroma.fromDocuments(chunks, fakeEmbeddings);

    fs.unlinkSync(filePath);
    res.json({ status: '✅ PDF uploaded and embedded successfully.' });
  } catch (err) {
    console.error('🔥 /api/upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Start Server
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});




