"use client";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

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

import {
  serviceList,
} from "@/lib/services";

import {
  buildServicePackages,
  getDefaultServicePackageId,
} from "@/lib/service-packages";

import {
  siteConfig,
} from "@/lib/site-config";

import {
  publishSupportChatContext,
  type BirdShopSupportChatContext,
} from "@/lib/support-chat";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  useCart,
} from "@/app/cart-context";

import styles from "./contact.module.css";

/* =========================================================
   TYPES
========================================================= */

type ContactTopic =
  | "service"
  | "product"
  | "review"
  | "general";

type SelectedContactTopic =
  | ContactTopic
  | null;

type ReviewKind =
  | "Product"
  | "Service";

type ContactClientProps = {
  initialTopic?: string;
  initialService?: string;
  initialPackage?: string;
  initialProduct?: string;
};

type SubmissionResult = {
  kind:
    | "service"
    | "support"
    | "review";

  reference: string;

  summary: string;

  serviceChatToken?:
    | string
    | null;
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

    label:
      "Service Request",

    description:
      "Start or discuss a BirdShop game service.",
  },

  {
    id: "product",

    number: "02",

    label:
      "Product Help",

    description:
      "Questions about a digital product or purchase.",
  },

  {
    id: "review",

    number: "03",

    label:
      "Leave Feedback",

    description:
      "Share an experience with a product or service.",
  },

  {
    id: "general",

    number: "04",

    label:
      "General Support",

    description:
      "Anything that does not fit the other categories.",
  },
];

/* =========================================================
   HELPERS
========================================================= */

function resolveTopic({
  initialTopic,
  initialService,
  initialProduct,
}: ContactClientProps):
  SelectedContactTopic {

  if (
    initialTopic ===
      "review" ||
    initialTopic ===
      "product" ||
    initialTopic ===
      "service" ||
    initialTopic ===
      "general"
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

function formatPrice(
  value:
    | number
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "Custom Quote";
  }

  return `$${value.toFixed(
    2
  )}`;
}

function cleanErrorMessage(
  message: string
) {
  return message
    .replace(
      /^Error:\s*/i,
      ""
    )
    .replace(
      /^P0001:\s*/i,
      ""
    )
    .trim();
}

/* =========================================================
   CONTACT PAGE
========================================================= */

export default function ContactClient(
  props: ContactClientProps
) {
  const supabase =
    useMemo(
      () =>
        createClient(),
      []
    );

  const {
    productList,
    productsLoaded,
    productsError,
  } = useCart();

  /* =======================================================
     INITIAL STATE
  ======================================================= */

  const initialTopic =
    resolveTopic(
      props
    );

  const initialServiceObject =
    serviceList.find(
      (
        service
      ) =>
        service.slug ===
        props.initialService
    ) ??
    serviceList[0];

  const initialPackages =
    initialServiceObject
      ? buildServicePackages(
          initialServiceObject
        )
      : [];

  const requestedPackageExists =
    initialPackages.some(
      (
        option
      ) =>
        option.id ===
        props.initialPackage
    );

  const startingPackage =
    requestedPackageExists
      ? props.initialPackage
      : getDefaultServicePackageId(
          initialPackages
        );

  /* =======================================================
     FORM STATE
  ======================================================= */

  const [
    topic,
    setTopic,
  ] =
    useState<SelectedContactTopic>(
      initialTopic
    );

  const [
    serviceSlug,
    setServiceSlug,
  ] =
    useState(
      initialServiceObject?.slug ??
        ""
    );

  const [
    packageId,
    setPackageId,
  ] =
    useState(
      startingPackage
    );

  const [
    productSlug,
    setProductSlug,
  ] =
    useState(
      props.initialProduct ??
        ""
    );

  const [
    reviewKind,
    setReviewKind,
  ] =
    useState<ReviewKind>(
      props.initialService
        ? "Service"
        : "Product"
    );

  const [
    reviewSubject,
    setReviewSubject,
  ] =
    useState(
      props.initialService ??
        props.initialProduct ??
        ""
    );

  const [
    reviewTitle,
    setReviewTitle,
  ] =
    useState("");

  const [
    reviewDetails,
    setReviewDetails,
  ] =
    useState("");

  const [
    rating,
    setRating,
  ] =
    useState(5);

  const [
    displayName,
    setDisplayName,
  ] =
    useState("");

  const [
    contactHandle,
    setContactHandle,
  ] =
    useState("");

  const [
    generalSubject,
    setGeneralSubject,
  ] =
    useState("");

  const [
    orderReference,
    setOrderReference,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    website,
    setWebsite,
  ] =
    useState("");

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    submitError,
    setSubmitError,
  ] =
    useState<
      string | null
    >(null);

  const [
    submission,
    setSubmission,
  ] =
    useState<
      SubmissionResult | null
    >(null);

  const [
    copied,
    setCopied,
  ] =
    useState(false);

  /* =======================================================
     PRODUCT CATALOG SYNCHRONIZATION
  ======================================================= */

  useEffect(() => {
    if (
      !productsLoaded ||
      productList.length ===
        0
    ) {
      return;
    }

    const frame =
      window
        .requestAnimationFrame(
          () => {
            const requestedProduct =
              productList.find(
                (
                  product
                ) =>
                  product.slug ===
                  props.initialProduct
              );

            setProductSlug(
              (
                current
              ) => {
                const currentExists =
                  productList.some(
                    (
                      product
                    ) =>
                      product.slug ===
                      current
                  );

                if (
                  currentExists
                ) {
                  return current;
                }

                return (
                  requestedProduct?.slug ??
                  productList[0]
                    .slug
                );
              }
            );

            if (
              reviewKind ===
              "Product"
            ) {
              setReviewSubject(
                (
                  current
                ) => {
                  const currentExists =
                    productList.some(
                      (
                        product
                      ) =>
                        product.slug ===
                        current
                    );

                  if (
                    currentExists
                  ) {
                    return current;
                  }

                  return (
                    requestedProduct?.slug ??
                    productList[0]
                      .slug
                  );
                }
              );
            }
          }
        );

    return () => {
      window
        .cancelAnimationFrame(
          frame
        );
    };
  }, [
    productsLoaded,
    productList,
    props.initialProduct,
    reviewKind,
  ]);

  /* =======================================================
     CURRENT SERVICE
  ======================================================= */

  const selectedService =
    useMemo(
      () =>
        serviceList.find(
          (
            service
          ) =>
            service.slug ===
            serviceSlug
        ) ??
        serviceList[0],
      [
        serviceSlug,
      ]
    );

  const packages =
    useMemo(
      () =>
        selectedService
          ? buildServicePackages(
              selectedService
            )
          : [],
      [
        selectedService,
      ]
    );

  const selectedPackage =
    packages.find(
      (
        option
      ) =>
        option.id ===
        packageId
    ) ??
    packages[0];

  /* =======================================================
     PRODUCT
  ======================================================= */

  const selectedProduct =
    productList.find(
      (
        product
      ) =>
        product.slug ===
        productSlug
    ) ??
    productList[0];

  /* =======================================================
     REVIEW SUBJECT
  ======================================================= */

  const selectedReviewProduct =
    productList.find(
      (
        product
      ) =>
        product.slug ===
        reviewSubject
    );

  const selectedReviewService =
    serviceList.find(
      (
        service
      ) =>
        service.slug ===
        reviewSubject
    );

  /* =======================================================
     LIVE SUMMARY
  ======================================================= */

  const liveTitle =
    useMemo(
      () => {
        switch (
          topic
        ) {
          case "service":
            return (
              selectedService
                ?.name ??
              "Service Request"
            );

          case "product":
            return (
              selectedProduct
                ?.name ??
              "Product Help"
            );

          case "review":
            return reviewKind ===
              "Product"
              ? selectedReviewProduct
                  ?.name ??
                  "Product Review"
              : selectedReviewService
                    ?.name ??
                  "Service Review";

          default:
            return (
              generalSubject ||
              "General Support"
            );
        }
      },
      [
        topic,
        selectedService,
        selectedProduct,
        reviewKind,
        selectedReviewProduct,
        selectedReviewService,
        generalSubject,
      ]
    );

  const liveDetail =
    useMemo(
      () => {
        switch (
          topic
        ) {
          case "service":
            return (
              selectedPackage
                ?.name ??
              "Select Package"
            );

          case "product":
            return (
              selectedProduct
                ?.category ??
              "Digital Product"
            );

          case "review":
            return `${rating}/5 Review`;

          default:
            return "Support Request";
        }
      },
      [
        topic,
        selectedPackage,
        selectedProduct,
        rating,
      ]
    );

  const livePrice =
    topic ===
      "service" &&
    selectedPackage
      ? formatPrice(
          selectedPackage
            .price
        )
      : topic ===
            "product" &&
          selectedProduct
        ? formatPrice(
            selectedProduct
              .price
          )
        : null;

  /* =======================================================
     SUPPORT CHAT CONTEXT

     This can still provide useful context for the site's
     support system, but SERVICE SUBMISSION itself no longer
     goes into support_requests.
  ======================================================= */

  const chatContext =
    useMemo<
      BirdShopSupportChatContext | null
    >(
      () => {
        if (
          !topic ||
          topic ===
            "review"
        ) {
          return null;
        }

        if (
          topic ===
          "service"
        ) {
          return {
            topic:
              "service",

            label:
              "Service Request",

            serviceSlug:
              selectedService
                ?.slug,

            serviceName:
              selectedService
                ?.name,

            packageId:
              selectedPackage
                ?.id,

            packageName:
              selectedPackage
                ?.name,

            reference:
              submission?.kind ===
              "service"
                ? submission
                    .reference
                : undefined,
          };
        }

        if (
          topic ===
          "product"
        ) {
          return {
            topic:
              "product",

            label:
              "Product Help",

            productSlug:
              selectedProduct
                ?.slug,

            productName:
              selectedProduct
                ?.name,

            reference:
              submission?.kind ===
              "support"
                ? submission
                    .reference
                : undefined,
          };
        }

        return {
          topic:
            "general",

          label:
            "General Support",

          subject:
            generalSubject
              .trim() ||
            undefined,

          reference:
            submission?.kind ===
            "support"
              ? submission
                  .reference
              : undefined,
        };
      },
      [
        topic,
        selectedService,
        selectedPackage,
        selectedProduct,
        generalSubject,
        submission,
      ]
    );

  useEffect(() => {
    if (
      !chatContext
    ) {
      return;
    }

    publishSupportChatContext(
      chatContext
    );
  }, [
    chatContext,
  ]);

  /* =======================================================
     CHANGE HANDLERS
  ======================================================= */

  function handleServiceChange(
    nextSlug: string
  ) {
    setServiceSlug(
      nextSlug
    );

    const nextService =
      serviceList.find(
        (
          service
        ) =>
          service.slug ===
          nextSlug
      );

    if (
      !nextService
    ) {
      return;
    }

    const nextPackages =
      buildServicePackages(
        nextService
      );

    setPackageId(
      getDefaultServicePackageId(
        nextPackages
      )
    );
  }

  function handleReviewKind(
    kind: ReviewKind
  ) {
    setReviewKind(
      kind
    );

    if (
      kind ===
      "Product"
    ) {
      setReviewSubject(
        productList[0]
          ?.slug ??
          ""
      );
    } else {
      setReviewSubject(
        serviceList[0]
          ?.slug ??
          ""
      );
    }
  }

  /* =======================================================
     SERVICE SUMMARY
  ======================================================= */

  function buildServiceSummary(
    reference: string
  ) {
    const lines = [
      "BIRDSHOP SERVICE REQUEST",
      "========================",
      `Reference: ${reference}`,
      "",
    ];

    if (
      displayName.trim()
    ) {
      lines.push(
        `Name: ${displayName.trim()}`
      );
    }

    lines.push(
      `Contact: ${contactHandle.trim()}`,
      "",
      "SERVICE",
      "-------",
      `Service: ${
        selectedService
          ?.name ??
        "Unknown Service"
      }`,
      `Package: ${
        selectedPackage
          ?.name ??
        "Unknown Package"
      }`,
      `Price: ${
        selectedPackage
          ? formatPrice(
              selectedPackage
                .price
            )
          : "TBD"
      }`,
      `Turnaround: ${
        selectedService
          ?.turnaround ??
        "TBD"
      }`,
      "",
      "MESSAGE",
      "-------",
      message.trim(),
      "",
      "Status: New Service Request",
      "Payment: Pending",
      "",
      "Continue through your private BirdShop service chat."
    );

    return lines.join(
      "\n"
    );
  }

  /* =======================================================
     SUPPORT SUMMARY
  ======================================================= */

  function buildSupportSummary(
    reference: string
  ) {
    const lines = [
      "BIRDSHOP SUPPORT REQUEST",
      "========================",
      `Reference: ${reference}`,
      "",
    ];

    if (
      displayName.trim()
    ) {
      lines.push(
        `Name: ${displayName.trim()}`
      );
    }

    lines.push(
      `Contact: ${contactHandle.trim()}`,
      ""
    );

    if (
      topic ===
      "product"
    ) {
      lines.push(
        "Request Type: Product Help",

        `Product: ${
          selectedProduct
            ?.name ??
          "Unknown Product"
        }`
      );

      if (
        selectedProduct
      ) {
        lines.push(
          `Platform: ${selectedProduct.platform}`,

          `Region: ${selectedProduct.region}`
        );
      }
    }

    if (
      topic ===
      "general"
    ) {
      lines.push(
        "Request Type: General Support",

        `Subject: ${
          generalSubject
            .trim() ||
          "General Question"
        }`
      );
    }

    if (
      orderReference
        .trim()
    ) {
      lines.push(
        `Order / Reference: ${orderReference.trim()}`
      );
    }

    lines.push(
      "",
      "MESSAGE",
      "-------",
      message.trim(),
      "",
      "Saved through BirdShop."
    );

    return lines.join(
      "\n"
    );
  }

  /* =======================================================
     REVIEW SUMMARY
  ======================================================= */

  function buildReviewSummary(
    reference: string
  ) {
    const reviewedName =
      reviewKind ===
      "Product"
        ? selectedReviewProduct
            ?.name
        : selectedReviewService
            ?.name;

    return [
      "BIRDSHOP REVIEW SUBMISSION",
      "==========================",
      `Reference: ${reference}`,
      `Experience: ${reviewKind}`,
      `Reviewed: ${
        reviewedName ??
        "Not Selected"
      }`,
      `Rating: ${rating}/5`,
      `Headline: ${reviewTitle.trim()}`,
      "",
      message.trim(),
      "",
      "Status: Pending moderation",
    ].join(
      "\n"
    );
  }

  /* =======================================================
     RESET
  ======================================================= */

  function resetSubmittedFields() {
    setDisplayName(
      ""
    );

    setContactHandle(
      ""
    );

    setGeneralSubject(
      ""
    );

    setOrderReference(
      ""
    );

    setMessage(
      ""
    );

    setReviewTitle(
      ""
    );

    setReviewDetails(
      ""
    );

    setWebsite(
      ""
    );
  }

  /* =======================================================
     SUBMIT SERVICE REQUEST
  ======================================================= */

  async function submitServiceRequest() {
    if (
      !selectedService
    ) {
      throw new Error(
        "Choose a BirdShop service before submitting."
      );
    }

    if (
      !selectedPackage
    ) {
      throw new Error(
        "Choose a service package before submitting."
      );
    }

    if (
      message.trim()
        .length >
      4000
    ) {
      throw new Error(
        "Service requests cannot exceed 4000 characters."
      );
    }

    const contact =
      contactHandle
        .trim();

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "submit_service_request",
        {
          p_display_name:
            displayName
              .trim() ||
            null,

          p_contact_handle:
            contact,

          p_message:
            message.trim(),

          p_service_slug:
            selectedService
              .slug,

          p_service_name:
            selectedService
              .name,

          p_package_id:
            selectedPackage
              .id,

          p_package_name:
            selectedPackage
              .name,

          p_package_price:
            selectedPackage
              .price,
        }
      );

    if (
      error
    ) {
      throw new Error(
        cleanErrorMessage(
          error.message
        )
      );
    }

    const reference =
      String(
        data ??
          ""
      ).trim();

    if (
      !reference
    ) {
      throw new Error(
        "BirdShop created the request but did not return a reference."
      );
    }

    /*
      The service order trigger creates the conversation
      during the order transaction.

      Now that the order exists, verify the customer using
      the SAME contact they submitted and retrieve the
      private conversation token.
    */

    let serviceChatToken:
      | string
      | null =
      null;

    const {
      data:
        chatTokenData,

      error:
        chatTokenError,
    } =
      await supabase.rpc(
        "birdshop_open_service_chat",
        {
          p_reference:
            reference,

          p_contact:
            contact,
        }
      );

    /*
      The service order itself has already been created.

      If token retrieval ever fails, do NOT tell the customer
      that the entire request failed. They still have their
      service reference and can enter it manually from
      /service-chat.
    */

    if (
      !chatTokenError &&
      chatTokenData
    ) {
      serviceChatToken =
        String(
          chatTokenData
        );
    }

    const summary =
      buildServiceSummary(
        reference
      );

    setSubmission({
      kind:
        "service",

      reference,

      summary,

      serviceChatToken,
    });

    publishSupportChatContext({
      topic:
        "service",

      label:
        "Service Request",

      serviceSlug:
        selectedService
          .slug,

      serviceName:
        selectedService
          .name,

      packageId:
        selectedPackage
          .id,

      packageName:
        selectedPackage
          .name,

      reference,
    });

    resetSubmittedFields();
  }

  /* =======================================================
     SUBMIT REVIEW
  ======================================================= */

  async function submitReview() {
    if (
      reviewTitle
        .trim()
        .length <
      4
    ) {
      throw new Error(
        "Add a short headline for your review."
      );
    }

    const reviewName =
      reviewKind ===
      "Product"
        ? selectedReviewProduct
            ?.name
        : selectedReviewService
            ?.name;

    const reviewSlug =
      reviewKind ===
      "Product"
        ? selectedReviewProduct
            ?.slug
        : selectedReviewService
            ?.slug;

    if (
      !reviewName ||
      !reviewSlug
    ) {
      throw new Error(
        "Choose what you are reviewing."
      );
    }

    const defaultMeta =
      reviewKind ===
      "Product"
        ? selectedReviewProduct
            ?.category ??
          "Digital Product"
        : "Service Experience";

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "submit_review",
        {
          p_type:
            reviewKind,

          p_reviewer:
            displayName
              .trim(),

          p_contact_handle:
            contactHandle
              .trim(),

          p_rating:
            rating,

          p_title:
            reviewTitle
              .trim(),

          p_body:
            message.trim(),

          p_subject_slug:
            reviewSlug,

          p_subject:
            reviewName,

          p_meta:
            reviewDetails
              .trim() ||
            defaultMeta,
        }
      );

    if (
      error
    ) {
      throw new Error(
        cleanErrorMessage(
          error.message
        )
      );
    }

    const reference =
      String(
        data ??
          ""
      );

    const summary =
      buildReviewSummary(
        reference
      );

    setSubmission({
      kind:
        "review",

      reference,

      summary,
    });

    resetSubmittedFields();
  }

  /* =======================================================
     SUBMIT PRODUCT / GENERAL SUPPORT
  ======================================================= */

  async function submitSupportRequest() {
    if (
      topic !==
        "product" &&
      topic !==
        "general"
    ) {
      throw new Error(
        "Invalid support request type."
      );
    }

    if (
      topic ===
        "product" &&
      !selectedProduct
    ) {
      throw new Error(
        "The product catalog is still loading. Try again in a moment."
      );
    }

    if (
      topic ===
        "general" &&
      generalSubject
        .trim()
        .length <
        3
    ) {
      throw new Error(
        "Add a short subject for your support request."
      );
    }

    const context:
      BirdShopSupportChatContext =
      topic ===
      "product"
        ? {
            topic:
              "product",

            label:
              "Product Help",

            productSlug:
              selectedProduct
                ?.slug,

            productName:
              selectedProduct
                ?.name,
          }
        : {
            topic:
              "general",

            label:
              "General Support",

            subject:
              generalSubject
                .trim() ||
              undefined,
          };

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "submit_support_request",
        {
          p_topic:
            topic,

          p_display_name:
            displayName
              .trim() ||
            null,

          p_contact_handle:
            contactHandle
              .trim(),

          p_message:
            message.trim(),

          p_general_subject:
            topic ===
            "general"
              ? generalSubject
                    .trim() ||
                null
              : null,

          p_order_reference:
            orderReference
              .trim() ||
            null,

          /*
            SERVICE VALUES ARE NOW ALWAYS NULL HERE.

            Service requests have their own order system.
          */

          p_service_slug:
            null,

          p_service_name:
            null,

          p_package_id:
            null,

          p_package_name:
            null,

          p_package_price:
            null,

          p_product_slug:
            topic ===
            "product"
              ? selectedProduct
                    ?.slug ??
                null
              : null,

          p_product_name:
            topic ===
            "product"
              ? selectedProduct
                    ?.name ??
                null
              : null,

          p_product_platform:
            topic ===
            "product"
              ? selectedProduct
                    ?.platform ??
                null
              : null,

          p_product_region:
            topic ===
            "product"
              ? selectedProduct
                    ?.region ??
                null
              : null,

          p_chat_context:
            context,
        }
      );

    if (
      error
    ) {
      throw new Error(
        cleanErrorMessage(
          error.message
        )
      );
    }

    const reference =
      String(
        data ??
          ""
      );

    const nextContext:
      BirdShopSupportChatContext =
      {
        ...context,
        reference,
      };

    publishSupportChatContext(
      nextContext
    );

    const summary =
      buildSupportSummary(
        reference
      );

    setSubmission({
      kind:
        "support",

      reference,

      summary,
    });

    resetSubmittedFields();
  }

  /* =======================================================
     MASTER SUBMIT
  ======================================================= */

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event
      .preventDefault();

    if (
      submitting
    ) {
      return;
    }

    setSubmitError(
      null
    );

    setCopied(
      false
    );

    if (
      !topic
    ) {
      setSubmitError(
        "Choose a support option before submitting."
      );

      return;
    }

    /*
      Honeypot.

      Real customers never see this field.
    */

    if (
      website.trim()
    ) {
      return;
    }

    if (
      contactHandle
        .trim()
        .length <
      2
    ) {
      setSubmitError(
        "Enter a Discord username or email so BirdShop can reach you."
      );

      return;
    }

    if (
      message
        .trim()
        .length <
      5
    ) {
      setSubmitError(
        "Please add a little more detail to your message."
      );

      return;
    }

    setSubmitting(
      true
    );

    try {
      if (
        topic ===
        "service"
      ) {
        await submitServiceRequest();
      } else if (
        topic ===
        "review"
      ) {
        await submitReview();
      } else {
        await submitSupportRequest();
      }

      window.setTimeout(
        () => {
          document
            .getElementById(
              "submitted-request"
            )
            ?.scrollIntoView({
              behavior:
                "smooth",

              block:
                "center",
            });
        },
        50
      );
    } catch (
      problem
    ) {
      setSubmitError(
        problem instanceof
          Error
          ? problem.message
          : "Something went wrong while submitting. Please try again."
      );
    } finally {
      setSubmitting(
        false
      );
    }
  }

  /* =======================================================
     COPY
  ======================================================= */

  async function copySubmission() {
    if (
      !submission
    ) {
      return;
    }

    try {
      await navigator
        .clipboard
        .writeText(
          submission
            .summary
        );

      setCopied(
        true
      );

      window.setTimeout(
        () =>
          setCopied(
            false
          ),
        1800
      );
    } catch {
      setCopied(
        false
      );
    }
  }

  /* =======================================================
     DISPLAY VALUES
  ======================================================= */

  const selectedTopicLabel =
    topics.find(
      (
        item
      ) =>
        item.id ===
        topic
    )?.label ??
    "Choose a Topic";

  const serviceChatHref =
    submission?.kind ===
    "service"
      ? submission
          .serviceChatToken
        ? `/service-chat?token=${encodeURIComponent(
            submission
              .serviceChatToken
          )}`
        : "/service-chat"
      : null;

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="page-shell">
      <SiteHeader />

      {/* ===================================================
          HERO
      =================================================== */}

      <section
        className={
          styles.hero
        }
      >
        <div
          className={
            styles.heroOverlay
          }
        />

        <div
          className={
            styles.heroLayout
          }
        >
          <div
            className={
              styles.heroCopy
            }
          >
            <p
              className={
                styles.eyebrow
              }
            >
              BIRDSHOP / SUPPORT
            </p>

            <h1>
              Let&apos;s talk.
            </h1>

            <p
              className={
                styles.heroDescription
              }
            >
              Service requests,
              product questions,
              feedback, or general
              support — start here and
              BirdShop will keep
              everything organized.
            </p>

            <div
              className={
                styles.heroFacts
              }
            >
              <span>
                <MessageIcon />

                Organized Requests
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

          <div
            className={
              styles.heroMark
            }
          >
            <span>
              BS
            </span>

            <div />

            <strong>
              CONTACT
            </strong>

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

      <section
        className={
          styles.processStrip
        }
      >
        <div>
          <span>
            01
          </span>

          <div>
            <strong>
              Choose a Topic
            </strong>

            <small>
              TELL US WHAT YOU NEED
            </small>
          </div>
        </div>

        <div>
          <span>
            02
          </span>

          <div>
            <strong>
              Add the Details
            </strong>

            <small>
              GIVE US THE CONTEXT
            </small>
          </div>
        </div>

        <div>
          <span>
            03
          </span>

          <div>
            <strong>
              Submit Securely
            </strong>

            <small>
              SAVED TO BIRDSHOP
            </small>
          </div>
        </div>

        <div>
          <span>
            04
          </span>

          <div>
            <strong>
              Continue Privately
            </strong>

            <small>
              SERVICE CHAT · DISCORD
            </small>
          </div>
        </div>
      </section>

      {/* ===================================================
          CONTACT
      =================================================== */}

      <section
        className={
          styles.contactSection
        }
      >
        <div
          className={
            styles.sectionHeading
          }
        >
          <div>
            <span>
              START A CONVERSATION
            </span>

            <h2>
              What can we help
              with?
            </h2>
          </div>

          <p>
            Choose the option that
            best matches what you
            need. Your selections
            appear in the summary
            automatically.
          </p>
        </div>

        {/* ===============================================
            TOPICS
        =============================================== */}

        <div
          className={
            styles.topicGrid
          }
        >
          {topics.map(
            (
              item
            ) => (
              <button
                key={
                  item.id
                }
                type="button"
                className={`${styles.topicCard} ${
                  topic ===
                  item.id
                    ? styles.topicActive
                    : ""
                }`}
                onClick={() => {
                  setTopic(
                    item.id
                  );

                  setSubmitError(
                    null
                  );

                  setSubmission(
                    null
                  );
                }}
              >
                <span
                  className={
                    styles.topicNumber
                  }
                >
                  {
                    item.number
                  }
                </span>

                <div>
                  <strong>
                    {
                      item.label
                    }
                  </strong>

                  <p>
                    {
                      item.description
                    }
                  </p>
                </div>

                <span
                  className={
                    styles.topicStatus
                  }
                >
                  {topic ===
                  item.id ? (
                    <CheckIcon />
                  ) : (
                    <ArrowIcon />
                  )}
                </span>
              </button>
            )
          )}
        </div>

        {topic && (
          <div
            className={
              styles.contactLayout
            }
          >
            {/* ===========================================
                FORM
            =========================================== */}

            <form
              className={
                styles.form
              }
              onSubmit={
                handleSubmit
              }
            >
              {/* =========================================
                  SERVICE
              ========================================= */}

              {topic ===
                "service" && (
                <section
                  className={
                    styles.formSection
                  }
                >
                  <div
                    className={
                      styles.formSectionHeading
                    }
                  >
                    <span>
                      SERVICE REQUEST
                    </span>

                    <h3>
                      Choose your
                      service.
                    </h3>

                    <p>
                      Select the
                      service and
                      package you
                      want BirdShop
                      to review with
                      you.
                    </p>
                  </div>

                  <label
                    className={
                      styles.field
                    }
                  >
                    <span>
                      SERVICE
                    </span>

                    <select
                      value={
                        serviceSlug
                      }
                      onChange={(
                        event
                      ) =>
                        handleServiceChange(
                          event
                            .target
                            .value
                        )
                      }
                    >
                      {serviceList.map(
                        (
                          service
                        ) => (
                          <option
                            key={
                              service.slug
                            }
                            value={
                              service.slug
                            }
                          >
                            {
                              service.name
                            }
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <div
                    className={
                      styles.packageArea
                    }
                  >
                    <span
                      className={
                        styles.fieldLabel
                      }
                    >
                      PACKAGE
                    </span>

                    <div
                      className={
                        styles.packageGrid
                      }
                    >
                      {packages.map(
                        (
                          option
                        ) => (
                          <button
                            key={
                              option.id
                            }
                            type="button"
                            onClick={() =>
                              setPackageId(
                                option.id
                              )
                            }
                            className={`${styles.packageButton} ${
                              packageId ===
                              option.id
                                ? styles.packageActive
                                : ""
                            }`}
                          >
                            <div>
                              <span>
                                {
                                  option.label
                                }
                              </span>

                              <strong>
                                {
                                  option.name
                                }
                              </strong>
                            </div>

                            <strong
                              className={
                                styles.packagePrice
                              }
                            >
                              {formatPrice(
                                option.price
                              )}
                            </strong>

                            {packageId ===
                              option.id && (
                              <CheckIcon />
                            )}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {selectedService && (
                    <div
                      className={
                        styles.servicePreview
                      }
                    >
                      <div>
                        <span>
                          TURNAROUND
                        </span>

                        <strong>
                          {
                            selectedService
                              .turnaround
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          DELIVERY
                        </span>

                        <strong>
                          {
                            selectedService
                              .delivery
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          SELECTED
                        </span>

                        <strong>
                          {selectedPackage
                            ?.name ??
                            "—"}
                        </strong>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* =========================================
                  PRODUCT
              ========================================= */}

              {topic ===
                "product" && (
                <section
                  className={
                    styles.formSection
                  }
                >
                  <div
                    className={
                      styles.formSectionHeading
                    }
                  >
                    <span>
                      PRODUCT SUPPORT
                    </span>

                    <h3>
                      Which product?
                    </h3>

                    <p>
                      Product Help
                      uses the same
                      live Supabase
                      catalog as the
                      storefront.
                    </p>
                  </div>

                  <label
                    className={
                      styles.field
                    }
                  >
                    <span>
                      PRODUCT
                    </span>

                    <select
                      value={
                        selectedProduct
                          ?.slug ??
                        ""
                      }
                      disabled={
                        !productsLoaded ||
                        productList.length ===
                          0
                      }
                      onChange={(
                        event
                      ) =>
                        setProductSlug(
                          event
                            .target
                            .value
                        )
                      }
                    >
                      {!productsLoaded && (
                        <option value="">
                          Loading
                          products...
                        </option>
                      )}

                      {productsLoaded &&
                        productList.length ===
                          0 && (
                          <option value="">
                            No products
                            available
                          </option>
                        )}

                      {productList.map(
                        (
                          product
                        ) => (
                          <option
                            key={
                              product.slug
                            }
                            value={
                              product.slug
                            }
                          >
                            {
                              product.name
                            }
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  {productsError && (
                    <p
                      className={
                        styles.formError
                      }
                    >
                      Product catalog
                      error:{" "}
                      {
                        productsError
                      }
                    </p>
                  )}

                  {selectedProduct && (
                    <div
                      className={
                        styles.productPreview
                      }
                    >
                      <div
                        className={
                          styles.productMark
                        }
                      >
                        {
                          selectedProduct
                            .initials
                        }
                      </div>

                      <div
                        className={
                          styles.productPreviewCopy
                        }
                      >
                        <span>
                          {
                            selectedProduct
                              .category
                          }
                        </span>

                        <strong>
                          {
                            selectedProduct
                              .name
                          }
                        </strong>

                        <p>
                          {
                            selectedProduct
                              .platform
                          }{" "}
                          ·{" "}
                          {
                            selectedProduct
                              .region
                          }
                        </p>
                      </div>

                      <strong
                        className={
                          styles.productPreviewPrice
                        }
                      >
                        {formatPrice(
                          selectedProduct
                            .price
                        )}
                      </strong>
                    </div>
                  )}

                  <label
                    className={
                      styles.field
                    }
                  >
                    <span>
                      ORDER /
                      REFERENCE

                      <small>
                        OPTIONAL
                      </small>
                    </span>

                    <input
                      type="text"
                      value={
                        orderReference
                      }
                      onChange={(
                        event
                      ) =>
                        setOrderReference(
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="Order number or other reference"
                      maxLength={
                        180
                      }
                    />
                  </label>
                </section>
              )}

              {/* =========================================
                  REVIEW
              ========================================= */}

              {topic ===
                "review" && (
                <section
                  className={
                    styles.formSection
                  }
                >
                  <div
                    className={
                      styles.formSectionHeading
                    }
                  >
                    <span>
                      SHARE FEEDBACK
                    </span>

                    <h3>
                      Tell us how it
                      went.
                    </h3>

                    <p>
                      Reviews are
                      submitted to
                      moderation
                      first. Approved
                      reviews can then
                      appear publicly.
                    </p>
                  </div>

                  <div
                    className={
                      styles.reviewKind
                    }
                  >
                    <button
                      type="button"
                      className={
                        reviewKind ===
                        "Product"
                          ? styles.reviewKindActive
                          : ""
                      }
                      onClick={() =>
                        handleReviewKind(
                          "Product"
                        )
                      }
                    >
                      Product
                    </button>

                    <button
                      type="button"
                      className={
                        reviewKind ===
                        "Service"
                          ? styles.reviewKindActive
                          : ""
                      }
                      onClick={() =>
                        handleReviewKind(
                          "Service"
                        )
                      }
                    >
                      Service
                    </button>
                  </div>

                  <label
                    className={
                      styles.field
                    }
                  >
                    <span>
                      REVIEWING
                    </span>

                    <select
                      value={
                        reviewSubject
                      }
                      disabled={
                        reviewKind ===
                          "Product" &&
                        !productsLoaded
                      }
                      onChange={(
                        event
                      ) =>
                        setReviewSubject(
                          event
                            .target
                            .value
                        )
                      }
                    >
                      {reviewKind ===
                      "Product"
                        ? productList.map(
                            (
                              product
                            ) => (
                              <option
                                key={
                                  product.slug
                                }
                                value={
                                  product.slug
                                }
                              >
                                {
                                  product.name
                                }
                              </option>
                            )
                          )
                        : serviceList.map(
                            (
                              service
                            ) => (
                              <option
                                key={
                                  service.slug
                                }
                                value={
                                  service.slug
                                }
                              >
                                {
                                  service.name
                                }
                              </option>
                            )
                          )}
                    </select>
                  </label>

                  <div
                    className={
                      styles.ratingField
                    }
                  >
                    <span
                      className={
                        styles.fieldLabel
                      }
                    >
                      YOUR RATING
                    </span>

                    <div
                      className={
                        styles.ratingButtons
                      }
                    >
                      {[
                        1,
                        2,
                        3,
                        4,
                        5,
                      ].map(
                        (
                          value
                        ) => (
                          <button
                            key={
                              value
                            }
                            type="button"
                            onClick={() =>
                              setRating(
                                value
                              )
                            }
                            className={
                              value <=
                              rating
                                ? styles.ratingActive
                                : ""
                            }
                            aria-label={`${value} star rating`}
                            aria-pressed={
                              value ===
                              rating
                            }
                          >
                            ★
                          </button>
                        )
                      )}
                    </div>

                    <small>
                      {rating}/5
                    </small>
                  </div>

                  <label
                    className={
                      styles.field
                    }
                  >
                    <span>
                      REVIEW HEADLINE
                    </span>

                    <input
                      type="text"
                      value={
                        reviewTitle
                      }
                      onChange={(
                        event
                      ) =>
                        setReviewTitle(
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="A short summary of your experience"
                      maxLength={
                        180
                      }
                      required
                    />
                  </label>

                  <label
                    className={
                      styles.field
                    }
                  >
                    <span>
                      DETAILS

                      <small>
                        OPTIONAL
                      </small>
                    </span>

                    <input
                      type="text"
                      value={
                        reviewDetails
                      }
                      onChange={(
                        event
                      ) =>
                        setReviewDetails(
                          event
                            .target
                            .value
                        )
                      }
                      placeholder={
                        reviewKind ===
                        "Service"
                          ? "Package or other useful detail"
                          : "Purchase type or other useful detail"
                      }
                      maxLength={
                        220
                      }
                    />
                  </label>
                </section>
              )}

              {/* =========================================
                  GENERAL
              ========================================= */}

              {topic ===
                "general" && (
                <section
                  className={
                    styles.formSection
                  }
                >
                  <div
                    className={
                      styles.formSectionHeading
                    }
                  >
                    <span>
                      GENERAL SUPPORT
                    </span>

                    <h3>
                      What&apos;s on
                      your mind?
                    </h3>

                    <p>
                      Questions,
                      account
                      concerns,
                      partnerships,
                      or anything
                      else.
                    </p>
                  </div>

                  <label
                    className={
                      styles.field
                    }
                  >
                    <span>
                      SUBJECT
                    </span>

                    <input
                      type="text"
                      value={
                        generalSubject
                      }
                      onChange={(
                        event
                      ) =>
                        setGeneralSubject(
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="What do you need help with?"
                      maxLength={
                        180
                      }
                      required
                    />
                  </label>

                  <label
                    className={
                      styles.field
                    }
                  >
                    <span>
                      ORDER /
                      REFERENCE

                      <small>
                        OPTIONAL
                      </small>
                    </span>

                    <input
                      type="text"
                      value={
                        orderReference
                      }
                      onChange={(
                        event
                      ) =>
                        setOrderReference(
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="Order number or other reference"
                      maxLength={
                        180
                      }
                    />
                  </label>
                </section>
              )}

              {/* =========================================
                  CUSTOMER
              ========================================= */}

              <section
                className={
                  styles.formSection
                }
              >
                <div
                  className={
                    styles.formSectionHeading
                  }
                >
                  <span>
                    YOUR DETAILS
                  </span>

                  <h3>
                    How can we reach
                    you?
                  </h3>

                  <p>
                    Your contact
                    information is
                    used only for
                    follow-up. It is
                    private and is
                    never shown on
                    the public
                    Reviews page.
                  </p>
                </div>

                <div
                  className={
                    styles.twoFields
                  }
                >
                  <label
                    className={
                      styles.field
                    }
                  >
                    <span>
                      DISPLAY NAME

                      <small>
                        OPTIONAL
                      </small>
                    </span>

                    <input
                      type="text"
                      value={
                        displayName
                      }
                      onChange={(
                        event
                      ) =>
                        setDisplayName(
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="Your name"
                      maxLength={
                        120
                      }
                    />
                  </label>

                  <label
                    className={
                      styles.field
                    }
                  >
                    <span>
                      DISCORD / EMAIL

                      <small>
                        PRIVATE · NOT
                        SHOWN PUBLICLY
                      </small>
                    </span>

                    <input
                      type="text"
                      value={
                        contactHandle
                      }
                      onChange={(
                        event
                      ) =>
                        setContactHandle(
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="@username or email"
                      maxLength={
                        240
                      }
                      required
                    />
                  </label>
                </div>

                <label
                  className={
                    styles.field
                  }
                >
                  <span>
                    MESSAGE
                  </span>

                  <textarea
                    value={
                      message
                    }
                    onChange={(
                      event
                    ) =>
                      setMessage(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder={
                      topic ===
                      "service"
                        ? "Tell us your goals, requirements, character/build information, and anything else we should know..."
                        : topic ===
                            "product"
                          ? "Explain your question or issue with the product..."
                          : topic ===
                              "review"
                            ? "Tell us what went well, what could be better, and anything you want other customers to know..."
                            : "Tell us what you need help with..."
                    }
                    rows={
                      7
                    }
                    maxLength={
                      topic ===
                      "service"
                        ? 4000
                        : topic ===
                            "review"
                          ? 5000
                          : 6000
                    }
                    required
                  />
                </label>

                {/* =======================================
                    HONEYPOT
                ======================================= */}

                <div
                  className={
                    styles.honeypot
                  }
                  aria-hidden="true"
                >
                  <label>
                    Website

                    <input
                      type="text"
                      tabIndex={
                        -1
                      }
                      autoComplete="off"
                      value={
                        website
                      }
                      onChange={(
                        event
                      ) =>
                        setWebsite(
                          event
                            .target
                            .value
                        )
                      }
                    />
                  </label>
                </div>

                {/* =======================================
                    NOTICE
                ======================================= */}

                <div
                  className={
                    styles.prepareNotice
                  }
                >
                  <ShieldIcon />

                  <p>
                    {topic ===
                    "service"
                      ? "Your request creates a private BirdShop service order and conversation. Final scope, timing, and payment are confirmed before work begins."
                      : topic ===
                          "review"
                        ? "Your review is saved as pending and will not appear publicly until a BirdShop admin approves it."
                        : "Your request is saved directly to BirdShop support. Discord remains available as an alternate way to continue the conversation."}
                  </p>
                </div>

                {submitError && (
                  <div
                    className={
                      styles.formError
                    }
                    role="alert"
                  >
                    {
                      submitError
                    }
                  </div>
                )}

                {/* =======================================
                    SUBMIT
                ======================================= */}

                <button
                  type="submit"
                  className={
                    styles.submitButton
                  }
                  disabled={
                    submitting
                  }
                >
                  {submitting
                    ? "Submitting..."
                    : topic ===
                        "service"
                      ? "Create Service Request"
                      : topic ===
                          "review"
                        ? "Submit Review"
                        : "Submit Request"}

                  <ArrowIcon />
                </button>
              </section>
            </form>

            {/* ===========================================
                SUMMARY
            =========================================== */}

            <aside
              className={
                styles.summaryCard
              }
            >
              <div
                className={
                  styles.summaryAccent
                }
              />

              <span>
                {topic ===
                "review"
                  ? "REVIEW SUMMARY"
                  : topic ===
                      "service"
                    ? "SERVICE SUMMARY"
                    : "REQUEST SUMMARY"}
              </span>

              <h2>
                {
                  liveTitle
                }
              </h2>

              <div
                className={
                  styles.summarySelected
                }
              >
                <span>
                  TYPE
                </span>

                <strong>
                  {
                    selectedTopicLabel
                  }
                </strong>
              </div>

              <div
                className={
                  styles.summaryFacts
                }
              >
                <div>
                  <span>
                    SELECTION
                  </span>

                  <strong>
                    {
                      liveDetail
                    }
                  </strong>
                </div>

                {livePrice && (
                  <div>
                    <span>
                      PRICE
                    </span>

                    <strong>
                      {
                        livePrice
                      }
                    </strong>
                  </div>
                )}

                {topic ===
                  "service" &&
                  selectedService && (
                    <div>
                      <span>
                        TURNAROUND
                      </span>

                      <strong>
                        {
                          selectedService
                            .turnaround
                        }
                      </strong>
                    </div>
                  )}

                {topic ===
                  "product" &&
                  selectedProduct && (
                    <div>
                      <span>
                        PLATFORM
                      </span>

                      <strong>
                        {
                          selectedProduct
                            .platform
                        }
                      </strong>
                    </div>
                  )}

                {topic ===
                  "review" && (
                  <div>
                    <span>
                      RATING
                    </span>

                    <strong>
                      {rating}/5
                    </strong>
                  </div>
                )}
              </div>

              <div
                className={
                  styles.summaryStatus
                }
              >
                {submission ? (
                  <CheckIcon />
                ) : (
                  <MessageIcon />
                )}

                <div>
                  <strong>
                    {submission
                      ? submission.kind ===
                        "service"
                        ? "Service request created."
                        : submission.kind ===
                            "review"
                          ? "Review submitted."
                          : "Request submitted."
                      : "Ready when you are."}
                  </strong>

                  <p>
                    {submission
                      ? `Reference ${submission.reference}`
                      : topic ===
                          "service"
                        ? "Submitting creates your BirdShop service reference and private conversation."
                        : topic ===
                            "review"
                          ? "Your review will enter moderation after submission."
                          : "Submit the form to create a BirdShop support reference."}
                  </p>
                </div>
              </div>

              <a
                href={
                  siteConfig
                    .discordUrl
                }
                target="_blank"
                rel="noreferrer"
                className={
                  styles.discordLink
                }
              >
                <DiscordIcon />

                Open BirdShop
                Discord

                <ArrowIcon />
              </a>

              <small
                className={
                  styles.discordNote
                }
              >
                {topic ===
                "service"
                  ? "Service requests continue inside the private BirdShop service chat. Discord remains available as an alternate contact method."
                  : "Product and support context can continue with BirdShop without changing this form system."}
              </small>
            </aside>
          </div>
        )}
      </section>

      {/* ===================================================
          SUBMISSION SUCCESS
      =================================================== */}

      {submission && (
        <section
          id="submitted-request"
          className={
            styles.preparedSection
          }
        >
          <div
            className={
              styles.preparedHeading
            }
          >
            <div>
              <span>
                {submission.kind ===
                "service"
                  ? "SERVICE REQUEST CREATED"
                  : submission.kind ===
                      "review"
                    ? "REVIEW RECEIVED"
                    : "REQUEST RECEIVED"}
              </span>

              <h2>
                {submission.kind ===
                "service"
                  ? "Your private service workspace is ready."
                  : submission.kind ===
                      "review"
                    ? "Your feedback is pending review."
                    : "Your support request is saved."}
              </h2>

              <p>
                {submission.kind ===
                "service"
                  ? "Keep your reference below. Use the private service chat to discuss the job, confirm scope, receive updates, and handle payment when BirdShop is ready to proceed."
                  : submission.kind ===
                      "review"
                    ? "Your review has been submitted for moderation. Keep the reference below if you need to contact BirdShop about it."
                    : "Keep the reference below. You can include it whenever you continue the conversation with BirdShop."}
              </p>
            </div>

            <div
              className={
                styles.preparedCheck
              }
            >
              <CheckIcon />
            </div>
          </div>

          <div
            className={
              styles.submittedReference
            }
          >
            <span>
              REFERENCE
            </span>

            <strong>
              {
                submission.reference
              }
            </strong>
          </div>

          <div
            className={
              styles.preparedCard
            }
          >
            <pre>
              {
                submission.summary
              }
            </pre>

            <div
              className={
                styles.preparedActions
              }
            >
              <button
                type="button"
                onClick={
                  copySubmission
                }
              >
                {copied ? (
                  <CheckIcon />
                ) : (
                  <CopyIcon />
                )}

                {copied
                  ? "Copied"
                  : "Copy Summary"}
              </button>

              {submission.kind ===
                "service" &&
                serviceChatHref && (
                  <Link
                    href={
                      serviceChatHref
                    }
                  >
                    <MessageIcon />

                    Open Private
                    Service Chat

                    <ArrowIcon />
                  </Link>
                )}

              <a
                href={
                  siteConfig
                    .discordUrl
                }
                target="_blank"
                rel="noreferrer"
              >
                <DiscordIcon />

                Continue on
                Discord

                <ArrowIcon />
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ===================================================
          SUPPORT PATHS
      =================================================== */}

      <section
        className={
          styles.supportSection
        }
      >
        <div
          className={
            styles.supportHeading
          }
        >
          <span>
            BIRDSHOP SUPPORT
          </span>

          <h2>
            Choose the right
            path.
          </h2>
        </div>

        <div
          className={
            styles.supportGrid
          }
        >
          <Link
            href="/faqs"
          >
            <div>
              <MessageIcon />
            </div>

            <span>
              <small>
                QUICK ANSWERS
              </small>

              <strong>
                Read the FAQs
              </strong>

              <p>
                Find answers to
                common questions
                before opening a
                request.
              </p>
            </span>

            <ArrowIcon />
          </Link>

          <Link
            href="/services"
          >
            <div>
              <PeopleIcon />
            </div>

            <span>
              <small>
                GAME SERVICES
              </small>

              <strong>
                Browse Services
              </strong>

              <p>
                Compare available
                packages and
                service options
                first.
              </p>
            </span>

            <ArrowIcon />
          </Link>

          <Link
            href="/products"
          >
            <div>
              <ShieldIcon />
            </div>

            <span>
              <small>
                DIGITAL STORE
              </small>

              <strong>
                Browse Products
              </strong>

              <p>
                Check platforms,
                regions, stock,
                and delivery
                information.
              </p>
            </span>

            <ArrowIcon />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}