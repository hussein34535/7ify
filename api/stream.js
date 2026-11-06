export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // In cloud serverless environments without yt-dlp binary,
  // return 502 to trigger the client-side instant master preview playback.
  return res.status(502).json({
    error: 'stream_unavailable',
    message: 'Backend audio extractor not available in serverless mode. Using client CDN fallback.'
  });
}
