export type FAQCategory =
  "Products" | "Services" | "Orders & Payments" | "Delivery" | "Support";

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

export type FAQFilter = (typeof faqCategories)[number];

export const faqs: FAQ[] = [
  /* =======================================================
     PRODUCTS
  ======================================================= */

  {
    id: "what-is-birdshop",

    category: "Products",

    question: "What is BirdShop?",

    answer:
      "BirdShop is a digital storefront and game-service marketplace built around straightforward purchasing, clear service options, and direct community support. The store includes digital products such as game keys, gift cards, subscriptions, and add-ons alongside supported game services.",

    tags: ["birdshop", "store", "products", "services", "digital"],

    featured: true,
  },

  {
    id: "digital-products",

    category: "Products",

    question: "What kinds of digital products does BirdShop sell?",

    answer:
      "BirdShop can list digital game keys, gift cards, subscriptions, add-ons, and other supported digital items. Every product page is designed to show important information such as platform, region, delivery type, price, and availability before you continue.",

    tags: ["keys", "gift cards", "subscriptions", "addons", "products"],
  },

  {
    id: "platform-region",

    category: "Products",

    question:
      "How do I know whether a product works for my platform or region?",

    answer:
      "Check the platform and region shown directly on the product page before purchasing. BirdShop keeps those details visible so you can confirm compatibility before continuing. If anything is unclear, contact support before placing the order.",

    tags: ["platform", "region", "compatibility", "pc", "xbox", "playstation"],

    featured: true,
  },

  {
    id: "product-stock",

    category: "Products",

    question: "Can digital products go out of stock?",

    answer:
      "Yes. Some products may have limited availability. BirdShop tracks available quantity in the store and prevents the cart from exceeding the current stock amount. Products can also become unavailable temporarily while inventory is being replenished.",

    tags: ["stock", "inventory", "availability", "cart"],
  },

  {
    id: "product-details",

    category: "Products",

    question: "Where can I see everything included with a product?",

    answer:
      "Open the individual product page. It includes the product description, platform, region, delivery information, pricing, availability, and any additional information needed before purchasing.",

    tags: ["product page", "details", "information"],
  },

  /* =======================================================
     SERVICES
  ======================================================= */

  {
    id: "how-services-work",

    category: "Services",

    question: "How do BirdShop game services work?",

    answer:
      "Choose a service and open a Custom request through Contact. Discuss the scope in your private on-site chat. If payment is needed, BirdShop sends a payment request in that chat. Pay securely through Stripe; work stays open until it is completed.",

    tags: ["service", "request", "game service", "process"],

    featured: true,
  },

  {
    id: "service-packages",

    category: "Services",

    question: "What does a Custom service include?",

    answer:
      "Every service is Custom. The scope, timing, and price are agreed in your private chat before you pay. Starting a conversation does not create an order or charge you.",

    tags: ["custom", "service", "chat"],
  },

  {
    id: "custom-service",

    category: "Services",

    question: "What if the service I need is not listed?",

    answer:
      "Use the Custom Game Service option or open a general service request through Contact. Explain the game, what you need, your goals, and any relevant details. BirdShop can then determine whether the request can be supported and discuss the scope with you.",

    tags: ["custom", "request", "unlisted", "service"],
  },

  {
    id: "service-turnaround",

    category: "Services",

    question: "How long does a service take?",

    answer:
      "Turnaround depends on the game, package, scope, and current request. Each service shows an estimated turnaround, but the final timing should be confirmed before work begins. Larger or highly customized requests may take longer.",

    tags: ["time", "turnaround", "days", "service"],
  },

  {
    id: "service-changes",

    category: "Services",

    question: "Can I change the request after a service has started?",

    answer:
      "Small changes may be possible depending on the service and progress already completed. Larger changes can alter the scope, timing, or price. Discuss any requested changes with BirdShop before assuming they are included.",

    tags: ["changes", "scope", "service", "upgrade"],
  },

  /* =======================================================
     ORDERS & PAYMENTS
  ======================================================= */

  {
    id: "payment-methods",

    category: "Orders & Payments",

    question: "What payment methods does BirdShop accept?",

    answer:
      "Payments are handled securely by Stripe. The available methods appear in Stripe Checkout before you submit payment.",

    tags: ["payment", "card", "checkout", "pay"],
  },

  {
    id: "checkout-not-live",

    category: "Orders & Payments",

    question: "Why does my payment say confirming?",

    answer:
      "BirdShop waits for verified confirmation from Stripe. Returning from checkout alone does not prove payment. Keep your private status link and check your email. Contact support with your reference if confirmation is delayed.",

    tags: ["checkout", "payment", "integration", "cart"],
  },

  {
    id: "price-differences",

    category: "Orders & Payments",

    question: "How is a service priced?",

    answer:
      "Custom service pricing depends on the scope agreed in your private chat. Review the payment request amount and description before opening Stripe Checkout.",

    tags: ["custom", "service", "chat"],
  },

  {
    id: "service-final-price",

    category: "Orders & Payments",

    question: "Is a custom service quote final immediately?",

    answer:
      "Custom requests need to be reviewed first. BirdShop can confirm the scope, requirements, timing, and price before the service begins. A request should not be treated as confirmed until those details have been agreed upon.",

    tags: ["quote", "custom", "price", "service"],
  },

  {
    id: "refund-policy",

    category: "Orders & Payments",

    question: "How do I ask about a refund?",

    answer:
      "Contact BirdShop in your private chat or choose Product Support with your order reference. Eligibility depends on the product or service and its delivery or progress. Ask about the applicable terms before paying.",

    tags: ["refund", "return", "money", "policy"],
  },

  /* =======================================================
     DELIVERY
  ======================================================= */

  {
    id: "digital-delivery",

    category: "Delivery",

    question: "How are digital products delivered?",

    answer:
      "Select a product, add it to your cart, and pay through Stripe. After verified payment, BirdShop assigns the purchased quantity of codes and emails them to your checkout email address. Your private status page shows payment and delivery progress.",

    tags: ["delivery", "digital", "code", "key"],
  },

  {
    id: "physical-shipping",

    category: "Delivery",

    question: "Does BirdShop ship physical products?",

    answer:
      "The current BirdShop storefront is focused on digital products and game-related services. Products listed as digital do not require physical shipping.",

    tags: ["shipping", "physical", "digital"],
  },

  {
    id: "delivery-time",

    category: "Delivery",

    question: "How quickly will I receive a digital product?",

    answer:
      "Delivery is queued after verified payment. Processing or email delays can occur. Check your inbox and spam folder, then your private order status. If delivery needs attention, contact Product Support; you do not need to pay again.",

    tags: ["fast", "delivery", "time", "digital"],
  },

  {
    id: "wrong-code",

    category: "Delivery",

    question:
      "What should I do if there is a problem with a delivered digital item?",

    answer:
      "Do not discard any order information. Open Product Support from the Contact page and include the product, order or reference information, and a clear description of the issue. Avoid publicly posting any product code or private order information.",

    tags: ["code", "problem", "issue", "support", "delivery"],
  },

  /* =======================================================
     SUPPORT
  ======================================================= */

  {
    id: "contact-support",

    category: "Support",

    question: "How do I contact BirdShop?",

    answer:
      "Choose Services, Product Support, or General Support on Contact to start a private on-site conversation. Keep your private link. Reviews are submitted separately for moderation.",

    tags: ["contact", "support", "discord", "help"],
  },

  {
    id: "discord-support",

    category: "Support",

    question: "Does BirdShop use Discord for support?",

    answer:
      "Your private on-site chat is the main support channel. When a community invite is available, Discord is an optional backup. Never post codes or private chat links publicly.",

    tags: ["discord", "support", "community"],
  },

  {
    id: "what-to-include",

    category: "Support",

    question: "What information should I include when asking for help?",

    answer:
      "Include the product or service involved, your platform when relevant, any order or request reference you have, and a clear explanation of what happened or what you need. For services, include your goals and any important requirements.",

    tags: ["help", "information", "support", "order"],
  },

  {
    id: "reviews",

    category: "Support",

    question: "How can I leave a review?",

    answer:
      "Open Reviews and choose Leave a Review. Submit your rating and feedback for moderation; approved reviews appear publicly.",

    tags: ["review", "feedback", "rating"],
  },

  {
    id: "response-time",

    category: "Support",

    question: "How long does support take to respond?",

    answer:
      "Response times vary with request volume. Keep your private chat link to check for replies. Service turnaround is agreed separately in the conversation.",

    tags: ["response", "support", "time", "wait"],
  },
];
