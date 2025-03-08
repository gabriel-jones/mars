import { env } from "process";

// Determine the port from Heroku or default to 3000
const port = Number(env.PORT) || 3000;

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    // Default file path points to the built assets in "dist"
    let filePath = `./dist${url.pathname}`;

    // Serve index.html if the root or if the file isn’t found
    if (url.pathname === "/" || url.pathname === "/index.html") {
      filePath = "./dist/index.html";
    }

    try {
      return new Response(Bun.file(filePath));
    } catch (error) {
      return new Response("404 Not Found", { status: 404 });
    }
  },
});

console.log(`Listening on http://localhost:${server.port}`);
