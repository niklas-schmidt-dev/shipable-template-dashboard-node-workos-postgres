import cookieParser from "cookie-parser";
import express, { type ErrorRequestHandler } from "express";
import { registerRoutes } from "./routes.js";
import { noStore, securityHeaders } from "./security.js";

const port = Number(process.env.PORT ?? 8787);

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(securityHeaders);
app.use("/api", noStore);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

registerRoutes(app);

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error("Unexpected API error", error);
  response.status(500).json({
    error: "Unexpected API error",
  });
};

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Shipable Node API listening on http://localhost:${port}`);
});
