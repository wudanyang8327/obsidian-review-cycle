export interface ReviewPluginSettings {
	reviewIntervalDays: number;
}

export const DEFAULT_SETTINGS: ReviewPluginSettings = {
	reviewIntervalDays: 30,
};

export function normalizeSettings(
	partial: Partial<ReviewPluginSettings> | undefined,
): ReviewPluginSettings {
	return {
		reviewIntervalDays: normalizePositiveInteger(
			partial?.reviewIntervalDays,
			DEFAULT_SETTINGS.reviewIntervalDays,
		),
	};
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
	const numeric = Number(value);
	if (Number.isFinite(numeric) && numeric > 0) {
		return Math.round(numeric);
	}
	return fallback;
}
