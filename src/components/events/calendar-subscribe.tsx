import { CalendarPlus } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { googleCalendarSubscribeUrl, webcalUrl } from "@/lib/calendar";
import { getSiteUrl } from "@/lib/env";

/** "Subscribe" row: adds the public events feed to Google, Apple or Outlook calendars. */
export function CalendarSubscribe() {
  const feedUrl = `${getSiteUrl()}/events/calendar.ics`;
  const linkClass = buttonClasses("secondary", "md", "text-sm");

  return (
    <section
      aria-labelledby="subscribe-heading"
      className="mt-10 flex flex-col gap-3 rounded-[var(--radius-card)] border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <CalendarPlus className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden="true" />
        <div className="min-w-0">
          <h2 id="subscribe-heading" className="text-sm font-bold text-ink">
            Subscribe
          </h2>
          <p className="text-sm text-muted">Public events show up in your calendar app and stay up to date.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={googleCalendarSubscribeUrl(feedUrl)} target="_blank" rel="noopener noreferrer" className={linkClass}>
          Google Calendar
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <a href={webcalUrl(feedUrl)} className={linkClass}>
          Apple / Outlook
        </a>
      </div>
    </section>
  );
}
