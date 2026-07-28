import { spawn } from "node:child_process";
import { mkdir, open, readFile, rm, stat } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(projectRoot, ".env");
const lockPath = path.join(projectRoot, ".tmp", "production-data-sync.lock");

class SyncAbortError extends Error {}

await main().catch((error) => {
  if (!(error instanceof SyncAbortError)) {
    console.error(error);
  }
  process.exitCode = 1;
});

async function main() {
  await loadEnvFile(envPath);

  const transferUrl = process.env.STRAPI_TRANSFER_URL?.trim();
  const transferToken = process.env.STRAPI_TRANSFER_TOKEN?.trim();

  if (!transferUrl || !transferToken) {
    abort(
      "Missing STRAPI_TRANSFER_URL or STRAPI_TRANSFER_TOKEN. Add both to .env; " +
        "see README.md for setup instructions."
    );
  }

  let parsedTransferUrl;
  try {
    parsedTransferUrl = new URL(transferUrl);
  } catch {
    abort("STRAPI_TRANSFER_URL must be a valid http:// or https:// URL.");
  }

  if (!["http:", "https:"].includes(parsedTransferUrl.protocol)) {
    abort("STRAPI_TRANSFER_URL must use http:// or https://.");
  }

  const databaseClient = process.env.DATABASE_CLIENT?.trim() || "sqlite";
  if (databaseClient !== "sqlite") {
    abort(
      `Safe local backups are configured for SQLite, but DATABASE_CLIENT is ${databaseClient}. ` +
        "Aborting before changing any data."
    );
  }

  const port = parsePort(process.env.PORT);
  if (await isPortOpen(port)) {
    abort(`Port ${port} is already in use. Stop the local Strapi server before pulling data.`);
  }

  await mkdir(path.dirname(lockPath), { recursive: true });
  const lock = await acquireLock(lockPath);

  try {
    const databasePath = resolveDatabasePath();
    const backupPath = await backupDatabase(databasePath);

    if (backupPath) {
      console.log(`Local database backup: ${path.relative(projectRoot, backupPath)}`);
    } else {
      console.log("No local database exists yet; no backup was needed.");
    }

    console.log("Pulling production content and configuration (R2 objects are excluded)...");

    const exitCode = await runPnpm([
      "strapi",
      "transfer",
      "--from",
      transferUrl,
      "--from-token",
      transferToken,
      "--exclude",
      "files",
      "--force",
    ]);

    if (exitCode !== 0) {
      abort(
        `Production data pull failed with exit code ${exitCode}.` +
          (backupPath
            ? ` The pre-sync backup is ${path.relative(projectRoot, backupPath)}.`
            : "")
      );
    }

    console.log("Local content now matches production.");
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }

  if (process.argv.includes("--start")) {
    console.log("Starting Strapi in development mode...");
    process.exitCode = await runPnpm(["dev"]);
  }
}

function abort(message) {
  console.error(`Data sync aborted: ${message}`);
  throw new SyncAbortError(message);
}

async function loadEnvFile(filename) {
  let contents;

  try {
    contents = await readFile(filename, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u.exec(line);
    if (!match || process.env[match[1]] !== undefined) continue;

    process.env[match[1]] = parseEnvValue(match[2]);
  }
}

function parseEnvValue(rawValue) {
  if (rawValue.length >= 2 && rawValue.startsWith('"') && rawValue.endsWith('"')) {
    return rawValue
      .slice(1, -1)
      .replaceAll("\\n", "\n")
      .replaceAll("\\r", "\r")
      .replaceAll('\\"', '"')
      .replaceAll("\\\\", "\\");
  }

  if (rawValue.length >= 2 && rawValue.startsWith("'") && rawValue.endsWith("'")) {
    return rawValue.slice(1, -1);
  }

  return rawValue.replace(/\s+#.*$/u, "").trim();
}

function parsePort(rawPort) {
  const value = Number.parseInt(rawPort || "1337", 10);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    abort("PORT must be an integer between 1 and 65535.");
  }
  return value;
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });

    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

async function acquireLock(filename) {
  try {
    const handle = await open(filename, "wx");
    await handle.writeFile(`${process.pid}\n`, "utf8");
    return handle;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;

    const existingPid = await readLockPid(filename);
    if (existingPid && isProcessRunning(existingPid)) {
      abort(`Another production data pull is already running (PID ${existingPid}).`);
    }

    await rm(filename, { force: true });
    const handle = await open(filename, "wx");
    await handle.writeFile(`${process.pid}\n`, "utf8");
    return handle;
  }
}

async function readLockPid(filename) {
  try {
    const value = Number.parseInt((await readFile(filename, "utf8")).trim(), 10);
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function resolveDatabasePath() {
  const configuredPath = process.env.DATABASE_FILENAME?.trim() || ".tmp/data.db";
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(projectRoot, configuredPath);
}

async function backupDatabase(databasePath) {
  try {
    await stat(databasePath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }

  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const backupDirectory = path.join(projectRoot, ".tmp", "backups");
  const backupPath = path.join(backupDirectory, `data-${timestamp}.db`);

  await mkdir(backupDirectory, { recursive: true });

  const database = new Database(databasePath, { fileMustExist: true });
  try {
    await database.backup(backupPath);
  } finally {
    database.close();
  }

  return backupPath;
}

function runPnpm(args) {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const configDirectory = path.join(projectRoot, ".tmp", "strapi-config");

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: {
        ...process.env,
        XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || configDirectory,
      },
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        console.error(`Command stopped by signal ${signal}.`);
        resolve(1);
        return;
      }
      resolve(code ?? 1);
    });
  });
}
