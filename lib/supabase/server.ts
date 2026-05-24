import { createClient } from "@supabase/supabase-js";

// Mock Supabase client for local development fallback mode
class MockQueryBuilder {
  private client: MockSupabaseClient;
  private action: "insert" | "select" | "update" | "delete" | null = null;
  private payload: any = null;
  private filters: { column: string; value: any }[] = [];
  private selectFields: string | null = null;
  private isSingle: boolean = false;

  constructor(client: MockSupabaseClient) {
    this.client = client;
  }

  insert(record: any) {
    this.action = "insert";
    this.payload = record;
    return this;
  }

  select(fields: string = "*") {
    this.selectFields = fields;
    if (this.action === null) {
      this.action = "select";
    }
    return this;
  }

  update(fields: any) {
    this.action = "update";
    this.payload = fields;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, value });
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  async then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    try {
      const result = await this.execute();
      if (onfulfilled) {
        return onfulfilled(result);
      }
      return result;
    } catch (err) {
      if (onrejected) {
        return onrejected(err);
      }
      throw err;
    }
  }

  private async execute() {
    const data = (this.client as any).readData();
    let resultData: any = null;
    let error: any = null;

    if (this.action === "insert") {
      const crypto = require("node:crypto");
      const id = crypto.randomUUID();
      const newRecord = {
        id,
        created_at: new Date().toISOString(),
        status: "pending",
        kpis: null,
        notes: "",
        error_details: null,
        payload: null,
        ...this.payload,
      };
      data.push(newRecord);
      (this.client as any).writeData(data);
      resultData = newRecord;
    } 
    else if (this.action === "select") {
      let filtered = data.filter((item: any) => {
        return this.filters.every(f => item[f.column] === f.value);
      });
      resultData = filtered;
    } 
    else if (this.action === "update") {
      let updatedCount = 0;
      const updatedData = data.map((item: any) => {
        const matches = this.filters.every(f => item[f.column] === f.value);
        if (matches) {
          updatedCount++;
          return { ...item, ...this.payload };
        }
        return item;
      });
      if (updatedCount > 0) {
        (this.client as any).writeData(updatedData);
      }
      resultData = updatedData.filter((item: any) => {
        return this.filters.every(f => item[f.column] === f.value);
      });
    } 
    else if (this.action === "delete") {
      const initialLen = data.length;
      const remaining = data.filter((item: any) => {
        return !this.filters.every(f => item[f.column] === f.value);
      });
      if (remaining.length < initialLen) {
        (this.client as any).writeData(remaining);
      }
      resultData = { count: initialLen - remaining.length };
    }

    if (this.isSingle) {
      if (Array.isArray(resultData)) {
        if (resultData.length === 0) {
          resultData = null;
          error = { message: "No rows found" };
        } else {
          resultData = resultData[0];
        }
      }
    }

    return { data: resultData, error };
  }
}

class MockSupabaseClient {
  private filePath: string;

  constructor() {
    const path = require("node:path");
    const baseDir = process.cwd();
    if (!baseDir.endsWith("schedule-platform")) {
      this.filePath = path.resolve(baseDir, "schedule-platform", "local_optimizations.json");
    } else {
      this.filePath = path.resolve(baseDir, "local_optimizations.json");
    }
  }

  private readData(): any[] {
    const fs = require("node:fs");
    if (!fs.existsSync(this.filePath)) {
      return [];
    }
    try {
      const content = fs.readFileSync(this.filePath, "utf8");
      return JSON.parse(content);
    } catch (e) {
      console.error("Error reading local_optimizations.json:", e);
      return [];
    }
  }

  private writeData(data: any[]) {
    const fs = require("node:fs");
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      console.error("Error writing to local_optimizations.json:", e);
    }
  }

  from(table: string) {
    if (table !== "optimizations") {
      throw new Error(`Mock only supports table "optimizations", got "${table}"`);
    }
    return new MockQueryBuilder(this);
  }
}

// Read-only Supabase client used by the Next.js server to fetch the latest
// platform snapshot. Uses the publishable (anon) key.
export function createReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
    
  if (!key && process.env.NODE_ENV !== "production") {
    // If we have no keys and are in local mode, we return a mock reader
    return new MockSupabaseClient() as any;
  }
  
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY as a fallback)",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "schedule-platform" } },
  });
}

// Write client used securely on the Next.js server side to perform administrative
// mutations (like creating, updating, and deleting optimization runs).
export function createWriteClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // local development fallback safety gate
  if (!key && process.env.NODE_ENV !== "production") {
    console.warn(
      "[Local Fallback] SUPABASE_SERVICE_ROLE_KEY is missing in local development. Returning local file-based database mock client."
    );
    return new MockSupabaseClient() as any;
  }

  if (!url || !key) {
    throw new Error(
      "Missing Supabase server credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.",
    );
  }
  // RPCs (insert_optimization, etc.) live in public schema. Do NOT set
  // db.schema to analytics — PostgREST does not expose that schema (PGRST106).
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "schedule-platform-api" } },
  });
}
