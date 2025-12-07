// server.js (替换现有)
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

// helper: 做请求时带常见浏览器头
function browserHeaders(referer) {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    Referer: referer || "https://www.bilibili.com",
    Accept: "text/html,application/json,application/xhtml+xml",
  };
}

// 主接口：接收 ?url=BVxxx 或整链
app.get("/api/audio", async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) return res.json({ success: false, msg: "缺少 url 参数" });

  try {
    // 规范化：尝试从传入内容里抽出 bvid（BV...）或 av号
    let bvid = null;
    const bvMatch = videoUrl.match(/(BV[0-9A-Za-z]+)/);
    if (bvMatch) bvid = bvMatch[1];

    // 1) 优先用官方播放 API（当有 bvid 时）
    if (bvid) {
      try {
        const apiUrl = `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&qn=64&fnval=16`;
        const apiResp = await axios.get(apiUrl, { headers: browserHeaders("https://www.bilibili.com") , timeout: 10000});
        const audio = apiResp?.data?.data?.dash?.audio?.[0];
        const title = apiResp?.data?.data?.title || null;
        if (audio && audio.baseUrl) {
          return res.json({ success: true, title: title || bvid, audio: audio.baseUrl, source: "api" });
        }
      } catch (e) {
        console.log("API playurl failed:", e.message);
        // 继续走下面解析流程
      }
    }

    // 2) 请求视频页面，查找 window.__playinfo__（更通用）
    let html = null;
    try {
      const r = await axios.get(videoUrl, { headers: browserHeaders(videoUrl), timeout: 12000 });
      html = r.data;
    } catch (e) {
      console.log("Fetch page failed:", e.message);
      return res.json({ success: false, msg: "无法获取页面，可能被限制（需代理或 cookies）", detail: e.message });
    }

    // 从页面中尝试提取 window.__playinfo__
    try {
      const playinfoMatch = html.match(/window\.__playinfo__\s*=\s*({[\s\S]*?})\s*<\/script>/);
      if (playinfoMatch) {
        const playinfoJson = JSON.parse(playinfoMatch[1]);
        const audio = playinfoJson?.data?.dash?.audio?.[0];
        const $ = cheerio.load(html);
        const title = $("title").text().replace("_哔哩哔哩_bilibili", "").trim();
        if (audio && audio.baseUrl) {
          return res.json({ success: true, title: title || bvid || "unknown", audio: audio.baseUrl, source: "playinfo" });
        }
      }
    } catch (e) {
      console.log("parse playinfo failed:", e.message);
    }

    // 3) 退路：直接抓 "audio":[...] JSON 片段（老方法）
    try {
      const audioArrMatch = html.match(/"audio":\s*(\[[^\]]+\])/);
      if (audioArrMatch) {
        const arr = JSON.parse(audioArrMatch[1]);
        if (arr && arr.length > 0 && arr[0].baseUrl) {
          const $ = cheerio.load(html);
          const title = $("title").text().replace("_哔哩哔哩_bilibili", "").trim();
          return res.json({ success: true, title: title || bvid || "unknown", audio: arr[0].baseUrl, source: "audio_array" });
        }
      }
    } catch (e) {
      console.log("parse audio array failed:", e.message);
    }

    // 失败：返回尽可能多的调试信息给前端（便于定位）
    return res.json({ success: false, msg: "解析失败（尝试多种方法均未找到音频）", note: "可能需要登录/cookies或使用代理", source_attempted: ["api","playinfo","audio_array"] });

  } catch (err) {
    console.error("unexpected error:", err);
    return res.json({ success: false, msg: "服务器内部错误", detail: err.message });
  }
});

// 代理一把音频（解决跨域）
app.get("/proxy", async (req, res) => {
  const audioUrl = req.query.url;
  if (!audioUrl) return res.status(400).send("missing url");
  try {
    const r = await axios.get(audioUrl, { responseType: "stream", headers: browserHeaders("https://www.bilibili.com"), timeout: 12000 });
    res.setHeader("Content-Type", r.headers["content-type"] || "audio/mpeg");
    r.data.pipe(res);
  } catch (e) {
    console.error("proxy failed:", e.message);
    res.status(502).send("proxy failed: " + e.message);
  }
});

// 根页面
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

