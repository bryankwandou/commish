/**
 * Attribution storage. A click on a creator's link is remembered here, and the
 * shop's order webhook is matched back to it.
 *
 * A file is enough for a demo and keeps the whole thing runnable with no
 * database; swapping in Postgres means replacing these four functions.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const FILE = process.env.COMMISH_DB ?? join(process.cwd(), "commish-db.json");

type Db = {
  creators: Record<string, { wallet: string; handle: string }>; // code -> creator
  clicks: Record<string, string>; // visitor id -> code
  orders: Record<string, { wallet: string; signature: string }>;
};

const empty: Db = { creators: {}, clicks: {}, orders: {} };

function read(): Db {
  if (!existsSync(FILE)) return { ...empty };
  try {
    return { ...empty, ...JSON.parse(readFileSync(FILE, "utf8")) };
  } catch {
    return { ...empty };
  }
}

function write(db: Db) {
  writeFileSync(FILE, JSON.stringify(db, null, 2));
}

export async function addCreator(code: string, wallet: string, handle: string) {
  const db = read();
  db.creators[code] = { wallet, handle };
  write(db);
}

export async function recordClick(visitorId: string, code: string) {
  const db = read();
  if (db.creators[code]) {
    db.clicks[visitorId] = code;
    write(db);
  }
}

export async function attributionFor(orderId: string, code?: string) {
  const db = read();
  if (code && db.creators[code]) return db.creators[code];
  return null;
}

export async function recordPayout(
  orderId: string,
  wallet: string,
  signature: string,
) {
  const db = read();
  db.orders[String(orderId)] = { wallet, signature };
  write(db);
}

export function snapshot() {
  return read();
}
