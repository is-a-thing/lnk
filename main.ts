import { c, Wooter } from "jsr:@bronti/wooter";
import { errorResponse, redirectResponse } from "jsr:@bronti/wooter/util";

const wooter = new Wooter().useMethods();
const kv = await Deno.openKv();

const key = Deno.env.get("API_KEY");

function nestObjects(objects: Deno.KvEntry<string>[]) {
  let result = {};
  
  objects.forEach(({ key, ...obj }) => {
    let current = result;
    
    key.forEach((k, index) => {
      if (!current[k]) {
        current[k] = {};
      }
      
      if (index === key.length - 1) {
        current[k] = obj.value;
      }
      
      current = current[k];
    });
  });
  
  return result;
}

function traverseAndFormat(obj, depth = 0) {
  let result = '';
  
  for (const key in obj) {
    result += ' '.repeat(depth * 4) + '/' + key + '\n';
    
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      result += traverseAndFormat(obj[key], depth + 1);
    } else {
      result += ' '.repeat((depth + 1) * 4) + obj[key] + '\n';
    }
  }
  
  return result;
}

wooter.GET(c.chemin('list'), async ({ resp }) => {
  const result = kv.list<string>({ prefix: [] });
  const map = nestObjects(await Array.fromAsync(result))

  resp(new Response(traverseAndFormat(map)))
})

wooter.route(c.chemin(c.pMultiple(c.pString("pathParts"), true)))
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
