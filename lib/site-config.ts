const invite = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL?.trim() ?? "";
const discordUrl =
  /^https:\/\/(discord\.gg\/[A-Za-z0-9-]+|discord\.com\/invite\/[A-Za-z0-9-]+)$/.test(
    invite,
  )
    ? invite
    : "/contact?topic=general";

export const siteConfig = {
  name: "BirdShop",

  displayName: "BIRDSHOP",

  description: "Digital products, game services, and community.",

  established: "2024",

  discordUrl,

  supportEmail: "",

  navigation: [
    { label: "How to Order", href: "/how-to-order" },
    {
      label: "Home",

      href: "/",
    },

    {
      label: "Products",

      href: "/products",
    },

    {
      label: "Services",

      href: "/services",
    },

    {
      label: "My Service",

      href: "/service-chat",
    },

    {
      label: "Reviews",

      href: "/reviews",
    },

    {
      label: "Contact",

      href: "/contact",
    },

    {
      label: "FAQs",

      href: "/faqs",
    },
  ],

  socials: {
    discord: discordUrl,

    instagram: null,

    youtube: null,

    x: null,
  },
} as const;
