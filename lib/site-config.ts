const invite = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL?.trim() ?? "";
const discordUrl =
  /^https:\/\/(discord\.gg\/[A-Za-z0-9-]+|discord\.com\/invite\/[A-Za-z0-9-]+)$/.test(
    invite,
  )
    ? invite
    : "/contact?topic=general";

// A real invite opens in a new tab; the Contact fallback stays in this tab.
export const hasDiscordInvite = discordUrl.startsWith("https://");
export const discordLinkProps = hasDiscordInvite
  ? ({ target: "_blank", rel: "noreferrer" } as const)
  : {};

export const siteConfig = {
  name: "BirdShop",

  displayName: "BIRDSHOP",

  description: "Digital products, game services, and community.",

  established: "2024",

  discordUrl,

  supportEmail: "",

  // One order for the header, the mobile menu and the footer.
  navigation: [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    { label: "Services", href: "/services" },
    { label: "How to Order", href: "/how-to-order" },
    { label: "My Service", href: "/service-chat" },
    { label: "Reviews", href: "/reviews" },
    { label: "FAQs", href: "/faqs" },
    { label: "Contact", href: "/contact" },
  ],

  socials: {
    discord: discordUrl,

    instagram: null,

    youtube: null,

    x: null,
  },
} as const;
