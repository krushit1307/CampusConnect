const longDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const shortDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const weekdayTimeFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

const dateTimeSecondsFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function formatDate(dateInput: string | Date, formatter: Intl.DateTimeFormat): string {
  const date = new Date(dateInput);
  return Number.isNaN(date.getTime()) ? "" : formatter.format(date);
}

export function formatDateLong(isoString: string): string {
  return formatDate(isoString, longDateFormatter);
}

export function formatDateShort(dateInput: string | Date): string {
  return formatDate(dateInput, shortDateFormatter);
}

export function formatDateTimeShort(dateInput: string | Date): string {
  return formatDate(dateInput, shortDateTimeFormatter);
}

export function formatTime(dateInput: string | Date): string {
  return formatDate(dateInput, timeFormatter);
}

export function formatWeekdayTime(dateInput: string | Date): string {
  return formatDate(dateInput, weekdayTimeFormatter);
}

export function formatDateTimeSeconds(dateInput: string | Date): string {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "";

  const parts = Object.fromEntries(
    dateTimeSecondsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
