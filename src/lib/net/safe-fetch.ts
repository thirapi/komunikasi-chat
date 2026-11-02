import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { isIP, type LookupFunction } from "node:net";
import http from "node:http";
import https from "node:https";
import { isPublicAddress } from "./public-address";

/**
 * Server-side GET of a user-supplied URL without opening an SSRF hole. Same
 * protections as the media proxy (app/api/media-proxy): http(s) only, no
 * credentials in the URL, every hop including redirects must resolve to a
 * public IP and the check runs inside the socket's own DNS lookup (so the
 * validated address is the one connected to, no DNS-rebinding window), plus a
 * content-type allow-list, size cap, timeout and redirect limit.
 */

export class SafeFetchError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = (addresses as unknown as LookupAddress[]) ?? [];
    const publicOnes = list.filter((a) => isPublicAddress(a.address));
    if (publicOnes.length === 0 || publicOnes.length !== list.length) {
      return callback(new SafeFetchError(403, "Blocked address"), "", 4);
    }
    if ((options as { all?: boolean }).all) return (callback as any)(null, publicOnes);
    callback(null, publicOnes[0].address, publicOnes[0].family);
  });
};

export interface SafeFetchOptions {
  accept: string;
  /** Content types to accept (checked on the final response). */
  allowedType: RegExp;
  maxBytes: number;
  timeoutMs: number;
  maxRedirects?: number;
  /**
   * Stop reading once this many bytes arrived instead of failing (an HTML
   * page's <head> is all a link preview needs).
   */
  truncateAt?: number;
}

type Hop = { status: number; headers: http.IncomingHttpHeaders; body?: Buffer };

function fetchOnce(url: URL, opts: SafeFetchOptions): Promise<Hop> {
  return new Promise((resolve, reject) => {
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return reject(new SafeFetchError(400, "Unsupported protocol"));
    }
    if (url.username || url.password) return reject(new SafeFetchError(400, "Credentials in URL"));
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(host) && !isPublicAddress(host)) return reject(new SafeFetchError(403, "Blocked address"));

    const client = url.protocol === "https:" ? https : http;
    const req = client.get(
      url,
      {
        lookup: safeLookup,
        timeout: opts.timeoutMs,
        headers: {
          // Many sites only serve Open Graph tags to crawlers they recognise.
          "User-Agent": "Mozilla/5.0 (compatible; KomunikasiBot/1.0; +https://komunikasi.qzz.io)",
          Accept: opts.accept,
          "Accept-Language": "id,en;q=0.8",
        },
      },
      (res) => {
        const status = res.statusCode ?? 502;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, headers: res.headers });
        }
        if (status !== 200) {
          res.resume();
          return reject(new SafeFetchError(status === 404 ? 404 : 502, "Upstream error"));
        }
        const type = String(res.headers["content-type"] || "").split(";")[0].trim();
        if (!opts.allowedType.test(type)) {
          res.destroy();
          return reject(new SafeFetchError(415, "Unsupported media type"));
        }
        if (!opts.truncateAt && Number(res.headers["content-length"] || 0) > opts.maxBytes) {
          res.destroy();
          return reject(new SafeFetchError(413, "Too large"));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve({ status, headers: res.headers, body: Buffer.concat(chunks) });
        };
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (opts.truncateAt && size >= opts.truncateAt) {
            chunks.push(chunk);
            res.destroy();
            finish();
            return;
          }
          if (size > opts.maxBytes) {
            res.destroy();
            reject(new SafeFetchError(413, "Too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", finish);
        res.on("error", (e) => (done ? undefined : reject(e)));
      },
    );
    req.on("timeout", () => req.destroy(new SafeFetchError(504, "Timeout")));
    req.on("error", reject);
  });
}

export async function safeFetch(
  rawUrl: string,
  opts: SafeFetchOptions,
): Promise<{ url: URL; contentType: string; body: Buffer }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SafeFetchError(400, "Invalid url");
  }
  const maxRedirects = opts.maxRedirects ?? 3;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const result = await fetchOnce(url, opts);
    if (result.body) {
      const contentType = String(result.headers["content-type"] || "").split(";")[0].trim();
      return { url, contentType, body: result.body };
    }
    const location = result.headers.location;
    if (!location) throw new SafeFetchError(502, "Bad redirect");
    url = new URL(location, url);
  }
  throw new SafeFetchError(508, "Too many redirects");
}
