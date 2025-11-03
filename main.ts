import moment from "moment";
import { Notice, Plugin } from "obsidian";
import {
	DEFAULT_SETTINGS,
	normalizeSettings,
	ReviewPluginSettings,
} from "./settings";
import { ReviewCycleSettingTab } from "./settings-tab";
import {
	loadReviewRecord,
	pruneReviewRecord,
	saveReviewRecord,
	ReviewRecord,
	REVIEW_DATE_FORMAT,
} from "./data";
import { selectNotesForReview } from "./review";
import { ReviewHistoryView, VIEW_TYPE_REVIEW_HISTORY } from "./history-view";

export default class ReviewCyclePlugin extends Plugin {
	settings: ReviewPluginSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		const ribbonIcon = this.addRibbonIcon("rotate-cw", "Start Daily Review", () => {
			void this.startDailyReview();
		});
		ribbonIcon.addClass("review-cycle-ribbon");

		this.registerView(VIEW_TYPE_REVIEW_HISTORY, (leaf) => new ReviewHistoryView(leaf, this));

		this.app.workspace.onLayoutReady(() => {
			void this.activateHistoryView();
		});

		this.addSettingTab(new ReviewCycleSettingTab(this.app, this));

		this.addCommand({
			id: "start-daily-review",
			name: "Start Daily Review",
			callback: () => this.startDailyReview(),
		});

		this.addCommand({
			id: "open-review-history",
			name: "Open Review History",
			callback: () => this.activateHistoryView(),
		});
	}

	async startDailyReview(): Promise<void> {
		try {
			const markdownFiles = this.app.vault.getMarkdownFiles();
			let record = await loadReviewRecord(this);
			record = pruneReviewRecord(record, markdownFiles);

			const selected = selectNotesForReview(markdownFiles, record, this.settings);
			const target = selected[0];

			if (!target) {
				await saveReviewRecord(this, record);
				new Notice("今日没有符合条件的回顾笔记。");
				return;
			}

			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(target);

			const today = moment().format(REVIEW_DATE_FORMAT);
			const updatedRecord: ReviewRecord = { ...record, [target.path]: today };

			await saveReviewRecord(this, updatedRecord);
			this.refreshHistoryViews();
		} catch (error) {
			console.error("ReviewCycle: failed to run daily review", error);
			new Notice("ReviewCycle 回顾出现错误，请查看控制台。");
		}
	}

	async onunload(): Promise<void> {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_REVIEW_HISTORY);
	}

	async loadSettings(): Promise<void> {
		const stored = await this.loadData();
		this.settings = normalizeSettings(stored);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async activateHistoryView(): Promise<void> {
		const workspace = this.app.workspace;
		const [existing] = workspace.getLeavesOfType(VIEW_TYPE_REVIEW_HISTORY);
		if (existing) {
			workspace.revealLeaf(existing);
			return;
		}

		const leaf = workspace.getRightLeaf(false);
		if (!leaf) {
			new Notice("Unable to open review history panel.");
			return;
		}

		await leaf.setViewState({ type: VIEW_TYPE_REVIEW_HISTORY, active: true });
		workspace.revealLeaf(leaf);
	}

	private refreshHistoryViews(): void {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_REVIEW_HISTORY);
		for (const leaf of leaves) {
			const view = leaf.view;
			if (view instanceof ReviewHistoryView) {
				void view.refresh();
			}
		}
	}
}
