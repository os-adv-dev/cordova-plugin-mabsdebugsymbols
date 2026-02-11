const fs = require('fs');
const path = require('path');
const axios = require('axios');

const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB

module.exports = async function(filePath, baseUrl, username, password) {
  const stat = await fs.promises.stat(filePath);
  const fileSize = stat.size;
  const fileName = path.basename(filePath);

  // 1) Start upload
  let appName = "MyApp";
  const startRes = await axios.post(
    `${baseUrl}/Uploads/Start/${encodeURIComponent(appName)}`,
    { fileName, fileSize, contentType: "application/zip" },
    { auth: { username, password } }
  );

  const uploadId = startRes.data.uploadId;
  if (!uploadId) throw new Error("No uploadId returned from start endpoint");

  const partCount = Math.ceil(fileSize / CHUNK_SIZE);
  const parts = [];

  // Simple retry helper
  async function withRetry(fn, { retries = 4, delayMs = 500 } = {}) {
    let lastErr;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        if (i === retries) break;
        await new Promise(r => setTimeout(r, delayMs * (i + 1)));
      }
    }
    throw lastErr;
  }

  // 2) Upload parts
  for (let partNumber = 1; partNumber <= partCount; partNumber++) {
    const start = (partNumber - 1) * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileSize) - 1; // inclusive
    const partSize = end - start + 1;

    const stream = fs.createReadStream(filePath, { start, end });

    const partRes = await withRetry(() =>
      axios.put(
        `${baseUrl}/Uploads/${encodeURIComponent(uploadId)}/Parts/${partNumber}`,
        stream,
        {
          auth: { username, password },
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Length": partSize,
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          },
          maxBodyLength: Infinity,
        }
      )
    );

    const etag = partRes.headers.etag || partRes.data?.etag;
    if (!etag) {
      // Some APIs don’t return ETag; you might return a checksum or nothing.
      // Keep something stable if the API needs it at completion time.
      parts.push({ partNumber });
    } else {
      parts.push({ partNumber, etag: String(etag).replaceAll('"', "") });
    }

    console.log(`Uploaded part ${partNumber}/${partCount} (${partSize} bytes)`);
  }

  // 3) Complete upload
  const completeRes = await axios.post(
    `${baseUrl}/Uploads/${encodeURIComponent(uploadId)}/Complete`,
    { parts },
    { auth: { username, password } }
  );

  return completeRes.data;
}