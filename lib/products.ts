export type ProductGalleryItem = {
  id: string;
  label: string;
  display: string;
  src?: string;
};

export type Product = {
  name: string;
  slug: string;
  category: string;
  platform: string;
  region: string;
  price: number;
  oldPrice?: number;
  badge?: string;
  stock: number;
  delivery: string;
  description: string;
  shortDescription: string;
  codeFormat: string;
  initials: string;
  gallery: ProductGalleryItem[];
};

export const products: Record<string, Product> = {
  "steam-wallet-20": {
    name: "Steam Wallet $20",
    slug: "steam-wallet-20",
    category: "Gift Cards",
    platform: "PC / Steam",
    region: "United States",
    price: 20,
    badge: "Popular",
    stock: 42,
    delivery: "Instant Digital Delivery",
    description:
      "Add funds directly to your Steam Wallet and use them toward games, downloadable content, software, and eligible Steam purchases.",
    shortDescription:
      "A $20 digital Steam Wallet code delivered electronically after purchase.",
    codeFormat: "Digital redemption code",
    initials: "SW",

    gallery: [
      {
        id: "main",
        label: "Main",
        display: "SW",
      },
      {
        id: "value",
        label: "Value",
        display: "$20",
      },
      {
        id: "code",
        label: "Redemption",
        display: "CODE",
      },
      {
        id: "region",
        label: "Region",
        display: "US",
      },
    ],
  },

  "minecraft-java-bedrock": {
    name: "Minecraft Java & Bedrock",
    slug: "minecraft-java-bedrock",
    category: "Game Keys",
    platform: "PC",
    region: "United States",
    price: 29.99,
    oldPrice: 34.99,
    badge: "Best Seller",
    stock: 18,
    delivery: "Instant Digital Delivery",
    description:
      "Get Minecraft Java Edition and Bedrock Edition for PC with one digital purchase. Explore, build, survive, and play across supported Minecraft experiences.",
    shortDescription:
      "Minecraft Java and Bedrock access delivered as a digital game key.",
    codeFormat: "Digital game key",
    initials: "MJ",

    gallery: [
      {
        id: "main",
        label: "Main",
        display: "MJ",
      },
      {
        id: "java",
        label: "Java",
        display: "JAVA",
      },
      {
        id: "bedrock",
        label: "Bedrock",
        display: "BR",
      },
      {
        id: "pc",
        label: "Platform",
        display: "PC",
      },
    ],
  },

  "roblox-gift-card-10": {
    name: "Roblox Gift Card $10",
    slug: "roblox-gift-card-10",
    category: "Gift Cards",
    platform: "Multi Platform",
    region: "United States",
    price: 10,
    stock: 55,
    delivery: "Instant Digital Delivery",
    description:
      "Redeem a Roblox gift card toward Robux or eligible Roblox purchases. Your digital redemption code is delivered electronically.",
    shortDescription:
      "A $10 Roblox digital gift card for supported Roblox purchases.",
    codeFormat: "Digital gift card code",
    initials: "RG",

    gallery: [
      {
        id: "main",
        label: "Main",
        display: "RG",
      },
      {
        id: "value",
        label: "Value",
        display: "$10",
      },
      {
        id: "robux",
        label: "Robux",
        display: "R$",
      },
      {
        id: "code",
        label: "Redeem",
        display: "CODE",
      },
    ],
  },

  "xbox-game-pass-ultimate": {
    name: "Xbox Game Pass Ultimate",
    slug: "xbox-game-pass-ultimate",
    category: "Subscriptions",
    platform: "Xbox / PC",
    region: "United States",
    price: 16.99,
    badge: "Popular",
    stock: 26,
    delivery: "Instant Digital Delivery",
    description:
      "Access the supported benefits included with Xbox Game Pass Ultimate using a digital subscription code.",
    shortDescription:
      "Digital Xbox Game Pass Ultimate subscription code.",
    codeFormat: "Digital subscription code",
    initials: "XG",

    gallery: [
      {
        id: "main",
        label: "Main",
        display: "XG",
      },
      {
        id: "xbox",
        label: "Xbox",
        display: "XBOX",
      },
      {
        id: "pc",
        label: "PC",
        display: "PC",
      },
      {
        id: "code",
        label: "Code",
        display: "CODE",
      },
    ],
  },

  "playstation-store-25": {
    name: "PlayStation Store $25",
    slug: "playstation-store-25",
    category: "Gift Cards",
    platform: "PlayStation",
    region: "United States",
    price: 25,
    stock: 31,
    delivery: "Instant Digital Delivery",
    description:
      "Add funds to an eligible PlayStation account for supported digital games, add-ons, and other PlayStation Store purchases.",
    shortDescription:
      "A $25 PlayStation Store digital gift card.",
    codeFormat: "Digital gift card code",
    initials: "PS",

    gallery: [
      {
        id: "main",
        label: "Main",
        display: "PS",
      },
      {
        id: "value",
        label: "Value",
        display: "$25",
      },
      {
        id: "store",
        label: "Store",
        display: "PSN",
      },
      {
        id: "code",
        label: "Redeem",
        display: "CODE",
      },
    ],
  },

  "discord-nitro": {
    name: "Discord Nitro",
    slug: "discord-nitro",
    category: "Subscriptions",
    platform: "Multi Platform",
    region: "Supported Regions",
    price: 9.99,
    stock: 7,
    delivery: "Instant Digital Delivery",
    description:
      "Redeem a digital Discord Nitro code for supported Nitro membership benefits on an eligible Discord account.",
    shortDescription:
      "Digital Discord Nitro subscription code.",
    codeFormat: "Digital subscription code",
    initials: "DN",

    gallery: [
      {
        id: "main",
        label: "Main",
        display: "DN",
      },
      {
        id: "nitro",
        label: "Nitro",
        display: "N",
      },
      {
        id: "multi",
        label: "Platform",
        display: "MULTI",
      },
      {
        id: "code",
        label: "Code",
        display: "CODE",
      },
    ],
  },

  "fortnite-vbucks": {
    name: "Fortnite V-Bucks",
    slug: "fortnite-vbucks",
    category: "Add-ons",
    platform: "Multi Platform",
    region: "United States",
    price: 22.99,
    oldPrice: 24.99,
    stock: 23,
    delivery: "Instant Digital Delivery",
    description:
      "Digital Fortnite V-Bucks code for eligible cosmetic items and supported in-game purchases.",
    shortDescription:
      "Fortnite V-Bucks delivered through a digital redemption code.",
    codeFormat: "Digital add-on code",
    initials: "FV",

    gallery: [
      {
        id: "main",
        label: "Main",
        display: "FV",
      },
      {
        id: "bucks",
        label: "Currency",
        display: "VB",
      },
      {
        id: "multi",
        label: "Platform",
        display: "MULTI",
      },
      {
        id: "code",
        label: "Code",
        display: "CODE",
      },
    ],
  },

  "valorant-points": {
    name: "Valorant Points",
    slug: "valorant-points",
    category: "Add-ons",
    platform: "PC",
    region: "United States",
    price: 19.99,
    stock: 36,
    delivery: "Instant Digital Delivery",
    description:
      "Digital Valorant Points code for supported cosmetic and in-game purchases on an eligible account.",
    shortDescription:
      "Valorant Points digital redemption code.",
    codeFormat: "Digital add-on code",
    initials: "VP",

    gallery: [
      {
        id: "main",
        label: "Main",
        display: "VP",
      },
      {
        id: "points",
        label: "Points",
        display: "PTS",
      },
      {
        id: "pc",
        label: "Platform",
        display: "PC",
      },
      {
        id: "code",
        label: "Code",
        display: "CODE",
      },
    ],
  },

  "deluxe-game-key": {
    name: "Deluxe Game Key",
    slug: "deluxe-game-key",
    category: "Game Keys",
    platform: "PC",
    region: "United States",
    price: 39.99,
    badge: "New",
    stock: 14,
    delivery: "Instant Digital Delivery",
    description:
      "A digital game key placeholder ready to be replaced with one of your actual BirdShop products.",
    shortDescription:
      "Digital game key delivered electronically.",
    codeFormat: "Digital game key",
    initials: "DG",

    gallery: [
      {
        id: "main",
        label: "Main",
        display: "DG",
      },
      {
        id: "deluxe",
        label: "Edition",
        display: "DX",
      },
      {
        id: "pc",
        label: "Platform",
        display: "PC",
      },
      {
        id: "code",
        label: "Code",
        display: "KEY",
      },
    ],
  },
};

export const productList = Object.values(products);

export const productCategories = [
  "All Products",
  "Game Keys",
  "Gift Cards",
  "Subscriptions",
  "Add-ons",
];