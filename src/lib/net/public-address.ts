import { isIP } from "node:net";

/**
 * True only for globally routable unicast addresses. Used to stop server-side
 * fetches (media proxy) from reaching localhost, private networks, link-local
 * cloud metadata (169.254.169.254) and other reserved ranges.
 */
function ipv4ToInt(ip: string) {
  return ip.split(".").reduce((n, part) => (n << 8) + Number(part), 0) >>> 0;
}

function inRange(ip: string, cidr: string) {
  const [base, bits] = cidr.split("/");
  const mask = bits === "0" ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const BLOCKED_V4 = [
  "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16",
  "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24", "192.168.0.0/16", "198.18.0.0/15",
  "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
];

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !BLOCKED_V4.some((cidr) => inRange(address, cidr));
  if (family === 6) {
    const a = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
    if (mapped) return isPublicAddress(mapped[1]);
    if (a === "::" || a === "::1") return false;
    if (/^f[cd]/.test(a)) return false; // fc00::/7 unique local
    if (/^fe[89ab]/.test(a)) return false; // fe80::/10 link local
    if (/^ff/.test(a)) return false; // multicast
    if (a.startsWith("64:ff9b:") || a.startsWith("2001:db8:")) return false;
    return true;
  }
  return false;
}

