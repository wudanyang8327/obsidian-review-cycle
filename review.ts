import moment from "moment";
import type { TFile } from "obsidian";
import type { ReviewRecord } from "./data";
import { REVIEW_PARSE_FORMATS } from "./data";
import type { ReviewPluginSettings } from "./settings";

export function selectNotesForReview(
	files: TFile[],
	record: ReviewRecord,
	settings: ReviewPluginSettings,
): TFile[] {
	const eligible = filterEligibleFiles(files, record, settings.reviewIntervalDays);
	return shuffle(eligible);
}

function filterEligibleFiles(
	files: TFile[],
	record: ReviewRecord,
	reviewIntervalDays: number,
): TFile[] {
	const now = moment().startOf("day");

	return files.filter((file) => {
		const rawDate = record[file.path];
		if (!rawDate) {
			return true;
		}

		const parsed = moment(rawDate, REVIEW_PARSE_FORMATS, true);
		if (!parsed.isValid()) {
			return true;
		}

		const parsedDay = parsed.clone().startOf("day");

		if (parsedDay.isAfter(now)) {
			return false;
		}

		const diff = now.diff(parsedDay, "days");
		return diff >= reviewIntervalDays;
	});
}

function shuffle<T>(items: T[]): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}
