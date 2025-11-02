import moment, { type Moment } from "moment";
import { ItemView, type WorkspaceLeaf } from "obsidian";
import {
	loadReviewRecord,
	REVIEW_DISPLAY_FORMAT,
	REVIEW_PARSE_FORMATS,
} from "./data";
import type ReviewCyclePlugin from "./main";

export const VIEW_TYPE_REVIEW_HISTORY = "review-cycle-history";

interface HistoryEntry {
	path: string;
	last?: Moment;
	isMissing: boolean;
	basename: string;
	fullPath: string;
}

interface HistoryRow extends HistoryEntry {
	nextReview?: Moment;
	isOverdue: boolean;
}

export class ReviewHistoryView extends ItemView {
	constructor(leaf: WorkspaceLeaf, private readonly plugin: ReviewCyclePlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_REVIEW_HISTORY;
	}

	getDisplayText(): string {
		return "Review history";
	}

	getIcon(): string {
		return "calendar";
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass("review-history-view");
		this.addAction("refresh-ccw", "Refresh history", () => {
			void this.refresh();
		});
		await this.renderView();
	}

	async refresh(): Promise<void> {
		await this.renderView();
	}

	private async renderView(): Promise<void> {
		const content = this.contentEl;
		content.empty();
		content.createEl("h2", { text: "Review history" });

		try {
			const record = await loadReviewRecord(this.plugin);
			const files = this.app.vault.getMarkdownFiles();
			const fileByPath = new Map(files.map((file) => [file.path, file]));
			const now = moment();
			const today = now.clone().startOf("day");
			const intervalDays = this.plugin.settings.reviewIntervalDays;

			const entries: HistoryEntry[] = Object.entries(record).map(([path, rawDate]) => {
				const file = fileByPath.get(path);
				const parsed = moment(rawDate, REVIEW_PARSE_FORMATS, true);
				return {
					path,
					last: parsed.isValid() ? parsed : undefined,
					isMissing: !file,
					basename: file?.basename ?? path,
					fullPath: file?.path ?? path,
				};
			});

			if (entries.length === 0) {
				const empty = content.createEl("p", { text: "No review history yet." });
				empty.addClass("review-history-empty");
				return;
			}

			const rows: HistoryRow[] = entries
				.map<HistoryRow>((entry) => {
					const nextReview = entry.last?.clone().add(intervalDays, "days");
					const nextReviewDay = nextReview?.clone().startOf("day");
					const isOverdue = Boolean(
						entry.last &&
						nextReviewDay &&
						!entry.isMissing &&
						nextReviewDay.isSameOrBefore(today, "day"),
					);
					return {
						...entry,
						nextReview,
						isOverdue,
					};
				})
				.sort((a, b) => {
					const aValue = a.last ? a.last.valueOf() : 0;
					const bValue = b.last ? b.last.valueOf() : 0;
					return bValue - aValue;
				});

			const total = rows.length;
			const missing = rows.filter((row) => row.isMissing).length;
			const overdue = rows.filter((row) => row.isOverdue).length;

			const summary = content.createEl("div", { cls: "review-history-summary" });
			summary.createEl("span", { text: `Tracked notes: ${total}` });
			summary.createEl("span", { text: `Interval: ${intervalDays} days` });
			if (overdue > 0) {
				summary.createEl("span", {
					text: `Overdue: ${overdue}`,
					cls: "review-history-summary-overdue",
				});
			}
			if (missing > 0) {
				summary.createEl("span", {
					text: `Missing files: ${missing}`,
					cls: "review-history-summary-warning",
				});
			}

			const table = content.createEl("table", { cls: "review-history-table" });
			const headRow = table.createEl("thead").createEl("tr");
			headRow.createEl("th", { text: "Note" });
			headRow.createEl("th", { text: "Last review" });
			headRow.createEl("th", { text: "Next review" });

			const body = table.createEl("tbody");

			for (const row of rows) {
				const line = body.createEl("tr", { cls: "review-history-row" });
				if (row.isOverdue) {
					line.addClass("review-history-row--overdue");
				}
				if (row.isMissing) {
					line.addClass("review-history-row--missing");
				}

				const noteCell = line.createEl("td", { cls: "review-history-note" });
				if (!row.isMissing) {
					const title = noteCell.createEl("a", {
						text: row.basename,
						href: "#",
						cls: "review-history-note-title",
					});
					title.addEventListener("click", (event) => {
						event.preventDefault();
						this.app.workspace.openLinkText(row.fullPath, "", false);
					});
					noteCell.createEl("span", {
						text: row.fullPath,
						cls: "review-history-note-path",
					});
				} else {
					noteCell.createEl("span", {
						text: row.fullPath,
						cls: "review-history-note-title",
					});
					noteCell.createEl("span", {
						text: "File not found in vault",
						cls: "review-history-note-missing",
					});
				}

				const lastCell = line.createEl("td");
				const lastWrapper = lastCell.createDiv({ cls: "review-history-date-wrapper" });
				if (row.last) {
					lastWrapper.createSpan({
						text: row.last.format(REVIEW_DISPLAY_FORMAT),
						cls: "review-history-date",
					});
					lastWrapper.createSpan({
						text: row.last.from(now),
						cls: "review-history-date-relative",
					});
				} else {
					lastWrapper.createSpan({
						text: "Invalid date",
						cls: "review-history-date-invalid",
					});
				}

				const nextCell = line.createEl("td");
				const nextWrapper = nextCell.createDiv({ cls: "review-history-date-wrapper" });
				if (row.nextReview) {
					nextWrapper.createSpan({
						text: row.nextReview.format(REVIEW_DISPLAY_FORMAT),
						cls: "review-history-date",
					});
					nextWrapper.createSpan({
						text: row.nextReview.from(now),
						cls: "review-history-date-relative",
					});
				} else {
					nextWrapper.createSpan({
						text: "-",
						cls: "review-history-date",
					});
				}
			}
		} catch (error) {
			console.error("ReviewCycle: failed to render history view", error);
			const message = content.createEl("p", {
				text: "Failed to load review history.",
			});
			message.addClass("review-history-error");
		}
	}
}
