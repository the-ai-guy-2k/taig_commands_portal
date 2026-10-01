import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  KNOWLEDGE_DIRECTORY_CANDIDATE,
  REQUIRED_JSON_FILES,
  REQUIRED_JSON_FILENAMES,
} from "./constants";
import { knowledgeError, type KnowledgeError } from "./errors";
import { isRecord } from "./guards";

export interface ByteFile {
  filename: string;
  absolutePath: string;
  bytes: Buffer;
  sha256: string;
  sizeBytes: number;
}

export interface JsonFile extends ByteFile {
  value?: unknown;
  parseError?: string;
}

export interface ReadKnowledgePackage {
  directory: string | null;
  inspected: string[];
  jsonFiles: Map<string, JsonFile>;
  byteFiles: Map<string, ByteFile | null>;
  errors: KnowledgeError[];
}

function hashBuffer(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readBytes(directory: string, filename: string): Promise<ByteFile | null> {
  const absolutePath = path.join(directory, filename);
  try {
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) {
      return null;
    }
    const bytes = await readFile(absolutePath);
    return {
      filename,
      absolutePath,
      bytes,
      sha256: hashBuffer(bytes),
      sizeBytes: bytes.length,
    };
  } catch {
    return null;
  }
}

function parseJsonFile(file: ByteFile): JsonFile {
  const text = file.bytes.toString("utf8");
  try {
    return { ...file, value: JSON.parse(text) as unknown };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invalid JSON";
    return { ...file, parseError: detail };
  }
}

export async function directoryContainsDataset(directory: string): Promise<boolean> {
  const file = await readBytes(directory, REQUIRED_JSON_FILES.dataset);
  return file !== null;
}

export async function resolveKnowledgeDirectory(packageRoot: string): Promise<{
  directory: string | null;
  inspected: string[];
}> {
  const inspected = [packageRoot];
  if (await directoryContainsDataset(packageRoot)) {
    return { directory: packageRoot, inspected };
  }
  const nested = path.join(packageRoot, KNOWLEDGE_DIRECTORY_CANDIDATE);
  inspected.push(nested);
  if (await directoryContainsDataset(nested)) {
    return { directory: nested, inspected };
  }
  return { directory: null, inspected };
}

function manifestFilenames(manifest: JsonFile | undefined): string[] {
  if (!manifest?.value || !isRecord(manifest.value) || !Array.isArray(manifest.value.files)) {
    return [];
  }
  return manifest.value.files.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.filename !== "string") {
      return [];
    }
    return [entry.filename];
  });
}

export async function readKnowledgePackage(packageRoot: string): Promise<ReadKnowledgePackage> {
  const resolved = await resolveKnowledgeDirectory(packageRoot);
  const errors: KnowledgeError[] = [];
  const jsonFiles = new Map<string, JsonFile>();
  const byteFiles = new Map<string, ByteFile | null>();

  if (!resolved.directory) {
    errors.push(
      knowledgeError(
        "MISSING_FILE",
        `Cisco command dataset was not found in ${resolved.inspected.join(" or ")}.`,
        REQUIRED_JSON_FILES.dataset,
      ),
    );
    return {
      directory: null,
      inspected: resolved.inspected,
      jsonFiles,
      byteFiles,
      errors,
    };
  }

  for (const filename of REQUIRED_JSON_FILENAMES) {
    const bytes = await readBytes(resolved.directory, filename);
    if (!bytes) {
      errors.push(
        knowledgeError("MISSING_FILE", `Required knowledge file is missing: ${filename}`, filename),
      );
      continue;
    }
    const parsed = parseJsonFile(bytes);
    jsonFiles.set(filename, parsed);
    if (parsed.parseError) {
      errors.push(
        knowledgeError(
          "INVALID_JSON",
          `${filename} is not valid JSON: ${parsed.parseError}`,
          filename,
        ),
      );
    }
  }

  const manifest = jsonFiles.get(REQUIRED_JSON_FILES.manifest);
  for (const filename of manifestFilenames(manifest)) {
    if (jsonFiles.has(filename) || byteFiles.has(filename)) {
      continue;
    }
    const bytes = await readBytes(resolved.directory, filename);
    byteFiles.set(filename, bytes);
    if (!bytes) {
      errors.push(
        knowledgeError(
          "MISSING_FILE",
          `Manifest lists ${filename}, but the file is missing.`,
          filename,
        ),
      );
    }
  }

  return {
    directory: resolved.directory,
    inspected: resolved.inspected,
    jsonFiles,
    byteFiles,
    errors,
  };
}

export function bytesForFilename(
  parsed: ReadKnowledgePackage,
  filename: string,
): ByteFile | null {
  const jsonFile = parsed.jsonFiles.get(filename);
  if (jsonFile) {
    return jsonFile;
  }
  return parsed.byteFiles.get(filename) ?? null;
}
