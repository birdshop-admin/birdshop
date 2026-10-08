"use client";

import Image from "next/image";
import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import CatalogArtwork from "@/components/CatalogArtwork";
import {
  SERVICE_TIERS,
  SERVICE_TIER_NAMES,
  publishedTiers,
} from "@/lib/service-packages";
import {
  SERVICE_IMAGE_ACCEPT,
  SERVICE_IMAGE_MAX_BYTES,
  serviceImageExtension,
  type Service,
  type ServicePlan,
} from "@/lib/services";

import { deleteService, saveService } from "./actions";
import s from "./services.module.css";

type ActionState = { error: string; success: string };

const IDLE: ActionState = { error: "", success: "" };

/* Soft warning only: smaller images still save. */
const SOFT_IMAGE_WIDTH = 1200;
const SHORT_DESCRIPTION_MAX = 160;

type ImageNote = { tone: "error" | "warn"; text: string };

function defaultTiers(): ServicePlan[] {
  return SERVICE_TIERS.map((id) => ({
    id,
    name: SERVICE_TIER_NAMES[id],
    enabled: false,
    cents: null,
    scope: "",
    includes: [],
  }));
}

export default function ServiceEditor({
  service,
  visible = true,
}: {
  service?: Service;
  visible?: boolean;
}) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const latestPreview = useRef<string | null>(null);

  const [customOnly, setCustomOnly] = useState(service?.customOnly === true);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageNote, setImageNote] = useState<ImageNote | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [shortCount, setShortCount] = useState(
    service?.shortDescription?.length ?? 0,
  );

  // Each local preview URL is released when replaced or on unmount.
  useEffect(() => {
    if (!preview) return;

    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function clearChosenImage() {
    if (fileRef.current) fileRef.current.value = "";

    latestPreview.current = null;
    setPreview(null);
    setImageNote(null);
  }

  /*
   * Submitted through onSubmit + startTransition (not the form action), so
   * React 19 does not reset the form: a validation error keeps every edit.
   * After a successful save the chosen file is cleared so it is not
   * uploaded twice, and the "add a service" form starts fresh.
   */
  const [state, action, pending] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = await saveService(previous, formData);

      if (result.success) {
        clearChosenImage();
        setRemoveImage(false);

        if (!service) {
          formRef.current?.reset();
          setCustomOnly(false);
          setShortCount(0);
        }
      }

      return result;
    },
    IDLE,
  );

  const [removed, remove, deleting] = useActionState(deleteService, IDLE);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pending) return;

    // Read before the transition: disabled controls (the package fieldset
    // in custom mode) are left out and never block the submit.
    const formData = new FormData(event.currentTarget);

    startTransition(() => action(formData));
  }

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    setImageNote(null);

    if (!file) {
      latestPreview.current = null;
      setPreview(null);
      return;
    }

    if (
      !serviceImageExtension(file.type) ||
      file.size > SERVICE_IMAGE_MAX_BYTES
    ) {
      input.value = "";
      latestPreview.current = null;
      setPreview(null);
      setImageNote({
        tone: "error",
        text: "Choose a PNG, JPG or WEBP image up to 8 MB.",
      });
      return;
    }

    const url = URL.createObjectURL(file);

    latestPreview.current = url;
    setPreview(url);
    setRemoveImage(false);

    const probe = new window.Image();

    probe.onload = () => {
      if (latestPreview.current !== url) return;

      if (probe.naturalWidth > 0 && probe.naturalWidth < SOFT_IMAGE_WIDTH) {
        setImageNote({
          tone: "warn",
          text: `This image is ${probe.naturalWidth}px wide. Under ${SOFT_IMAGE_WIDTH}px may look soft on large screens.`,
        });
      }
    };

    probe.src = url;
  }

  const tiers: ServicePlan[] = service?.packages?.length
    ? service.packages
    : defaultTiers();

  const liveCount = service ? publishedTiers(service).length : 0;
  const savedImage = removeImage ? null : (service?.image ?? null);
  const initials = service?.initials || "BS";

  const pricingStatus = customOnly
    ? "Customers see a Custom quote with no packages anywhere: no Basic, Standard or Premium on cards, the service page or checkout."
    : !service
      ? "Enable at least one package below. Until one is live, customers see a custom quote."
      : liveCount === 0
        ? "No package is live yet, so customers currently see a custom quote. Enable a package below."
        : `${liveCount} of 3 packages are live. Customers can also ask for a custom quote.`;

  return (
    <article className={s.card}>
      <header className={s.editorHeader}>
        <h2>{service?.name ?? "Add a service"}</h2>

        <span
          className={s.pricingBadge}
          data-mode={customOnly ? "custom" : "tiers"}
        >
          {customOnly ? "Custom quote only" : "Fixed packages"}
        </span>
      </header>

      <form ref={formRef} action={action} onSubmit={submit}>
        <fieldset disabled={pending} className={s.formBody}>
          <input type="hidden" name="existing" value={service ? "yes" : "no"} />

          {/* PRICING TYPE */}

          <fieldset className={s.pricingType}>
            <legend>Pricing type</legend>

            <div className={s.pricingOptions}>
              <label className={s.pricingOption}>
                <input
                  type="radio"
                  name="pricingType"
                  value="tiers"
                  checked={!customOnly}
                  onChange={() => setCustomOnly(false)}
                />

                <span>
                  <b>Fixed packages</b>
                  <small>
                    Basic, Standard and Premium with set prices. Customers can
                    still ask for a custom quote.
                  </small>
                </span>
              </label>

              <label className={s.pricingOption}>
                <input
                  type="radio"
                  name="pricingType"
                  value="custom"
                  checked={customOnly}
                  onChange={() => setCustomOnly(true)}
                />

                <span>
                  <b>Custom quote only</b>
                  <small>
                    No packages anywhere. Customers describe what they need and
                    you quote in chat.
                  </small>
                </span>
              </label>
            </div>

            <p className={s.pricingStatus} aria-live="polite">
              {pricingStatus}
            </p>
          </fieldset>

          {/* DETAILS */}

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
            <span className={s.labelRow}>
              Short description · shown on cards
              <small aria-hidden="true">
                {shortCount}/{SHORT_DESCRIPTION_MAX}
              </small>
            </span>
            <textarea
              name="shortDescription"
              className={s.short}
              defaultValue={service?.shortDescription}
              maxLength={SHORT_DESCRIPTION_MAX}
              aria-describedby={`${id}-short-help`}
              onChange={(event) => setShortCount(event.target.value.length)}
            />
            <small id={`${id}-short-help`} className={s.hint}>
              Leave empty to use the first sentence of the description.
            </small>
          </label>

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
              defaultValue={service?.features?.join("\n")}
              maxLength={1500}
            />
          </label>

          {/* IMAGE */}

          <section className={s.media} aria-labelledby={`${id}-image`}>
            <div className={s.mediaPreview}>
              {preview ? (
                <Image
                  src={preview}
                  alt=""
                  fill
                  sizes="240px"
                  unoptimized
                  style={{ objectFit: "cover" }}
                />
              ) : savedImage ? (
                <CatalogArtwork
                  src={savedImage}
                  sizes="240px"
                  fallback={<span>{initials}</span>}
                />
              ) : (
                <span>{initials}</span>
              )}

              {preview && <em>New · save to publish</em>}

              {!preview && removeImage && <em>Removed on save</em>}
            </div>

            <div className={s.mediaBody}>
              <h3 id={`${id}-image`}>Service image</h3>

              <label>
                <span className="visually-hidden">Choose a service image</span>
                <input
                  ref={fileRef}
                  type="file"
                  name="image_file"
                  accept={SERVICE_IMAGE_ACCEPT}
                  aria-describedby={`${id}-image-help`}
                  onChange={chooseImage}
                />
              </label>

              <small id={`${id}-image-help`} className={s.hint}>
                PNG, JPG or WEBP up to 8 MB. Landscape 1600×900 or larger works
                best; it is cropped to fill cards and the service page.
                {service?.image
                  ? " Leave this empty to keep the current image."
                  : " Without an image, the monogram seal is shown."}
              </small>

              {imageNote && (
                <p
                  className={s.imageNote}
                  data-tone={imageNote.tone}
                  role={imageNote.tone === "error" ? "alert" : "status"}
                >
                  {imageNote.text}
                </p>
              )}

              <div className={s.mediaActions}>
                {preview && (
                  <button
                    type="button"
                    className={s.textButton}
                    onClick={clearChosenImage}
                  >
                    Clear Selection
                  </button>
                )}

                {service?.image && !preview && (
                  <label className={s.check}>
                    <input
                      type="checkbox"
                      name="image_remove"
                      value="true"
                      checked={removeImage}
                      onChange={(event) => setRemoveImage(event.target.checked)}
                    />
                    Remove the image and show the monogram
                  </label>
                )}
              </div>
            </div>
          </section>

          {/* VISIBILITY */}

          <div className={s.flags}>
            <label className={s.check}>
              <input type="checkbox" name="visible" defaultChecked={visible} />
              Visible in catalog
            </label>

            <label className={s.check}>
              <input
                type="checkbox"
                name="available"
                defaultChecked={service?.available ?? true}
              />
              Accepting requests
            </label>

            <label className={s.check}>
              <input
                type="checkbox"
                name="featured"
                defaultChecked={service?.featured}
              />
              Featured on home
            </label>
          </div>

          {/* PACKAGES: disabled (not submitted, not validated) and hidden in
              custom mode; their values stay in the form for a switch back. */}

          {customOnly && (
            <div className={s.customNotice}>
              <strong>Custom quote only</strong>
              <p>
                Customers see no Basic, Standard or Premium packages for this
                service, only &ldquo;Request a Quote&rdquo;. Your package
                prices are kept but hidden. Switch back to Fixed packages any
                time; existing purchases stay valid.
              </p>
            </div>
          )}

          <fieldset
            className={s.tiers}
            disabled={customOnly}
            hidden={customOnly}
          >
            <legend>
              Fixed packages · enable each one after setting its price and
              included work. Prices are USD.
            </legend>

            <div className={s.tierGrid}>
              {tiers.map((p) => (
                <section key={p.id}>
                  <h3>{SERVICE_TIER_NAMES[p.id] ?? p.name}</h3>

                  <label>
                    Price (USD)
                    <input
                      name={p.id + "_price"}
                      type="number"
                      min="0.50"
                      max="999999.99"
                      step="0.01"
                      inputMode="decimal"
                      defaultValue={
                        typeof p.cents === "number"
                          ? (p.cents / 100).toFixed(2)
                          : ""
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
                      defaultValue={p.includes?.join("\n")}
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
          </fieldset>

          <div className={s.saveRow}>
            <button type="submit" className={s.save}>
              {pending ? "Saving…" : "Save Service"}
            </button>

            {state.error && <p role="alert">{state.error}</p>}

            {state.success && <p role="status">{state.success}</p>}
          </div>
        </fieldset>
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

            <button type="submit" className={s.danger} disabled={deleting}>
              Confirm Removal
            </button>

            {removed.error && <p role="alert">{removed.error}</p>}
          </form>
        </details>
      )}
    </article>
  );
}
