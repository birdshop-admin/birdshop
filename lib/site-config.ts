const discordUrl =
  "https://discord.com";

export const siteConfig = {
  name:
    "BirdShop",

  displayName:
    "BIRDSHOP",

  description:
    "Digital products, game services, and community.",

  established:
    "2024",

  discordUrl,

  supportEmail:
    "",

  navigation: [
    {
      label:
        "Home",

      href:
        "/",
    },

    {
      label:
        "Products",

      href:
        "/products",
    },

    {
      label:
        "Services",

      href:
        "/services",
    },

    {
      label:
        "My Service",

      href:
        "/service-chat",
    },

    {
      label:
        "Reviews",

      href:
        "/reviews",
    },

    {
      label:
        "Contact",

      href:
        "/contact",
    },

    {
      label:
        "FAQs",

      href:
        "/faqs",
    },
  ],

  socials: {
    discord:
      discordUrl,

    instagram:
      null,

    youtube:
      null,

    x:
      null,
  },
} as const;