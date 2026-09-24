export type FAQCategory =
  | "Products"
  | "Services"
  | "Orders & Payments"
  | "Delivery"
  | "Support";

export type FAQ = {
  id: string;

  category: FAQCategory;

  question: string;

  answer: string;

  tags: string[];

  featured?: boolean;
};

export const faqCategories = [
  "All Questions",
  "Products",
  "Services",
  "Orders & Payments",
  "Delivery",
  "Support",
] as const;

export type FAQFilter =
  (typeof faqCategories)[number];

export const faqs: FAQ[] = [
  /* =======================================================
     PRODUCTS
  ======================================================= */

  {
    id:
      "what-is-birdshop",

    category:
      "Products",

    question:
      "What is BirdShop?",

    answer:
      "BirdShop is a digital storefront and game-service marketplace built around straightforward purchasing, clear service options, and direct community support. The store includes digital products such as game keys, gift cards, subscriptions, and add-ons alongside supported game services.",

    tags: [
      "birdshop",
      "store",
      "products",
      "services",
      "digital",
    ],

    featured: true,
  },

  {
    id:
      "digital-products",

    category:
      "Products",

    question:
      "What kinds of digital products does BirdShop sell?",

    answer:
      "BirdShop can list digital game keys, gift cards, subscriptions, add-ons, and other supported digital items. Every product page is designed to show important information such as platform, region, delivery type, price, and availability before you continue.",

    tags: [
      "keys",
      "gift cards",
      "subscriptions",
      "addons",
      "products",
    ],
  },

  {
    id:
      "platform-region",

    category:
      "Products",

    question:
      "How do I know whether a product works for my platform or region?",

    answer:
      "Check the platform and region shown directly on the product page before purchasing. BirdShop keeps those details visible so you can confirm compatibility before continuing. If anything is unclear, contact support before placing the order.",

    tags: [
      "platform",
      "region",
      "compatibility",
      "pc",
      "xbox",
      "playstation",
    ],

    featured: true,
  },

  {
    id:
      "product-stock",

    category:
      "Products",

    question:
      "Can digital products go out of stock?",

    answer:
      "Yes. Some products may have limited availability. BirdShop tracks available quantity in the store and prevents the cart from exceeding the current stock amount. Products can also become unavailable temporarily while inventory is being replenished.",

    tags: [
      "stock",
      "inventory",
      "availability",
      "cart",
    ],
  },

  {
    id:
      "product-details",

    category:
      "Products",

    question:
      "Where can I see everything included with a product?",

    answer:
      "Open the individual product page. It includes the product description, platform, region, delivery information, pricing, availability, and any additional information needed before purchasing.",

    tags: [
      "product page",
      "details",
      "information",
    ],
  },

  /* =======================================================
     SERVICES
  ======================================================= */

  {
    id:
      "how-services-work",

    category:
      "Services",

    question:
      "How do BirdShop game services work?",

    answer:
      "Choose a supported service, review the available package options, and select the tier that best matches what you need. You can then start a request through the Contact page, explain your goals and requirements, and confirm the final scope before the service begins.",

    tags: [
      "service",
      "request",
      "game service",
      "process",
    ],

    featured: true,
  },

  {
    id:
      "service-packages",

    category:
      "Services",

    question:
      "What is the difference between Basic, Standard, and Premium?",

    answer:
      "Basic is the entry package for smaller or more focused requests. Standard expands the available scope and includes additional service benefits. Premium is intended for the largest or highest-priority version of a supported service. Each service page shows exactly what every tier includes before you choose.",

    tags: [
      "basic",
      "standard",
      "premium",
      "packages",
      "tiers",
    ],
  },

  {
    id:
      "previous-tier",

    category:
      "Services",

    question:
      "Does Standard or Premium include the lower package?",

    answer:
      "When a service is structured with multiple tiers, the higher package can include the previous tier along with its own additional benefits. Standard includes the Basic package when shown that way on the service page, while Premium can include both Basic and Standard benefits. The service page separates inherited features from the new upgrades so you can clearly see what each tier adds.",

    tags: [
      "included",
      "upgrade",
      "basic",
      "standard",
      "premium",
    ],
  },

  {
    id:
      "custom-service",

    category:
      "Services",

    question:
      "What if the service I need is not listed?",

    answer:
      "Use the Custom Game Service option or open a general service request through Contact. Explain the game, what you need, your goals, and any relevant details. BirdShop can then determine whether the request can be supported and discuss the scope with you.",

    tags: [
      "custom",
      "request",
      "unlisted",
      "service",
    ],
  },

  {
    id:
      "service-turnaround",

    category:
      "Services",

    question:
      "How long does a service take?",

    answer:
      "Turnaround depends on the game, package, scope, and current request. Each service shows an estimated turnaround, but the final timing should be confirmed before work begins. Larger or highly customized requests may take longer.",

    tags: [
      "time",
      "turnaround",
      "days",
      "service",
    ],
  },

  {
    id:
      "service-changes",

    category:
      "Services",

    question:
      "Can I change the request after a service has started?",

    answer:
      "Small changes may be possible depending on the service and progress already completed. Larger changes can alter the scope, timing, or price. Discuss any requested changes with BirdShop before assuming they are included.",

    tags: [
      "changes",
      "scope",
      "service",
      "upgrade",
    ],
  },

  /* =======================================================
     ORDERS & PAYMENTS
  ======================================================= */

  {
    id:
      "payment-methods",

    category:
      "Orders & Payments",

    question:
      "What payment methods does BirdShop accept?",

    answer:
      "BirdShop's final checkout integration is still being connected. Once checkout is live, the supported payment methods will be displayed directly during checkout before any payment is submitted.",

    tags: [
      "payment",
      "card",
      "checkout",
      "pay",
    ],
  },

  {
    id:
      "checkout-not-live",

    category:
      "Orders & Payments",

    question:
      "Why does checkout currently say payment integration will be connected later?",

    answer:
      "The storefront and cart experience are already being built, but the final payment provider has not yet been connected. BirdShop intentionally keeps the checkout button non-functional until the real payment and order-processing system is ready.",

    tags: [
      "checkout",
      "payment",
      "integration",
      "cart",
    ],
  },

  {
    id:
      "price-differences",

    category:
      "Orders & Payments",

    question:
      "Why do different service packages have different prices?",

    answer:
      "Higher service tiers are designed to support a larger scope or additional benefits. Basic begins with the smallest supported package, Standard expands on it, and Premium provides the largest available package. The exact pricing and included features are shown before you begin a request.",

    tags: [
      "price",
      "pricing",
      "basic",
      "standard",
      "premium",
      "packages",
      "service",
    ],
  },

  {
    id:
      "service-final-price",

    category:
      "Orders & Payments",

    question:
      "Is a custom service quote final immediately?",

    answer:
      "Custom requests need to be reviewed first. BirdShop can confirm the scope, requirements, timing, and price before the service begins. A request should not be treated as confirmed until those details have been agreed upon.",

    tags: [
      "quote",
      "custom",
      "price",
      "service",
    ],
  },

  {
    id:
      "refund-policy",

    category:
      "Orders & Payments",

    question:
      "What is the refund policy?",

    answer:
      "The final BirdShop refund and return policy will be published before live checkout is enabled. Because digital products and completed services can have different refund conditions, customers should review the final policy before purchasing once payments are available.",

    tags: [
      "refund",
      "return",
      "money",
      "policy",
    ],
  },

  /* =======================================================
     DELIVERY
  ======================================================= */

  {
    id:
      "digital-delivery",

    category:
      "Delivery",

    question:
      "How are digital products delivered?",

    answer:
      "BirdShop products are designed for digital delivery rather than physical shipping. The exact delivery format is shown on the product page. Once the final checkout and order system is connected, delivery instructions will be provided as part of the completed order.",

    tags: [
      "delivery",
      "digital",
      "code",
      "key",
    ],
  },

  {
    id:
      "physical-shipping",

    category:
      "Delivery",

    question:
      "Does BirdShop ship physical products?",

    answer:
      "The current BirdShop storefront is focused on digital products and game-related services. Products listed as digital do not require physical shipping.",

    tags: [
      "shipping",
      "physical",
      "digital",
    ],
  },

  {
    id:
      "delivery-time",

    category:
      "Delivery",

    question:
      "How quickly will I receive a digital product?",

    answer:
      "Delivery timing depends on the final order system and the specific product. Product pages show the intended delivery type, and BirdShop will provide the final delivery process once checkout is fully connected.",

    tags: [
      "fast",
      "delivery",
      "time",
      "digital",
    ],
  },

  {
    id:
      "wrong-code",

    category:
      "Delivery",

    question:
      "What should I do if there is a problem with a delivered digital item?",

    answer:
      "Do not discard any order information. Open Product Help from the Contact page and include the product, order or reference information, and a clear description of the issue. Avoid publicly posting any product code or private order information.",

    tags: [
      "code",
      "problem",
      "issue",
      "support",
      "delivery",
    ],
  },

  /* =======================================================
     SUPPORT
  ======================================================= */

  {
    id:
      "contact-support",

    category:
      "Support",

    question:
      "How do I contact BirdShop?",

    answer:
      "Use the Contact page to choose Service Request, Product Help, Leave Feedback, or General Support. Support requests are saved directly to BirdShop with a reference number, while reviews are submitted to moderation before they can appear publicly. Discord remains available as an alternate support channel, and live chat can later continue with the same request context.",

    tags: [
      "contact",
      "support",
      "discord",
      "help",
    ],
  },

  {
    id:
      "discord-support",

    category:
      "Support",

    question:
      "Does BirdShop use Discord for support?",

    answer:
      "Discord is available as an alternate BirdShop support channel alongside the website request system. Product Help, Service Requests, and General Support can be submitted through the site first, then continued through Discord when useful. The final BirdShop Discord invite should be connected before launch.",

    tags: [
      "discord",
      "support",
      "community",
    ],
  },

  {
    id:
      "what-to-include",

    category:
      "Support",

    question:
      "What information should I include when asking for help?",

    answer:
      "Include the product or service involved, your platform when relevant, any order or request reference you have, and a clear explanation of what happened or what you need. For services, include your goals and any important requirements.",

    tags: [
      "help",
      "information",
      "support",
      "order",
    ],
  },

  {
    id:
      "reviews",

    category:
      "Support",

    question:
      "How can I leave a review or feedback?",

    answer:
      "Open the Reviews page and choose Leave a Review, or select Leave Feedback directly from Contact. Choose whether the experience was for a product or service, select what you are reviewing, add a 1–5 rating, headline, and written feedback, then submit it. New reviews remain pending until a BirdShop admin approves them for the public Reviews page.",

    tags: [
      "review",
      "feedback",
      "rating",
    ],
  },

  {
    id:
      "response-time",

    category:
      "Support",

    question:
      "How long does support take to respond?",

    answer:
      "Response time can vary depending on request volume and the type of question. BirdShop should avoid promising an exact response time unless one can reliably be maintained. Service turnaround and support response time are separate.",

    tags: [
      "response",
      "support",
      "time",
      "wait",
    ],
  },
];