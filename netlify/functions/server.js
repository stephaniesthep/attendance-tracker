import { createRequestHandler } from "@react-router/express";
import { installGlobals } from "@react-router/node";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import serverless from "serverless-http";

installGlobals();

const viteDevServer =
  process.env.NODE_ENV === "production"
    ? undefined
    : await import("vite").then((vite) =>
        vite.createServer({
          server: { middlewareMode: true },
        })
      );

const app = express();

// Handle asset requests
if (viteDevServer) {
  app.use(viteDevServer.ssrLoadModule);
} else {
  // Serve assets files from build/client/assets
  app.use(
    "/assets",
    express.static("build/client/assets", { immutable: true, maxAge: "1y" })
  );
}

// Serve static files from build/client
app.use(express.static("build/client", { maxAge: "1h" }));

app.use(compression());

// Disable x-powered-by header
app.disable("x-powered-by");

// Add logging
app.use(morgan("tiny"));

// Handle SSR requests
app.all(
  "*",
  createRequestHandler({
    build: viteDevServer
      ? () => viteDevServer.ssrLoadModule("virtual:react-router/server-build")
      : await import("../../build/server/index.js"),
  })
);

export const handler = serverless(app);