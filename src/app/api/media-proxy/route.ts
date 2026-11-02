import { NextRequest, NextResponse } from "next/server";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { isIP, type LookupFunction } from "node:net";
import http from "node:http";
import https from "node:https";
import { getUserSessionFromRequest } from "@/app/auth.action";
import { isPublicAddress } from "@/lib/net/public-address";

export const runtime = "nodejs";

/**
 * Image/video proxy for remote attachments (e.g. federated media), so the
 * viewer's IP is not leaked to third-party hosts.
 *
 * Hardened against the ways an open proxy gets abused:
 *  - signed-in users only (it is not a public bandwidth relay);
 *  - http(s) only, and every hop (including redirects) must resolve to a
 *    public IP — the check runs inside the socket's DNS lookup, so the address
 *    that was validated is the one connected to (no DNS-rebinding window);
 *  - only raster images, video and audio are passed through (no HTML, no SVG), with
 *    `nosniff` and a sandboxing CSP, so the proxy can never serve active
 *    content from this origin;
 *  - size cap, timeout and redirect limit.
 */

const MAX_BYTES = 25 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
// Audio is passive media like video (voice notes); same nosniff + sandbox CSP.
const ALLOWED_TYPE = /^(image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)|video\/(mp4|webm|ogg|quicktime)|audio\/(webm|ogg|mp4|mpeg|aac|x-m4a|wav))$/i;

class ProxyError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** DNS lookup that refuses non-public addresses; used by the socket itself. */
const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = (addresses as unknown as LookupAddress[]) ?? [];
    const publicOnes = list.filter((a) => isPublicAddress(a.address));
    if (publicOnes.length === 0 || publicOnes.length !== list.length) {
      return callback(new ProxyError(403, "Blocked address"), "", 4);
    }
    if ((options as { all?: boolean }).all) return (callback as any)(null, publicOnes);
    callback(null, publicOnes[0].address, publicOnes[0].family);
  });
};

function fetchOnce(url: URL): Promise<{ status: number; headers: http.IncomingHttpHeaders; body?: Buffer }> {
  return new Promise((resolve, reject) => {
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return reject(new ProxyError(400, "Unsupported protocol"));
    }
    if (url.username || url.password) return reject(new ProxyError(400, "Credentials in URL"));
    // Literal IPs skip DNS, so check them here.
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(host) && !isPublicAddress(host)) return reject(new ProxyError(403, "Blocked address"));

    const client = url.protocol === "https:" ? https : http;
    const req = client.get(
      url,
      { lookup: safeLookup, timeout: TIMEOUT_MS, headers: { "User-Agent": "Komunikasi/1.0", Accept: "image/*,video/*,audio/*" } },
      (res) => {
        const status = res.statusCode ?? 502;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, headers: res.headers });
        }
        if (status !== 200) {
          res.resume();
          return reject(new ProxyError(status === 404 ? 404 : 502, "Upstream error"));
        }
        const type = String(res.headers["content-type"] || "").split(";")[0].trim();
        if (!ALLOWED_TYPE.test(type)) {
          res.destroy();
          return reject(new ProxyError(415, "Unsupported media type"));
        }
        if (Number(res.headers["content-length"] || 0) > MAX_BYTES) {
          res.destroy();
          return reject(new ProxyError(413, "Too large"));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            res.destroy();
            reject(new ProxyError(413, "Too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new ProxyError(504, "Timeout")));
    req.on("error", reject);
  });
}

export async function GET(request: NextRequest) {
  const session = await getUserSessionFromRequest(request);
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) return new NextResponse("Missing url parameter", { status: 400 });

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const result = await fetchOnce(url);
      if (result.body) {
        const type = String(result.headers["content-type"]).split(";")[0].trim();
        return new NextResponse(new Uint8Array(result.body), {
          headers: {
            "Content-Type": type,
            "Content-Length": String(result.body.length),
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Content-Disposition": "inline",
            // Per-user now that the proxy requires a session.
            "Cache-Control": "private, max-age=86400",
          },
        });
      }
      const location = result.headers.location;
      if (!location) throw new ProxyError(502, "Bad redirect");
      url = new URL(location, url);
    }
    throw new ProxyError(508, "Too many redirects");
  } catch (err) {
    const status = err instanceof ProxyError ? err.status : 502;
    return new NextResponse("Failed to fetch media", { status });
  }
}
