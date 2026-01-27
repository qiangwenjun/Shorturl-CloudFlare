import { Hono } from "hono";
const app = new Hono<{ Bindings: Env }>();

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));
app.get("/",(c)=> c.redirect("/web/"));
app.get("/aaa", (c) => c.json({ message: "all" }));
export default app;
