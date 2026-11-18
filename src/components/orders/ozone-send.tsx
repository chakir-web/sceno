"use client";

import { useActionState } from "react";
import { sendToOzoneAction, type OzoneSendState } from "@/lib/actions/orders";

export function OzoneSend({
  orderId,
  cities,
  selectedCityId,
  cityUnknown,
  labels,
}: {
  orderId: string;
  cities: { id: string; name: string }[];
  selectedCityId: string;
  cityUnknown: boolean;
  labels: {
    send: string;
    creating: string;
    created: string;
    city: string;
    cityUnknown: string;
    tracking: string;
    status: string;
    createdAt: string;
    emptyStatus: string;
  };
}) {
  const [state, action, pending] = useActionState(sendToOzoneAction, null as OzoneSendState | null);
  const succeeded = state?.ok === true;
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="grid gap-2 text-sm">
        {labels.city}
        <select className="field" name="ozoneCityId" defaultValue={selectedCityId} required disabled={succeeded || pending}>
          <option value="">{labels.city}</option>
          {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
        </select>
      </label>
      {cityUnknown && !succeeded ? <p className="text-sm text-red-900">{labels.cityUnknown}</p> : null}
      {state?.ok === false ? <p className="text-sm text-red-900">{state.message}</p> : null}
      {succeeded ? (
        <div className="grid gap-1 text-sm">
          <p>{labels.created}</p>
          <p>{labels.tracking}: {state.trackingNumber}</p>
          <p>{labels.status}: {state.statusLabel || state.status || labels.emptyStatus}</p>
          <p>{labels.createdAt}: {state.createdAt}</p>
        </div>
      ) : (
        <button className="btn btn-primary w-fit" type="submit" disabled={pending || cities.length === 0}>
          {pending ? labels.creating : labels.send}
        </button>
      )}
    </form>
  );
}
