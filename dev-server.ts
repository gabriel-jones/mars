import { serve } from "bun";
import { join, extname, resolve } from "path";
import { readFileSync, existsSync } from "fs";

const PORT = 8080;
const PROJECT_ROOT = import.meta.dir;
const PUBLIC_DIR = join(PROJECT_ROOT, "public");

// MIME types for different file extensions
const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "font/eot",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".ts": "application/javascript", // Serve TypeScript as JavaScript
};

console.log(`Starting development server on http://localhost:${PORT}`);

// Serve the application
serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;

    // Default to index.html for root path
    if (path === "/") {
      path = "/index.html";
    }

    // Handle source files with Bun's transpiler
    if (path.startsWith("/src/") && path.endsWith(".ts")) {
      try {
        const filePath = join(PROJECT_ROOT, path);
        if (existsSync(filePath)) {
          const transpiled = await Bun.build({
            entrypoints: [filePath],
            target: "browser",
            minify: false,
            sourcemap: "inline",
          });

          const output = await transpiled.outputs[0].text();
          return new Response(output, {
            headers: { "Content-Type": "application/javascript" },
          });
        }
      } catch (error) {
        console.error(`Error transpiling ${path}:`, error);
        return new Response(`Error transpiling ${path}: ${error.message}`, {
          status: 500,
        });
      }
    }

    // Try to serve from project root first (for index.html)
    let filePath = join(PROJECT_ROOT, path);

    // If not found in project root, try public directory
    if (!existsSync(filePath)) {
      filePath = join(PUBLIC_DIR, path);
    }

    try {
      if (existsSync(filePath)) {
        const ext = extname(filePath);
        const contentType = MIME_TYPES[ext] || "application/octet-stream";
        const file = Bun.file(filePath);

        return new Response(file, {
          headers: { "Content-Type": contentType },
        });
      } else {
        // If the file doesn't exist, return a 404
        return new Response("Not Found", { status: 404 });
      }
    } catch (error) {
      console.error(`Error serving ${path}:`, error);
      return new Response(`Error serving ${path}: ${error.message}`, {
        status: 500,
      });
    }
  },
});

console.log(`Development server running at http://localhost:${PORT}`);
console.log("Press Ctrl+C to stop");
