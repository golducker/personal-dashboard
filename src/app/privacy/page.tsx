import type { Metadata } from "next";
import Link from "next/link";
import { MascotStatic } from "@/components/mascot";

export const metadata: Metadata = { title: "Privacy Policy · Personal Dashboard" };

const CONTACT = "lethinh512.stu@gmail.com";

// Public page: Google requires a privacy policy URL before the OAuth app can be published.
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-[calc(var(--safe-top)+2rem)] pb-[calc(var(--safe-bottom)+3rem)] text-sm leading-6 text-ink-2">
      <Link href="/" className="mb-8 inline-flex min-h-11 items-center gap-2 text-ink-3 hover:text-ink">
        <MascotStatic size="sm" />
        <span className="font-display font-bold text-ink">Dashboard</span>
      </Link>
      <h1 className="font-display mb-1 text-[32px] leading-tight font-bold tracking-tight text-ink">Privacy Policy</h1>
      <p className="mb-8 text-ink-3">Personal Dashboard · Last updated 26 October 2026</p>

      <Section title="What this app is">
        Personal Dashboard is a private, single-user app. It is used only by its owner to see their own calendar,
        tasks, study schedule and documents in one place. There is no public sign-up and no other users.
      </Section>

      <Section title="Google data it accesses">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Google Calendar</b>: reads events to show the day&apos;s schedule, and creates, edits or deletes events only
            when the owner does so from the dashboard.
          </li>
          <li>
            <b>Google Drive (read-only)</b>: reads file names, folders and modification times of the folders and
            shared drives the owner adds in Settings, and the cell contents of Google Sheets there (via the Sheets API),
            to list recent files and extract task deadlines. Nothing is written back to Drive.
          </li>
          <li>
            <b>Google Drive (files created by this app)</b>: creates and updates only files the app itself made, such
            as a project index sheet.
          </li>
          <li>
            <b>Email address</b>: to show which Google account is connected.
          </li>
        </ul>
      </Section>

      <Section title="How the data is stored">
        The Google refresh token is encrypted (AES-256-GCM) before it is saved. Calendar events are fetched on demand
        and not stored. Drive file metadata and the tasks extracted from spreadsheets are cached in a private database (Neon Postgres,
        Singapore) so the dashboard loads quickly. Data is never sold, shared with third parties, used for
        advertising, or used to train AI models.
      </Section>

      <Section title="Limited Use">
        The use and transfer of information received from Google APIs adheres to the{" "}
        <a
          className="underline"
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noreferrer"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </Section>

      <Section title="Removing access">
        Access can be revoked at any time from the dashboard (Settings → Disconnect) or at{" "}
        <a className="underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
          myaccount.google.com/permissions
        </a>
        . Disconnecting deletes the stored token.
      </Section>

      <Section title="Contact">
        <a className="underline" href={`mailto:${CONTACT}`}>
          {CONTACT}
        </a>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card mb-4 p-5">
      <h2 className="font-display mb-2 text-lg font-bold tracking-tight text-ink">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
