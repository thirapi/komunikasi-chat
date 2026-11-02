import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";
import ws from "ws";
import * as schema from "./infrastructure/drizzle/schema";

if (process.env.NODE_ENV !== "production") {
    neonConfig.webSocketConstructor = ws;
}

const url = process.env.DATABASE_URL!;

/**
 * The Neon serverless driver talks to Neon's WebSocket proxy and cannot reach a
 * plain Postgres, so a local database (docker compose up -d postgres) uses
 * node-postgres instead. Same drizzle API either way; production is unchanged.
 */
function isLocal(connectionString: string) {
    try {
        return ["localhost", "127.0.0.1", "::1", "[::1]", "postgres", "host.docker.internal"].includes(
            new URL(connectionString).hostname,
        );
    } catch {
        return false;
    }
}

function createDb() {
    if (isLocal(url)) {
        return drizzlePg(new PgPool({ connectionString: url }), { schema }) as unknown as ReturnType<
            typeof drizzle<typeof schema>
        >;
    }
    return drizzle(new Pool({ connectionString: url }), { schema });
}

export const db = createDb();
