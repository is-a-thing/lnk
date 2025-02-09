import { c, Wooter } from "jsr:@bronti/wooter";
import { errorResponse, redirectResponse } from "jsr:@bronti/wooter/util";

const wooter = new Wooter().useMethods();
const kv = await Deno.openKv();

const key = Deno.env.get("API_KEY");

wooter.route(c.chemin(c.pMultiple(c.pString("pathParts"), false)))
  .GET(async ({ resp, params: { pathParts } }) => {
    const result = await kv.get<string>(pathParts);
    let destination: string;
    
    if (result.value) {
      destination = result.value
    } else {
      destination = `https://github.com/is-a-thing/lnk`
    }
    resp(redirectResponse(destination, {
      status: 302,
    }));
  }).POST(async ({ request, resp, params: { pathParts } }) => {
    if (request.headers.get("Authorization") !== key) {
      return resp(errorResponse(401, "Not Authorized"));
    }

    const path = new URL(await request.text());
    const result = await kv.set(pathParts, path.toString())
    if(result.ok) {
      resp(new Response())
    } {
      resp(errorResponse(500))
    }
  });

Deno.serve(wooter.fetch)
