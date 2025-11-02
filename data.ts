import { normalizePath, Plugin, TFile } from "obsidian";

export interface ReviewRecord {
	[path: string]: string;
}

export const REVIEW_DATE_FORMAT = "YYYY-MM-DDTHH:mm:ss";
export const REVIEW_LEGACY_FORMATS = ["YYYY-MM-DD"] as const;
export const REVIEW_PARSE_FORMATS: string[] = [REVIEW_DATE_FORMAT, ...REVIEW_LEGACY_FORMATS];
export const REVIEW_DISPLAY_FORMAT = "YYYY-MM-DD HH:mm";

const DATA_DIRECTORY = ".obsidian/plugins";
const DATA_FILE_NAME = "data.json";

export async function loadReviewRecord(plugin: Plugin): Promise<ReviewRecord> {
	const adapter = plugin.app.vault.adapter;
	const filePath = buildDataFilePath(plugin);

	try {
		const exists = await adapter.exists(filePath);
		if (!exists) {
			return {};
		}

		const raw = await adapter.read(filePath);
		const parsed = JSON.parse(raw) as unknown;
		return sanitizeRecord(parsed);
	} catch (error) {
		console.error("ReviewCycle: failed to load data.json", error);
		return {};
	}
}

export async function saveReviewRecord(plugin: Plugin, record: ReviewRecord): Promise<void> {
	const adapter = plugin.app.vault.adapter;
	const directoryPath = buildDirectoryPath(plugin);
	const filePath = buildDataFilePath(plugin);

	try {
		const directoryExists = await adapter.exists(directoryPath);
		if (!directoryExists) {
			await adapter.mkdir(directoryPath);
		}

		const sortedPaths = Object.keys(record).sort((a, b) => a.localeCompare(b));
		const ordered: ReviewRecord = {};
		for (const path of sortedPaths) {
			ordered[path] = record[path];
		}

		await adapter.write(filePath, JSON.stringify(ordered, null, 2));
	} catch (error) {
		console.error("ReviewCycle: failed to save data.json", error);
		throw error;
	}
}

export function pruneReviewRecord(record: ReviewRecord, files: TFile[]): ReviewRecord {
	if (Object.keys(record).length === 0) {
		return {};
	}

	const existing = new Set(files.map((file) => file.path));
	const pruned: ReviewRecord = {};

	for (const [path, date] of Object.entries(record)) {
		if (existing.has(path) && typeof date === "string") {
			pruned[path] = date;
		}
	}

	return pruned;
}

function buildDirectoryPath(plugin: Plugin): string {
	const id = plugin.manifest.id;
	return normalizePath(`${DATA_DIRECTORY}/${id}`);
}

function buildDataFilePath(plugin: Plugin): string {
	return normalizePath(`${buildDirectoryPath(plugin)}/${DATA_FILE_NAME}`);
}

function sanitizeRecord(value: unknown): ReviewRecord {
	if (!value || typeof value !== "object") {
		return {};
	}

	const record: ReviewRecord = {};

	for (const [path, date] of Object.entries(value as Record<string, unknown>)) {
		if (typeof path === "string" && typeof date === "string") {
			record[path] = date;
		}
	}

	return record;
}
