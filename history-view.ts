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

			const list = content.createDiv({ cls: "review-history-list" });
			for (const row of rows) {
				const item = list.createDiv({ cls: "review-history-item" });
				if (row.isOverdue) item.addClass("is-overdue");
				if (row.isMissing) item.addClass("is-missing");
				item.addClass("is-compact");

				const note = item.createDiv({ cls: "review-history-item-note" });
				const truncated = (value: string) => (value.length > 20 ? value.slice(0, 20) + "…" : value);
				if (!row.isMissing) {
					const title = note.createEl("a", {
						text: truncated(row.basename),
						href: "#",
						cls: "review-history-item-title",
					});
					title.title = row.fullPath;
					title.addEventListener("click", (e) => {
						e.preventDefault();
						this.app.workspace.openLinkText(row.fullPath, "", false);
					});
				} else {
					note.createEl("span", { text: truncated(row.basename), cls: "review-history-item-title" });
					note.createSpan({ text: "(missing)", cls: "review-history-item-missing" });
				}

				const dates = item.createDiv({ cls: "review-history-item-dates" });
				const lastSpan = dates.createSpan({ cls: "review-history-item-date" });
				if (row.last) {
					lastSpan.textContent = row.last.format("MM-DD HH:mm");
					lastSpan.title = row.last.format(REVIEW_DISPLAY_FORMAT) + " | " + row.last.from(now);
				} else {
					lastSpan.textContent = "-";
					lastSpan.title = "Invalid date";
				}

				const nextSpan = dates.createSpan({ cls: "review-history-item-date" });
				if (row.nextReview) {
					nextSpan.textContent = row.nextReview.format("MM-DD HH:mm");
					nextSpan.title = row.nextReview.format(REVIEW_DISPLAY_FORMAT) + " | " + row.nextReview.from(now);
				} else {
					nextSpan.textContent = "-";
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
