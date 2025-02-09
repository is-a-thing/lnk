import { c, Wooter } from "jsr:@bronti/wooter";
import { errorResponse, redirectResponse } from "jsr:@bronti/wooter/util";

const wooter = new Wooter().useMethods();
const kv = await Deno.openKv();

const key = Deno.env.get("API_KEY");

function nestObjects(objects: Deno.KvEntry<string>[]) {
  let result = {};
  
  objects.forEach(({ key: path, ...originalObject }) => {
    let current = result;
    
    path.forEach((key, index) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      
      if (index === path.length - 1) {
        if (typeof originalObject === 'object') {
          current[k] = originalObject;
        } else {
          current[key]._value = originalObject;
        }
      }
      
      current = current[key];
    });
  });
  
  return result;
}

function traverseAndFormat(obj, depth = 0) {
  let result = '';
  
  for (const key in obj) {
    if (key === '_value') {
      result += ' '.repeat(depth * 4) + obj[key] + '\n';
      continue;
    }
    
    result += ' '.repeat(depth * 4) + '/' + key + '\n';
    if (typeof obj[key] === 'object') {
      result += traverseAndFormat(obj[key], depth + 1);
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
