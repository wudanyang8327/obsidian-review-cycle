import moment, { type Moment } from "moment";
import { ItemView, type WorkspaceLeaf } from "obsidian";
import {
	loadReviewRecord,
	saveReviewRecord,
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
	private searchQuery = "";
	private searchDraft = "";
	private shouldRefocusSearch = false;

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

		const searchBar = content.createDiv({ cls: "review-history-search" });
		const searchInput = searchBar.createEl("input", {
			cls: "review-history-search-input",
			attr: { type: "search", placeholder: "Search notes" },
		});
		if (!this.searchDraft) {
			this.searchDraft = this.searchQuery;
		}
		searchInput.value = this.searchDraft;
		searchInput.addEventListener("input", () => {
			this.searchDraft = searchInput.value;
		});
		searchInput.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				this.applySearch();
			}
		});

		const searchButton = searchBar.createEl("button", {
			cls: "review-history-search-button",
			text: "Search",
		});
		searchButton.addEventListener("click", (event) => {
			event.preventDefault();
			this.applySearch();
		});

		if (this.shouldRefocusSearch) {
			this.shouldRefocusSearch = false;
			window.setTimeout(() => {
				searchInput.focus({ preventScroll: true });
				const len = searchInput.value.length;
				searchInput.setSelectionRange(len, len);
			}, 0);
		}

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

			const processedRows: HistoryRow[] = entries
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

			const query = this.searchQuery.toLowerCase();
			const filteredRows = query
				? processedRows.filter((row) =>
					row.fullPath.toLowerCase().includes(query) ||
					row.basename.toLowerCase().includes(query),
				)
				: processedRows;

			const totalFiles = files.length;
			const total = processedRows.length;
			const visible = filteredRows.length;
			const missing = filteredRows.filter((row) => row.isMissing).length;
			const overdue = filteredRows.filter((row) => row.isOverdue).length;
			const reviewedToday = filteredRows.filter((row) => {
				if (!row.last) return false;
				return row.last.isSame(today, "day");
			}).length;

			const summary = content.createEl("div", { cls: "review-history-summary" });
			summary.createEl("span", { text: `All: ${totalFiles}` });
			summary.createEl("span", { text: `Track: ${total}` });
			summary.createEl("span", { text: `Show: ${visible}` });
			summary.createEl("span", { text: `Int: ${intervalDays}d` });
			if (reviewedToday > 0) {
				summary.createEl("span", {
					text: `Today: ${reviewedToday}`,
					cls: "review-history-summary-today",
				});
			}
			if (overdue > 0) {
				summary.createEl("span", {
					text: `Over: ${overdue}`,
					cls: "review-history-summary-overdue",
				});
			}
			if (missing > 0) {
				summary.createEl("span", {
					text: `Miss: ${missing}`,
					cls: "review-history-summary-warning",
				});
			}

			if (filteredRows.length === 0) {
				const emptyFiltered = content.createEl("p", { text: "No notes match your search." });
				emptyFiltered.addClass("review-history-empty");
				return;
			}

			const list = content.createDiv({ cls: "review-history-list" });
			for (const row of filteredRows) {
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
						const isPreview = e.metaKey || e.ctrlKey;
						this.app.workspace.openLinkText(row.fullPath, "", isPreview);
					});
					title.addEventListener("mouseover", (e) => {
						if (e.metaKey || e.ctrlKey) {
							this.app.workspace.trigger("hover-link", {
								event: e,
								source: VIEW_TYPE_REVIEW_HISTORY,
								hoverParent: this,
								targetEl: title,
								linktext: row.fullPath,
							});
						}
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

				const actions = item.createDiv({ cls: "review-history-item-actions" });
				
				if (!row.isMissing) {
					const readLaterBtn = actions.createEl("button", {
						cls: "review-history-read-later-btn",
						text: "Deep Read",
					});
					readLaterBtn.title = "Mark for deep reading";
					readLaterBtn.addEventListener("click", (event) => {
						event.preventDefault();
						event.stopPropagation();
						void this.markReadLater(row.path);
					});
				}
				
				const deleteBtn = actions.createEl("button", {
					cls: "review-history-delete-btn",
					text: "Remove",
				});
				deleteBtn.title = "Remove this note from history";
				deleteBtn.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					void this.deleteEntry(row.path);
				});
			}
		} catch (error) {
			console.error("ReviewCycle: failed to render history view", error);
			const message = content.createEl("p", {
				text: "Failed to load review history.",
			});
			message.addClass("review-history-error");
		}
	}

	private applySearch(): void {
		this.searchQuery = this.searchDraft.trim();
		this.searchDraft = this.searchQuery;
		this.shouldRefocusSearch = true;
		void this.refresh();
	}

	private async deleteEntry(path: string): Promise<void> {
		try {
			const record = await loadReviewRecord(this.plugin);
			if (path in record) {
				delete record[path];
				await saveReviewRecord(this.plugin, record);
			}
		} catch (error) {
			console.error("ReviewCycle: failed to delete entry", error);
		}
		await this.refresh();
	}

	private async markReadLater(path: string): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!file || !(file instanceof this.app.vault.adapter.constructor)) {
				const tfile = this.app.vault.getMarkdownFiles().find(f => f.path === path);
				if (tfile) {
					await this.app.fileManager.processFrontMatter(tfile, (frontmatter) => {
						frontmatter["deep-read"] = true;
					});
				}
			}
		} catch (error) {
			console.error("ReviewCycle: failed to mark deep read", error);
		}
		await this.refresh();
	}
}
