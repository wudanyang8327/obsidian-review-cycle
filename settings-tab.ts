import { App, PluginSettingTab, Setting } from "obsidian";
import type ReviewCyclePlugin from "./main";
import { DEFAULT_SETTINGS } from "./settings";

export class ReviewCycleSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: ReviewCyclePlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "ReviewCycle" });

		new Setting(containerEl)
			.setName("Review interval (days)")
			.setDesc("在再次回顾同一笔记前需要等待的天数。")
			.addText((text) => {
				text.setPlaceholder(String(DEFAULT_SETTINGS.reviewIntervalDays))
					.setValue(String(this.plugin.settings.reviewIntervalDays))
					.onChange(async (value) => {
						this.plugin.settings.reviewIntervalDays = this.parsePositiveInteger(
							value,
							DEFAULT_SETTINGS.reviewIntervalDays,
						);
						await this.plugin.saveSettings();
					});
				text.inputEl.type = "number";
				text.inputEl.min = "1";
			});
	}

	private parsePositiveInteger(value: string, fallback: number): number {
		const parsed = Number(value);
		if (Number.isFinite(parsed) && parsed > 0) {
			return Math.round(parsed);
		}
		return fallback;
	}
}
