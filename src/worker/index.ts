import { Hono } from "hono";
const app = new Hono<{ Bindings: Env }>();

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));
app.get("/",(c)=> c.redirect("/web/"));
app.get("/web/*",(c)=>
{

    const url = c.req.path.replace("/web/", "");
    console.log(url);
    return c.env.ASSETS.fetch("https://assets.local/"+url);
});
app.get("*", (c) => c.json({ message: "all" }));
export default app;
