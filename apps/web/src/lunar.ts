const cache = new Map<string, string | null>();

/**
 * Only show widely recognized festivals. The lunar library also reports
 * observances such as 财神节/天灸日/秋社, which would clutter the month grid.
 */
const MAJOR_FESTIVALS = new Set([
  '元旦',
  '春节',
  '元宵节',
  '情人节',
  '妇女节',
  '植树节',
  '清明节',
  '劳动节',
  '青年节',
  '儿童节',
  '建党节',
  '建军节',
  '教师节',
  '国庆节',
  '圣诞节',
  '除夕',
  '端午节',
  '七夕节',
  '中元节',
  '中秋节',
  '重阳节',
  '腊八节',
  '小年',
]);

type SolarModule = typeof import('lunar-typescript');
let solarModule: Promise<SolarModule> | null = null;

function loadSolar(): Promise<SolarModule> {
  solarModule ??= import('lunar-typescript');
  return solarModule;
}

/**
 * Loads festival labels for a batch of local dates. The lunar library is
 * dynamically imported so it does not affect first paint or list view.
 */
export async function loadFestivalLabels(
  dates: string[],
): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  const missing = dates.filter((date) => !cache.has(date));

  if (missing.length > 0) {
    const { Solar } = await loadSolar();
    for (const date of missing) {
      const [year, month, day] = date.split('-').map(Number);
      let label: string | null = null;
      if (year && month && day) {
        try {
          const solar = Solar.fromYmd(year, month, day);
          const lunar = solar.getLunar();
          const candidates = [
            ...solar.getFestivals(),
            ...lunar.getFestivals(),
            ...lunar.getOtherFestivals(),
          ];
          label = candidates.find((item) => MAJOR_FESTIVALS.has(item)) ?? null;
          if (!label && lunar.getJieQi() === '清明') label = '清明节';
        } catch {
          label = null;
        }
      }
      cache.set(date, label);
    }
  }

  for (const date of dates) {
    result[date] = cache.get(date) ?? null;
  }
  return result;
}
