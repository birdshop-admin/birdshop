"use client";
import { useActionState } from "react";
import type { Service, ServicePlan } from "@/lib/services";
import { saveService, deleteService } from "./actions";
import s from "./services.module.css";
export default function ServiceEditor({
  service,
  visible = true,
}: {
  service?: Service;
  visible?: boolean;
}) {
  const [state, action, pending] = useActionState(saveService, {
    error: "",
    success: "",
  });
  const [removed, remove, deleting] = useActionState(deleteService, {
    error: "",
    success: "",
  });
  const tiers: ServicePlan[] =
    service?.packages ??
    ["starter", "standard", "premium"].map((id, i) => ({
      id: id as ServicePlan["id"],
      name: ["Basic", "Standard", "Premium"][i],
      enabled: false,
      cents: null,
      scope: "",
      includes: [],
    }));
  return (
    <article className={s.card}>
      <h2>{service?.name ?? "Add a service"}</h2>
      <form action={action}>
        <fieldset disabled={pending}>
          <input type="hidden" name="existing" value={service ? "yes" : "no"} />
          <div className={s.grid}>
            <label>
              Service name
              <input
                name="name"
                defaultValue={service?.name}
                required
                maxLength={100}
              />
            </label>
            <label>
              URL slug
              <input
                name="slug"
                defaultValue={service?.slug}
                readOnly={!!service}
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                placeholder="deepwoken-progression"
              />
            </label>
            <label>
              Game
              <input
                name="game"
                defaultValue={service?.game}
                required
                maxLength={80}
              />
            </label>
            <label>
              Category
              <input
                name="category"
                defaultValue={service?.category}
                required
                maxLength={80}
              />
            </label>
            <label>
              Turnaround
              <input
                name="turnaround"
                defaultValue={service?.turnaround}
                maxLength={100}
              />
            </label>
          </div>
          <label>
            Description
            <textarea
              name="description"
              defaultValue={service?.description}
              required
              minLength={10}
              maxLength={2000}
            />
          </label>
          <label>
            Service highlights · one per line
            <textarea
              name="features"
              defaultValue={service?.features.join("\n")}
              maxLength={1500}
            />
          </label>
          <div className={s.flags}>
            <label>
              <input type="checkbox" name="visible" defaultChecked={visible} />
              Visible in catalog
            </label>
            <label>
              <input
                type="checkbox"
                name="available"
                defaultChecked={service?.available ?? true}
              />
              Accepting requests
            </label>
            <label>
              <input
                type="checkbox"
                name="featured"
                defaultChecked={service?.featured}
              />
              Featured on home
            </label>
          </div>
          <p>
            Custom requests stay available. Enable each fixed package only after
            setting its price and exactly what the customer receives. Prices are
            USD.
          </p>
          <div className={s.tiers}>
            {tiers.map((p) => (
              <section key={p.id}>
                <h3>{p.name}</h3>
                <label>
                  Price (USD)
                  <input
                    name={p.id + "_price"}
                    type="number"
                    min="0.50"
                    max="999999.99"
                    step="0.01"
                    defaultValue={
                      p.cents === null ? "" : (p.cents / 100).toFixed(2)
                    }
                  />
                </label>
                <label>
                  Scope
                  <textarea
                    name={p.id + "_scope"}
                    defaultValue={p.scope}
                    maxLength={500}
                  />
                </label>
                <label>
                  Included work · one per line
                  <textarea
                    name={p.id + "_includes"}
                    defaultValue={p.includes.join("\n")}
                    maxLength={1200}
                  />
                </label>
                <label className={s.check}>
                  <input
                    type="checkbox"
                    name={p.id + "_enabled"}
                    defaultChecked={p.enabled}
                  />
                  Enable purchase
                </label>
              </section>
            ))}
          </div>
          <button type="submit">{pending ? "Saving…" : "Save service"}</button>
        </fieldset>
        {state.error && <p role="alert">{state.error}</p>}
        {state.success && <p role="status">{state.success}</p>}
      </form>
      {service && (
        <details className={s.remove}>
          <summary>Remove this service</summary>
          <p>
            Removes the listing. Existing purchases, chats and payment history
            stay intact.
          </p>
          <form action={remove}>
            <input type="hidden" name="slug" value={service.slug} />
            <button disabled={deleting}>Confirm removal</button>
            {removed.error && <p role="alert">{removed.error}</p>}
          </form>
        </details>
      )}
    </article>
  );
}
