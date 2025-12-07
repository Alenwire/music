// server.js (修正版)
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000; // 只声明一次

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

function browserHeaders(referer) {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    Referer: referer || "https://www.bilibili.com",
    Accept: "text/html,application/json,application/xhtml+xml",
  };
}

// 你的 API 路由保持不变
app.get("/api/audio", async (req, res) => {
  // ...这里保持你原来的逻辑
});

// 代理路由
app.get("/proxy", async (req, res) => {
  // ...保持原逻辑
});

// 根页面
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 只调用一次 app.listen()
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
