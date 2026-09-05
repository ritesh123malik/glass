import server from "../dist/server/index.js";

export const config = {
  runtime: "edge",
};

export default async function handler(request) {
  try {
    const fetcher =
      typeof server?.fetch === "function"
        ? server.fetch
        : typeof server?.default?.fetch === "function"
        ? server.default.fetch
        : typeof server?.default === "function"
        ? server.default
        : typeof server === "function"
        ? server
        : null;

    if (!fetcher) {
      throw new Error(
        `Could not find fetch handler in server bundle. Module keys: ${Object.keys(
          server || {},
        ).join(", ")}`,
      );
    }

    return await fetcher(request, process.env);
  } catch (error) {
    console.error("[vercel-api-handler] SSR Error:", error);
    return new Response(
      `Internal Server Error\n\n${error instanceof Error ? error.stack : String(error)}`,
      {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      },
    );
  }
}
