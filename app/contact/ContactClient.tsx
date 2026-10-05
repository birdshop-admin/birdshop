"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useRef, useEffect, useMemo, useState, type FormEvent } from "react";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

import {
  ArrowIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  DiscordIcon,
  MessageIcon,
  PeopleIcon,
  ShieldIcon,
} from "@/components/SiteIcons";

import { serviceList } from "@/lib/services";

import { siteConfig } from "@/lib/site-config";

import { useCart } from "@/app/cart-context";

import styles from "./contact.module.css";

/* =========================================================
   TYPES
========================================================= */

type ContactTopic = "service" | "product" | "review" | "general";

type ChatTopic = "service" | "product" | "general";

type SelectedContactTopic = ContactTopic | null;

type ReviewKind = "Product" | "Service";

type ContactClientProps = {
  initialTopic?: string;

  initialService?: string;

  initialPackage?: string;

  initialProduct?: string;
};

type CreatedConversation = {
  conversation_id?: string;

  id?: string;

  reference?: string;

  public_token?: string;

  conversation_type?: string;
};

type ConversationSuccess = {
  reference: string;

  token: string;

  conversationType: ChatTopic;

  email: string;

  title: string;

  detail: string;
};

type ReviewSubmission = {
  reference: string;

  summary: string;
};

/* =========================================================
   TOPICS
========================================================= */

const topics: Array<{
  id: ContactTopic;

  number: string;

  label: string;

  description: string;
}> = [
  {
    id: "service",

    number: "01",

    label: "Services",

    description: "Start a custom BirdShop game service request.",
  },

  {
    id: "product",

    number: "02",

    label: "Product Support",

    description: "Open a private conversation about a product or purchase.",
  },

  {
    id: "review",

    number: "03",

    label: "Leave Feedback",

    description: "Share an experience with a product or service.",
  },

  {
    id: "general",

    number: "03",

    label: "General Support",

    description: "Open a private conversation for anything else.",
  },
];

/* =========================================================
   HELPERS
========================================================= */

function resolveTopic({
  initialTopic,
  initialService,
  initialProduct,
}: ContactClientProps): SelectedContactTopic {
  if (
    initialTopic === "service" ||
    initialTopic === "product" ||
    initialTopic === "review" ||
    initialTopic === "general"
  ) {
    return initialTopic;
  }

  if (initialService) {
    return "service";
  }

  if (initialProduct) {
    return "product";
  }

  return null;
}

function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Custom Quote";
  }

  return `$${Number(value).toFixed(2)}`;
}

function cleanErrorMessage(value: string) {
  return value
    .replace(/^Error:\s*/i, "")
    .replace(/^P0001:\s*/i, "")
    .trim();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function conversationTypeLabel(type: ChatTopic) {
  if (type === "product") {
    return "Product Support";
  }

  if (type === "general") {
    return "General Support";
  }

  return "Service Request";
}

/*
 * Supabase can return a single JSON object or, depending on
 * the function return signature, a one-row array.
 *
 * Supporting both makes the contact page more resilient.
 */
function normalizeCreatedConversation(
  value: unknown,
): CreatedConversation | null {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  return candidate as CreatedConversation;
}

/* =========================================================
   COMPONENT
========================================================= */

export default function ContactClient(props: ContactClientProps) {
  const router = useRouter();
  const submissionKey = useRef<string | null>(null);

  const { productList, productsLoaded, productsError } = useCart();

  /* =======================================================
     INITIAL DATA
  ======================================================= */

  const initialTopic = resolveTopic(props);

  const initialServiceObject =
    serviceList.find((service) => service.slug === props.initialService) ??
    serviceList[0];

  /* =======================================================
     STATE
  ======================================================= */

  const [topic, setTopic] = useState<SelectedContactTopic>(initialTopic);

  const [serviceSlug, setServiceSlug] = useState(
    initialServiceObject?.slug ?? "",
  );

  const [productSlug, setProductSlug] = useState(props.initialProduct ?? "");

  const [reviewKind, setReviewKind] = useState<ReviewKind>(
    props.initialService ? "Service" : "Product",
  );

  const [reviewSubject, setReviewSubject] = useState(
    props.initialService ?? props.initialProduct ?? "",
  );

  const [reviewTitle, setReviewTitle] = useState("");

  const [reviewDetails, setReviewDetails] = useState("");

  const [rating, setRating] = useState(5);

  const [displayName, setDisplayName] = useState("");

  const [customerEmail, setCustomerEmail] = useState("");

  const [contactHandle, setContactHandle] = useState("");

  const [generalSubject, setGeneralSubject] = useState("");

  const [orderReference, setOrderReference] = useState("");

  const [message, setMessage] = useState("");

  const [website, setWebsite] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const [submitError, setSubmitError] = useState<string | null>(null);

  const [conversationSuccess, setConversationSuccess] =
    useState<ConversationSuccess | null>(null);

  const [reviewSubmission, setReviewSubmission] =
    useState<ReviewSubmission | null>(null);

  const [copied, setCopied] = useState(false);

  /* =======================================================
     PRODUCT CATALOG
  ======================================================= */

  useEffect(() => {
    if (!productsLoaded || productList.length === 0) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const requested = productList.find(
        (product) => product.slug === props.initialProduct,
      );

      setProductSlug((current) => {
        const exists = productList.some((product) => product.slug === current);

        if (exists) {
          return current;
        }

        return requested?.slug ?? productList[0].slug;
      });

      if (reviewKind === "Product") {
        setReviewSubject((current) => {
          const exists = productList.some(
            (product) => product.slug === current,
          );

          if (exists) {
            return current;
          }

          return requested?.slug ?? productList[0].slug;
        });
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [productsLoaded, productList, props.initialProduct, reviewKind]);

  /* =======================================================
     SELECTED SERVICE
  ======================================================= */

  const selectedService = useMemo(
    () =>
      serviceList.find((service) => service.slug === serviceSlug) ??
      serviceList[0],
    [serviceSlug],
  );

  /* =======================================================
     SELECTED PRODUCT
  ======================================================= */

  const selectedProduct =
    productList.find((product) => product.slug === productSlug) ??
    productList[0];

  /* =======================================================
     REVIEW SUBJECTS
  ======================================================= */

  const selectedReviewProduct = productList.find(
    (product) => product.slug === reviewSubject,
  );

  const selectedReviewService = serviceList.find(
    (service) => service.slug === reviewSubject,
  );

  /* =======================================================
     LIVE SUMMARY
  ======================================================= */

  const liveTitle = useMemo(() => {
    if (topic === "service") {
      return selectedService?.name ?? "Custom Service Request";
    }

    if (topic === "product") {
      return selectedProduct?.name ?? "Product Support";
    }

    if (topic === "review") {
      if (reviewKind === "Product") {
        return selectedReviewProduct?.name ?? "Product Review";
      }

      return selectedReviewService?.name ?? "Service Review";
    }

    return generalSubject || "General Support";
  }, [
    topic,
    selectedService,
    selectedProduct,
    reviewKind,
    selectedReviewProduct,
    selectedReviewService,
    generalSubject,
  ]);

  const liveDetail = useMemo(() => {
    if (topic === "service") {
      return "Custom Quote";
    }

    if (topic === "product") {
      return selectedProduct?.category ?? "Digital Product";
    }

    if (topic === "review") {
      return `${rating}/5 Review`;
    }

    return "Private Support Chat";
  }, [topic, selectedProduct, rating]);

  const livePrice =
    topic === "product" && selectedProduct
      ? formatPrice(selectedProduct.price)
      : null;

  /* =======================================================
     REVIEW TYPE
  ======================================================= */

  function handleReviewKind(kind: ReviewKind) {
    setReviewKind(kind);

    if (kind === "Product") {
      setReviewSubject(productList[0]?.slug ?? "");

      return;
    }

    setReviewSubject(serviceList[0]?.slug ?? "");
  }

  /* =======================================================
     RESET CONTACT FIELDS
  ======================================================= */

  function resetContactFields() {
    setDisplayName("");

    setCustomerEmail("");

    setContactHandle("");

    setGeneralSubject("");

    setOrderReference("");

    setMessage("");

    setWebsite("");

    setSubmitError(null);

    setCopied(false);
  }

  /* =======================================================
     CREATE PRIVATE CONVERSATION

     IMPORTANT:

     On success, open the private conversation immediately.

     It only:
       1. validates
       2. creates the conversation
       3. receives reference + token
       4. sets confirmation state

     The browser stays on /contact.
  ======================================================= */

  async function createPrivateConversation(conversationType: ChatTopic) {
    const email = customerEmail.trim().toLowerCase();

    if (!isValidEmail(email)) {
      throw new Error(
        "Enter a valid email address so you can recover your private conversation later.",
      );
    }

    const trimmedMessage = message.trim();

    if (trimmedMessage.length < 5) {
      throw new Error("Please add a little more detail to your message.");
    }

    if (trimmedMessage.length > 4000) {
      throw new Error("Private-chat messages cannot exceed 4000 characters.");
    }

    if (conversationType === "service" && !selectedService) {
      throw new Error("Choose a BirdShop service.");
    }

    if (conversationType === "product" && !selectedProduct) {
      throw new Error(
        "The product catalog is still loading. Try again in a moment.",
      );
    }

    if (conversationType === "general" && generalSubject.trim().length < 3) {
      throw new Error("Add a short subject for your support request.");
    }

    const relatedReference = orderReference.trim();

    const firstMessage =
      relatedReference &&
      (conversationType === "product" || conversationType === "general")
        ? [
            `Related Order / Reference: ${relatedReference}`,
            "",
            trimmedMessage,
          ].join("\n")
        : trimmedMessage;

    const subject =
      conversationType === "service"
        ? `${selectedService?.name ?? "BirdShop"} Custom Service Request`
        : conversationType === "product"
          ? `${selectedProduct?.name ?? "Product"} Product Support`
          : generalSubject.trim();

    submissionKey.current ??= crypto.randomUUID();
    const response = await fetch("/api/service-chat/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: submissionKey.current,
        p_conversation_type: conversationType,

        p_customer_name: displayName.trim() || null,

        p_customer_email: email,

        p_customer_contact: contactHandle.trim() || null,

        p_subject: subject,

        p_message: firstMessage,

        p_service_slug:
          conversationType === "service"
            ? (selectedService?.slug ?? null)
            : null,

        p_service_name:
          conversationType === "service"
            ? (selectedService?.name ?? null)
            : null,

        p_package_id: null,

        p_package_name: conversationType === "service" ? "Custom Quote" : null,

        p_product_slug:
          conversationType === "product"
            ? (selectedProduct?.slug ?? null)
            : null,

        p_product_name:
          conversationType === "product"
            ? (selectedProduct?.name ?? null)
            : null,

        p_product_platform:
          conversationType === "product"
            ? (selectedProduct?.platform ?? null)
            : null,

        p_product_region:
          conversationType === "product"
            ? (selectedProduct?.region ?? null)
            : null,
      }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Unable to create conversation.");
    const data = result.data;

    const created = normalizeCreatedConversation(data);

    const reference = String(created?.reference ?? "").trim();

    const token = String(created?.public_token ?? "").trim();

    if (!reference) {
      throw new Error(
        "BirdShop created the conversation but did not return its reference.",
      );
    }

    if (!token) {
      throw new Error(
        "BirdShop created the conversation but did not return private chat access.",
      );
    }

    let detail = "Private Support";

    if (conversationType === "service") {
      detail = "Custom Quote";
    }

    if (conversationType === "product") {
      const parts = [selectedProduct?.platform, selectedProduct?.region].filter(
        Boolean,
      );

      detail = parts.length > 0 ? parts.join(" · ") : "Product Support";
    }

    setConversationSuccess({
      reference,
      token,
      conversationType,
      email,
      title: subject,
      detail,
    });
    router.push(
      "/service-chat?token=" + encodeURIComponent(token) + "&welcome=1",
    );
  }

  /* =======================================================
     REVIEW SUMMARY
  ======================================================= */

  function buildReviewSummary(reference: string) {
    const reviewedName =
      reviewKind === "Product"
        ? selectedReviewProduct?.name
        : selectedReviewService?.name;

    return [
      "BIRDSHOP REVIEW SUBMISSION",
      "==========================",
      `Reference: ${reference}`,
      `Experience: ${reviewKind}`,
      `Reviewed: ${reviewedName ?? "Not Selected"}`,
      `Rating: ${rating}/5`,
      `Headline: ${reviewTitle.trim()}`,
      "",
      message.trim(),
      "",
      "Status: Pending moderation",
    ].join("\n");
  }

  /* =======================================================
     SUBMIT REVIEW
  ======================================================= */

  async function submitReview() {
    if (reviewTitle.trim().length < 4) {
      throw new Error("Add a short headline for your review.");
    }

    if (contactHandle.trim().length < 2) {
      throw new Error(
        "Enter a Discord username or email so BirdShop can reach you.",
      );
    }

    const reviewName =
      reviewKind === "Product"
        ? selectedReviewProduct?.name
        : selectedReviewService?.name;

    const reviewSlug =
      reviewKind === "Product"
        ? selectedReviewProduct?.slug
        : selectedReviewService?.slug;

    if (!reviewName || !reviewSlug) {
      throw new Error("Choose what you are reviewing.");
    }

    const defaultMeta =
      reviewKind === "Product"
        ? (selectedReviewProduct?.category ?? "Digital Product")
        : "Service Experience";

    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        p_type: reviewKind,

        p_reviewer: displayName.trim(),

        p_contact_handle: contactHandle.trim(),

        p_rating: rating,

        p_title: reviewTitle.trim(),

        p_body: message.trim(),

        p_subject_slug: reviewSlug,

        p_subject: reviewName,

        p_meta: reviewDetails.trim() || defaultMeta,
      }),
    });
    const result = await response.json();
    const data = result.data;
    const error = response.ok
      ? null
      : { message: result.error || "Review submission failed." };

    if (error) {
      throw new Error(cleanErrorMessage(error.message));
    }

    const reference = String(data ?? "").trim();

    if (!reference) {
      throw new Error(
        "BirdShop received the review but did not return a reference.",
      );
    }

    setReviewSubmission({
      reference,

      summary: buildReviewSummary(reference),
    });

    window.setTimeout(() => {
      document.getElementById("submitted-request")?.scrollIntoView({
        behavior: "smooth",

        block: "center",
      });
    }, 50);
  }

  /* =======================================================
     MASTER SUBMIT
  ======================================================= */

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setSubmitError(null);

    setCopied(false);

    if (!topic) {
      setSubmitError("Choose a support option before submitting.");

      return;
    }

    /*
     * Honeypot.
     */
    if (website.trim()) {
      return;
    }

    if (message.trim().length < 5) {
      setSubmitError("Please add a little more detail to your message.");

      return;
    }

    if (topic !== "review" && !isValidEmail(customerEmail)) {
      setSubmitError(
        "Enter a valid email address so you can recover your private conversation later.",
      );

      return;
    }

    setSubmitting(true);

    try {
      if (topic === "review") {
        await submitReview();
      } else {
        /*
         * TypeScript now knows this is one of our chat topics.
         */
        await createPrivateConversation(topic);
      }
    } catch (problem) {
      setSubmitError(
        problem instanceof Error
          ? problem.message
          : "Something went wrong while submitting. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* =======================================================
     COPY CONVERSATION REFERENCE
  ======================================================= */

  async function copyConversationReference() {
    if (!conversationSuccess) {
      return;
    }

    try {
      await navigator.clipboard.writeText(conversationSuccess.reference);

      setCopied(true);

      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  /* =======================================================
     COPY REVIEW
  ======================================================= */

  async function copyReviewSubmission() {
    if (!reviewSubmission) {
      return;
    }

    try {
      await navigator.clipboard.writeText(reviewSubmission.summary);

      setCopied(true);

      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  /* =======================================================
     START ANOTHER REQUEST
  ======================================================= */

  function startAnotherRequest() {
    setConversationSuccess(null);

    resetContactFields();

    window.scrollTo({
      top: 0,

      behavior: "smooth",
    });
  }

  /* =======================================================
     PRIVATE CONVERSATION CONFIRMATION

     This entire screen is rendered while URL remains:
     /contact

     The token link below is the ONLY way this file enters
     /service-chat.
  ======================================================= */

  if (conversationSuccess) {
    const chatHref = `/service-chat?token=${encodeURIComponent(
      conversationSuccess.token,
    )}`;

    return (
      <main className="page-shell">
        <SiteHeader />

        <section className={styles.successPage}>
          <div className={styles.successShell}>
            <div className={styles.successHero}>
              <div className={styles.successHeroCopy}>
                <span className={styles.successEyebrow}>
                  PRIVATE CONVERSATION CREATED
                </span>

                <h1>You&apos;re all set.</h1>

                <p>
                  Your private BirdShop conversation is now ready. A recovery
                  email is being sent with your reference and private chat
                  access so you can return later at any time.
                </p>
              </div>

              <div className={styles.successHeroStatus}>
                <div className={styles.successCheckWrap}>
                  <CheckIcon />
                </div>

                <div className={styles.successHeroStatusText}>
                  <strong>Conversation Ready</strong>
                  <span>Reference secured and chat access prepared.</span>
                </div>
              </div>
            </div>

            <div className={styles.successReferenceBar}>
              <div>
                <span>YOUR REFERENCE</span>
                <p>Save this code if you ever need to return later.</p>
              </div>

              <strong>{conversationSuccess.reference}</strong>
            </div>

            <div className={styles.successGrid}>
              <div className={styles.successMainCard}>
                <div className={styles.successCardHeader}>
                  <div>
                    <span>BIRDSHOP PRIVATE CONVERSATION</span>
                    <h2>{conversationSuccess.title}</h2>
                  </div>

                  <div className={styles.successMiniBadge}>
                    {conversationTypeLabel(
                      conversationSuccess.conversationType,
                    )}
                  </div>
                </div>

                <div className={styles.successDetailsGrid}>
                  <div className={styles.successDetailCard}>
                    <span>TYPE</span>
                    <strong>
                      {conversationTypeLabel(
                        conversationSuccess.conversationType,
                      )}
                    </strong>
                  </div>

                  <div className={styles.successDetailCard}>
                    <span>DETAIL</span>
                    <strong>{conversationSuccess.detail}</strong>
                  </div>

                  <div className={styles.successDetailCard}>
                    <span>RECOVERY EMAIL</span>
                    <strong>{conversationSuccess.email}</strong>
                  </div>

                  <div className={styles.successDetailCard}>
                    <span>ORDER STATUS</span>
                    <strong>Not created yet</strong>
                  </div>
                </div>

                <div className={styles.successTimelineCard}>
                  <span>WHAT HAPPENS NEXT</span>

                  <div className={styles.successTimeline}>
                    <div className={styles.successTimelineItem}>
                      <div className={styles.successTimelineIcon}>
                        <CheckIcon />
                      </div>

                      <div>
                        <strong>Conversation created</strong>
                        <p>
                          Your request has been saved into BirdShop private
                          chat.
                        </p>
                      </div>
                    </div>

                    <div className={styles.successTimelineItem}>
                      <div className={styles.successTimelineIcon}>
                        <ClockIcon />
                      </div>

                      <div>
                        <strong>Recovery email sent</strong>
                        <p>
                          You’ll receive your reference and return instructions
                          by email.
                        </p>
                      </div>
                    </div>

                    <div className={styles.successTimelineItem}>
                      <div className={styles.successTimelineIcon}>
                        <MessageIcon />
                      </div>

                      <div>
                        <strong>Continue in private chat</strong>
                        <p>
                          Discuss the request with BirdShop before any order or
                          payment is finalized.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.successInfoNotice}>
                  <ShieldIcon />

                  <p>
                    No order has been created from this conversation yet.
                    BirdShop will confirm scope, pricing, timing, and payment
                    inside the private chat.
                  </p>
                </div>

                <div className={styles.successPrimaryActions}>
                  <button
                    type="button"
                    onClick={copyConversationReference}
                    className={styles.successGhostButton}
                  >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                    {copied ? "Reference Copied" : "Copy Reference"}
                  </button>

                  <Link
                    href={chatHref}
                    prefetch={false}
                    className={styles.successPrimaryButton}
                  >
                    <MessageIcon />
                    Continue to Private Chat
                    <ArrowIcon />
                  </Link>
                </div>
              </div>

              <aside className={styles.successSidebar}>
                <div className={styles.successSidebarCard}>
                  <span>RETURN LATER</span>
                  <h3>Use your reference anytime.</h3>
                  <p>
                    If you leave now, you can come back through
                    <strong> My Service / Private Chat </strong>
                    using:
                  </p>

                  <div className={styles.successReturnInfo}>
                    <div>
                      <small>REFERENCE</small>
                      <strong>{conversationSuccess.reference}</strong>
                    </div>

                    <div>
                      <small>EMAIL</small>
                      <strong>{conversationSuccess.email}</strong>
                    </div>
                  </div>
                </div>

                <div className={styles.successSidebarCard}>
                  <span>EMAIL NOTICE</span>
                  <h3>Didn’t see the email?</h3>
                  <p>
                    Check Spam or Junk first. Your recovery email is sent so you
                    can reopen the conversation later without losing access.
                  </p>
                </div>

                <div className={styles.successSidebarActions}>
                  <Link
                    href="/service-chat"
                    prefetch={false}
                    className={styles.successSecondaryButton}
                  >
                    <ShieldIcon />
                    My Service / Return Later
                    <ArrowIcon />
                  </Link>

                  <button
                    type="button"
                    onClick={startAnotherRequest}
                    className={styles.successWhiteButton}
                  >
                    <MessageIcon />
                    Start Another Request
                  </button>

                  <a
                    href={siteConfig.discordUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.successDiscordButton}
                  >
                    <DiscordIcon />
                    Open BirdShop Discord
                    <ArrowIcon />
                  </a>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <SiteFooter />
      </main>
    );
  }

  /* =======================================================
     NORMAL CONTACT PAGE
  ======================================================= */

  const selectedTopicLabel =
    topics.find((item) => item.id === topic)?.label ?? "Choose a Topic";

  return (
    <main className="page-shell">
      <SiteHeader />

      {/* ===================================================
          HERO
      =================================================== */}

      <section className={styles.hero}>
        <div className={styles.heroOverlay} />

        <div className={styles.heroLayout}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>BIRDSHOP / SUPPORT</p>

            <h1>Let&apos;s talk.</h1>

            <p className={styles.heroDescription}>
              Service requests, product questions, feedback, or general support
              — start here and BirdShop will keep everything organized.
            </p>

            <div className={styles.heroFacts}>
              <span>
                <MessageIcon />
                Private Conversations
              </span>

              <span>
                <ClockIcon />
                Clear Status
              </span>

              <span>
                <ShieldIcon />
                Direct Support
              </span>
            </div>
          </div>

          <div className={styles.heroMark}>
            <span>BS</span>

            <div />

            <strong>CONTACT</strong>

            <small>
              SUPPORT
              <br />
              REQUESTS
              <br />
              COMMUNITY
            </small>
          </div>
        </div>
      </section>

      {/* ===================================================
          PROCESS
      =================================================== */}

      <section className={styles.processStrip}>
        <div>
          <span>01</span>

          <div>
            <strong>Choose a Topic</strong>

            <small>TELL US WHAT YOU NEED</small>
          </div>
        </div>

        <div>
          <span>02</span>

          <div>
            <strong>Add the Details</strong>

            <small>GIVE US THE CONTEXT</small>
          </div>
        </div>

        <div>
          <span>03</span>

          <div>
            <strong>Confirmation</strong>

            <small>SAVE YOUR REFERENCE</small>
          </div>
        </div>

        <div>
          <span>04</span>

          <div>
            <strong>Continue in Chat</strong>

            <small>WHEN YOU&apos;RE READY</small>
          </div>
        </div>
      </section>

      {/* ===================================================
          CONTACT SECTION
      =================================================== */}

      <section className={styles.contactSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span>START A CONVERSATION</span>

            <h2>What can we help with?</h2>
          </div>

          <p>
            Choose the option that best matches what you need. Service, product,
            and general support all continue privately through BirdShop Chat.
          </p>
        </div>

        {/* ===============================================
            TOPIC CARDS
        =============================================== */}

        <div className={styles.topicGrid}>
          {topics
            .filter((item) => item.id !== "review")
            .map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.topicCard} ${
                  topic === item.id ? styles.topicActive : ""
                }`}
                onClick={() => {
                  setTopic(item.id);

                  setSubmitError(null);

                  setReviewSubmission(null);

                  setCopied(false);
                }}
              >
                <span className={styles.topicNumber}>{item.number}</span>

                <div>
                  <strong>{item.label}</strong>

                  <p>{item.description}</p>
                </div>

                <span className={styles.topicStatus}>
                  {topic === item.id ? <CheckIcon /> : <ArrowIcon />}
                </span>
              </button>
            ))}
        </div>

        {topic && (
          <div className={styles.contactLayout}>
            <form className={styles.form} onSubmit={handleSubmit}>
              {/* =========================================
                  SERVICE
              ========================================= */}

              {topic === "service" && (
                <section className={styles.formSection}>
                  <div className={styles.formSectionHeading}>
                    <span>CUSTOM SERVICE REQUEST</span>

                    <h3>What service do you need?</h3>

                    <p>
                      Contact requests use a custom quote. Choose the service
                      and explain exactly what you need.
                    </p>
                  </div>

                  <label className={styles.field}>
                    <span>SERVICE</span>

                    <select
                      value={serviceSlug}
                      onChange={(event) => setServiceSlug(event.target.value)}
                    >
                      {serviceList.map((service) => (
                        <option key={service.slug} value={service.slug}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className={styles.packageArea}>
                    <span className={styles.fieldLabel}>REQUEST TYPE</span>

                    <div className={styles.packageGrid}>
                      <div
                        className={`${styles.packageButton} ${styles.packageActive}`}
                      >
                        <div>
                          <span>CUSTOM</span>

                          <strong>Custom Quote</strong>
                        </div>

                        <strong className={styles.packagePrice}>TBD</strong>

                        <CheckIcon />
                      </div>
                    </div>
                  </div>

                  <div className={styles.servicePreview}>
                    <div>
                      <span>PROCESS</span>

                      <strong>Chat First</strong>
                    </div>

                    <div>
                      <span>QUOTE</span>

                      <strong>Confirmed in Chat</strong>
                    </div>

                    <div>
                      <span>ORDER</span>

                      <strong>After Payment</strong>
                    </div>
                  </div>
                </section>
              )}

              {/* =========================================
                  PRODUCT SUPPORT
              ========================================= */}

              {topic === "product" && (
                <section className={styles.formSection}>
                  <div className={styles.formSectionHeading}>
                    <span>PRODUCT SUPPORT</span>

                    <h3>Which product?</h3>

                    <p>
                      Choose the product and explain what you need help with.
                    </p>
                  </div>

                  <label className={styles.field}>
                    <span>PRODUCT</span>

                    <select
                      value={selectedProduct?.slug ?? ""}
                      disabled={!productsLoaded || productList.length === 0}
                      onChange={(event) => setProductSlug(event.target.value)}
                    >
                      {!productsLoaded && (
                        <option value="">Loading products...</option>
                      )}

                      {productsLoaded && productList.length === 0 && (
                        <option value="">No products available</option>
                      )}

                      {productList.map((product) => (
                        <option key={product.slug} value={product.slug}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {productsError && (
                    <p className={styles.formError}>
                      Product catalog error: {productsError}
                    </p>
                  )}

                  {selectedProduct && (
                    <div className={styles.productPreview}>
                      <div className={styles.productMark}>
                        {selectedProduct.initials}
                      </div>

                      <div className={styles.productPreviewCopy}>
                        <span>{selectedProduct.category}</span>

                        <strong>{selectedProduct.name}</strong>

                        <p>
                          {selectedProduct.platform} · {selectedProduct.region}
                        </p>
                      </div>

                      <strong className={styles.productPreviewPrice}>
                        {formatPrice(selectedProduct.price)}
                      </strong>
                    </div>
                  )}

                  <label className={styles.field}>
                    <span>
                      ORDER / REFERENCE
                      <small>OPTIONAL</small>
                    </span>

                    <input
                      type="text"
                      value={orderReference}
                      onChange={(event) =>
                        setOrderReference(event.target.value)
                      }
                      placeholder="Existing order or reference"
                      maxLength={180}
                    />
                  </label>
                </section>
              )}

              {/* =========================================
                  REVIEW
              ========================================= */}

              {topic === "review" && (
                <section className={styles.formSection}>
                  <div className={styles.formSectionHeading}>
                    <span>SHARE FEEDBACK</span>

                    <h3>Tell us how it went.</h3>

                    <p>
                      Reviews are submitted to moderation first. Approved
                      reviews may then appear publicly.
                    </p>
                  </div>

                  <div className={styles.reviewKind}>
                    <button
                      type="button"
                      className={
                        reviewKind === "Product" ? styles.reviewKindActive : ""
                      }
                      onClick={() => handleReviewKind("Product")}
                    >
                      Product
                    </button>

                    <button
                      type="button"
                      className={
                        reviewKind === "Service" ? styles.reviewKindActive : ""
                      }
                      onClick={() => handleReviewKind("Service")}
                    >
                      Service
                    </button>
                  </div>

                  <label className={styles.field}>
                    <span>REVIEWING</span>

                    <select
                      value={reviewSubject}
                      disabled={reviewKind === "Product" && !productsLoaded}
                      onChange={(event) => setReviewSubject(event.target.value)}
                    >
                      {reviewKind === "Product"
                        ? productList.map((product) => (
                            <option key={product.slug} value={product.slug}>
                              {product.name}
                            </option>
                          ))
                        : serviceList.map((service) => (
                            <option key={service.slug} value={service.slug}>
                              {service.name}
                            </option>
                          ))}
                    </select>
                  </label>

                  <div className={styles.ratingField}>
                    <span className={styles.fieldLabel}>YOUR RATING</span>

                    <div className={styles.ratingButtons}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setRating(value)}
                          className={value <= rating ? styles.ratingActive : ""}
                          aria-label={`${value} star rating`}
                          aria-pressed={value === rating}
                        >
                          ★
                        </button>
                      ))}
                    </div>

                    <small>{rating}/5</small>
                  </div>

                  <label className={styles.field}>
                    <span>REVIEW HEADLINE</span>

                    <input
                      type="text"
                      value={reviewTitle}
                      onChange={(event) => setReviewTitle(event.target.value)}
                      placeholder="A short summary of your experience"
                      maxLength={180}
                      required
                    />
                  </label>

                  <label className={styles.field}>
                    <span>
                      DETAILS
                      <small>OPTIONAL</small>
                    </span>

                    <input
                      type="text"
                      value={reviewDetails}
                      onChange={(event) => setReviewDetails(event.target.value)}
                      placeholder={
                        reviewKind === "Service"
                          ? "Package or useful service detail"
                          : "Purchase type or useful product detail"
                      }
                      maxLength={220}
                    />
                  </label>
                </section>
              )}

              {/* =========================================
                  GENERAL SUPPORT
              ========================================= */}

              {topic === "general" && (
                <section className={styles.formSection}>
                  <div className={styles.formSectionHeading}>
                    <span>GENERAL SUPPORT</span>

                    <h3>What&apos;s on your mind?</h3>

                    <p>
                      Ask your question and BirdShop will keep the discussion
                      inside one private conversation.
                    </p>
                  </div>

                  <label className={styles.field}>
                    <span>SUBJECT</span>

                    <input
                      type="text"
                      value={generalSubject}
                      onChange={(event) =>
                        setGeneralSubject(event.target.value)
                      }
                      placeholder="What do you need help with?"
                      maxLength={180}
                      required
                    />
                  </label>

                  <label className={styles.field}>
                    <span>
                      ORDER / REFERENCE
                      <small>OPTIONAL</small>
                    </span>

                    <input
                      type="text"
                      value={orderReference}
                      onChange={(event) =>
                        setOrderReference(event.target.value)
                      }
                      placeholder="Existing order or reference"
                      maxLength={180}
                    />
                  </label>
                </section>
              )}

              {/* =========================================
                  CONTACT INFORMATION
              ========================================= */}

              <section className={styles.formSection}>
                <div className={styles.formSectionHeading}>
                  <span>YOUR DETAILS</span>

                  <h3>How can we reach you?</h3>

                  <p>
                    Private conversations require an email so you can recover
                    them later. Discord is optional.
                  </p>
                </div>

                {topic === "review" ? (
                  <div className={styles.twoFields}>
                    <label className={styles.field}>
                      <span>
                        DISPLAY NAME
                        <small>OPTIONAL</small>
                      </span>

                      <input
                        type="text"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        placeholder="Your name"
                        maxLength={120}
                      />
                    </label>

                    <label className={styles.field}>
                      <span>
                        DISCORD / EMAIL
                        <small>PRIVATE</small>
                      </span>

                      <input
                        type="text"
                        value={contactHandle}
                        onChange={(event) =>
                          setContactHandle(event.target.value)
                        }
                        placeholder="@username or email"
                        maxLength={240}
                        required
                      />
                    </label>
                  </div>
                ) : (
                  <>
                    <div className={styles.twoFields}>
                      <label className={styles.field}>
                        <span>
                          DISPLAY NAME
                          <small>OPTIONAL</small>
                        </span>

                        <input
                          type="text"
                          value={displayName}
                          onChange={(event) =>
                            setDisplayName(event.target.value)
                          }
                          placeholder="Your name"
                          maxLength={120}
                        />
                      </label>

                      <label className={styles.field}>
                        <span>
                          EMAIL
                          <small>REQUIRED · PRIVATE</small>
                        </span>

                        <input
                          type="email"
                          value={customerEmail}
                          onChange={(event) =>
                            setCustomerEmail(event.target.value)
                          }
                          placeholder="you@example.com"
                          autoComplete="email"
                          maxLength={320}
                          required
                        />
                      </label>
                    </div>

                    <label className={styles.field}>
                      <span>
                        DISCORD
                        <small>OPTIONAL</small>
                      </span>

                      <input
                        type="text"
                        value={contactHandle}
                        onChange={(event) =>
                          setContactHandle(event.target.value)
                        }
                        placeholder="@username"
                        maxLength={240}
                      />
                    </label>
                  </>
                )}

                {/* =======================================
                    MESSAGE
                ======================================= */}

                <label className={styles.field}>
                  <span>MESSAGE</span>

                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={
                      topic === "service"
                        ? "Tell us exactly what you need, your goals, requirements, character/build information, and anything else BirdShop should know..."
                        : topic === "product"
                          ? "Explain your question or issue with the product..."
                          : topic === "review"
                            ? "Tell us what went well, what could be better, and anything you want other customers to know..."
                            : "Tell us what you need help with..."
                    }
                    rows={7}
                    maxLength={topic === "review" ? 5000 : 4000}
                    required
                  />
                </label>

                {/* =======================================
                    HONEYPOT
                ======================================= */}

                <div className={styles.honeypot} aria-hidden="true">
                  <label>
                    Website
                    <input
                      type="text"
                      value={website}
                      onChange={(event) => setWebsite(event.target.value)}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </label>
                </div>

                {/* =======================================
                    EXPLANATION
                ======================================= */}

                <div className={styles.prepareNotice}>
                  <ShieldIcon />

                  <p>
                    {topic === "service"
                      ? "This creates a private conversation only. No order is created yet. BirdShop confirms scope, price, timing, and payment in chat first."
                      : topic === "product"
                        ? "Product Support creates a private BirdShop conversation. It does not create another order."
                        : topic === "general"
                          ? "General Support creates a private BirdShop conversation so your messages stay together."
                          : "Your review is saved as pending and does not appear publicly until approved."}
                  </p>
                </div>

                {submitError && (
                  <div className={styles.formError} role="alert">
                    {submitError}
                  </div>
                )}

                {/* =======================================
                    SUBMIT
                ======================================= */}

                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={submitting}
                >
                  {submitting
                    ? topic === "review"
                      ? "Submitting..."
                      : "Creating Private Conversation..."
                    : topic === "review"
                      ? "Submit Review"
                      : "Create Private Conversation"}

                  <ArrowIcon />
                </button>
              </section>
            </form>

            {/* ===========================================
                SUMMARY SIDEBAR
            =========================================== */}

            <aside className={styles.summaryCard}>
              <div className={styles.summaryAccent} />

              <span>
                {topic === "review" ? "REVIEW SUMMARY" : "PRIVATE CONVERSATION"}
              </span>

              <h2>{liveTitle}</h2>

              <div className={styles.summarySelected}>
                <span>TYPE</span>

                <strong>{selectedTopicLabel}</strong>
              </div>

              <div className={styles.summaryFacts}>
                <div>
                  <span>SELECTION</span>

                  <strong>{liveDetail}</strong>
                </div>

                {livePrice && (
                  <div>
                    <span>PRODUCT PRICE</span>

                    <strong>{livePrice}</strong>
                  </div>
                )}

                {topic !== "review" && (
                  <div>
                    <span>SUPPORT</span>

                    <strong>Private Chat</strong>
                  </div>
                )}

                {topic === "service" && (
                  <div>
                    <span>ORDER</span>

                    <strong>After Payment</strong>
                  </div>
                )}

                {topic === "review" && (
                  <div>
                    <span>RATING</span>

                    <strong>{rating}/5</strong>
                  </div>
                )}
              </div>

              <div className={styles.summaryStatus}>
                {reviewSubmission ? <CheckIcon /> : <MessageIcon />}

                <div>
                  <strong>
                    {reviewSubmission
                      ? "Review submitted."
                      : topic === "review"
                        ? "Ready for moderation."
                        : "Ready to create."}
                  </strong>

                  <p>
                    {reviewSubmission
                      ? `Reference ${reviewSubmission.reference}`
                      : topic === "service"
                        ? "Create the conversation first. Discuss the job before an order exists."
                        : topic === "product"
                          ? "Product questions continue privately in BirdShop Chat."
                          : topic === "general"
                            ? "Support continues privately in BirdShop Chat."
                            : "Your review enters moderation after submission."}
                  </p>
                </div>
              </div>

              <a
                href={siteConfig.discordUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.discordLink}
              >
                <DiscordIcon />
                Open BirdShop Discord
                <ArrowIcon />
              </a>

              <small className={styles.discordNote}>
                BirdShop Chat is the primary private support workspace. Discord
                remains available as an alternate contact method.
              </small>
            </aside>
          </div>
        )}
      </section>

      {/* ===================================================
          REVIEW SUCCESS
      =================================================== */}

      {reviewSubmission && (
        <section id="submitted-request" className={styles.preparedSection}>
          <div className={styles.preparedHeading}>
            <div>
              <span>REVIEW RECEIVED</span>

              <h2>Your feedback is pending review.</h2>

              <p>
                Your review has been submitted for moderation. Keep your
                reference if you need to contact BirdShop.
              </p>
            </div>

            <div className={styles.preparedCheck}>
              <CheckIcon />
            </div>
          </div>

          <div className={styles.submittedReference}>
            <span>REFERENCE</span>

            <strong>{reviewSubmission.reference}</strong>
          </div>

          <div className={styles.preparedCard}>
            <pre>{reviewSubmission.summary}</pre>

            <div className={styles.preparedActions}>
              <button type="button" onClick={copyReviewSubmission}>
                {copied ? <CheckIcon /> : <CopyIcon />}

                {copied ? "Copied" : "Copy Summary"}
              </button>

              <a href={siteConfig.discordUrl} target="_blank" rel="noreferrer">
                <DiscordIcon />
                Continue on Discord
                <ArrowIcon />
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ===================================================
          SUPPORT PATHS
      =================================================== */}

      <section className={styles.supportSection}>
        <div className={styles.supportHeading}>
          <span>BIRDSHOP SUPPORT</span>

          <h2>Choose the right path.</h2>
        </div>

        <div className={styles.supportGrid}>
          <Link href="/faqs">
            <div>
              <MessageIcon />
            </div>

            <span>
              <small>QUICK ANSWERS</small>

              <strong>Read the FAQs</strong>

              <p>
                Find answers to common questions before opening a conversation.
              </p>
            </span>

            <ArrowIcon />
          </Link>

          <Link href="/services">
            <div>
              <PeopleIcon />
            </div>

            <span>
              <small>GAME SERVICES</small>

              <strong>Browse Services</strong>

              <p>Compare services and choose what kind of help you need.</p>
            </span>

            <ArrowIcon />
          </Link>

          <Link href="/products">
            <div>
              <ShieldIcon />
            </div>

            <span>
              <small>DIGITAL STORE</small>

              <strong>Browse Products</strong>

              <p>Check platforms, regions, stock, and delivery information.</p>
            </span>

            <ArrowIcon />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
