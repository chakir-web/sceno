import type { Metadata } from "next";
import { TrackForm } from "@/components/store/track-form";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: { absolute: dict.meta.trackTitle } };
}

export default async function TrackPage() {
  const { dict } = await getI18n();
  return (
    <div>
      <h1 className="font-display text-5xl">{dict.track.title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-stone">{dict.track.lead}</p>
      <div className="mt-8"><TrackForm /></div>
    </div>
  );
}
