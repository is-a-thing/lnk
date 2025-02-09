import { c, Wooter } from "jsr:@bronti/wooter";
import { errorResponse, jsonResponse, redirectResponse } from "jsr:@bronti/wooter/util";

const wooter = new Wooter().useMethods();
const kv = await Deno.openKv();

const key = Deno.env.get("API_KEY");
const _value = Symbol.for('__value')

type RouteMap = {
  [x: string]: {
    [_value]: string,
    [x: string]: string | RouteMap,
  }
}

function nestObjects(objects: Deno.KvEntry<string>[]) {
  let result: RouteMap = {};

  objects.forEach(({ key: path, ...originalObject }) => {
    let current = result;
  
    // @ts-ignore:
    path.forEach((key: string, index) => {
      if(current[key] && typeof current[key] === 'string') {
        current[key] = { [_value]: current[key] }
      }

      if(index === path.length - 1) {
        current[key] = originalObject.value
      }

      current = current[key]
    });
  });

  return result;
}

function traverseAndFormat(obj: RouteMap | RouteMap[string], depth = 0) {
  let result = '';
  if(_value in obj) {
    result += ' '.repeat(depth * 4) + obj[_value] + '\n'
  }
  for (const key in obj) {
    result += ' '.repeat(depth * 4) + '/' + key + '\n';
    if (typeof obj[key] === 'object') {
      result += traverseAndFormat(obj[key], depth + 1);
    } else {
      result += ' '.repeat((depth + 1) * 4) + obj[key] + '\n';
    }
  }

  return result;
}

wooter.GET(c.chemin('list'), async ({ resp, url }) => {
  const result = kv.list<string>({ prefix: [] });
  const map = nestObjects(await Array.fromAsync(result))
  if(url.searchParams.getAll("json").length) {
    resp(jsonResponse(map))
  } else {
    resp(new Response(traverseAndFormat(map)))
  }
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
    if (result.ok) {
      resp(new Response())
    } {
      resp(errorResponse(500))
    }
  });

Deno.serve(wooter.fetch)
