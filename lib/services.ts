export type Service = {
  slug: string;
  name: string;
  game: string;
  category: string;
  initials: string;

  shortDescription: string;
  description: string;

  startingPrice: number | null;

  turnaround: string;
  delivery: string;

  badge?: string;
  featured?: boolean;

  available: boolean;

  features: string[];
};

export const serviceList: Service[] = [
  {
    slug: "deepwoken-progression",
    name: "Deepwoken Progression",
    game: "Deepwoken",
    category: "Progression",
    initials: "DP",

    shortDescription:
      "Custom progression assistance built around your character, goals, and preferred progression path.",

    description:
      "A personalized Deepwoken progression service designed around your current character and progression goals.",

    startingPrice: 14.99,

    turnaround: "1–3 Days",
    delivery: "Custom Service",

    badge: "POPULAR",
    featured: true,

    available: true,

    features: [
      "Custom progression goals",
      "Progress updates",
      "Discord communication",
      "Flexible service options",
    ],
  },

  {
    slug: "deepwoken-build-setup",
    name: "Deepwoken Build Setup",
    game: "Deepwoken",
    category: "Build Setup",
    initials: "DB",

    shortDescription:
      "Help preparing and progressing toward a specific Deepwoken build or character setup.",

    description:
      "A build-focused Deepwoken service for customers working toward a particular character setup.",

    startingPrice: 19.99,

    turnaround: "1–4 Days",
    delivery: "Custom Service",

    badge: "FEATURED",

    available: true,

    features: [
      "Build-focused progression",
      "Goal planning",
      "Custom requirements",
      "Discord support",
    ],
  },

  {
    slug: "deepwoken-oath-preparation",
    name: "Deepwoken Oath Preparation",
    game: "Deepwoken",
    category: "Progression",
    initials: "DO",

    shortDescription:
      "Preparation assistance for players working toward a selected oath and its requirements.",

    description:
      "A focused service for preparing the progression and requirements involved with your selected oath.",

    startingPrice: 12.99,

    turnaround: "1–3 Days",
    delivery: "Custom Service",

    available: true,

    features: [
      "Requirement planning",
      "Progress guidance",
      "Goal tracking",
      "Custom requests",
    ],
  },

  {
    slug: "deepwoken-resource-run",
    name: "Deepwoken Resource Run",
    game: "Deepwoken",
    category: "Grinding",
    initials: "DR",

    shortDescription:
      "Assistance gathering selected resources and preparing for your next progression objective.",

    description:
      "Resource-focused help based around the materials and progression objectives you currently need.",

    startingPrice: 9.99,

    turnaround: "1–2 Days",
    delivery: "Custom Service",

    available: true,

    features: [
      "Selected resources",
      "Custom quantities",
      "Progress updates",
      "Flexible requests",
    ],
  },

  {
    slug: "deepwoken-new-character",
    name: "Deepwoken New Character Start",
    game: "Deepwoken",
    category: "Progression",
    initials: "DC",

    shortDescription:
      "A clean starting service for setting up a new Deepwoken character and early progression path.",

    description:
      "Designed for starting a new character with an organized progression direction from the beginning.",

    startingPrice: 11.99,

    turnaround: "1–2 Days",
    delivery: "Custom Service",

    available: true,

    features: [
      "New character setup",
      "Early progression",
      "Build direction",
      "Goal planning",
    ],
  },

  {
    slug: "deepwoken-boss-preparation",
    name: "Deepwoken Boss Preparation",
    game: "Deepwoken",
    category: "Coaching",
    initials: "BP",

    shortDescription:
      "Prepare your build, strategy, and progression before taking on a difficult encounter.",

    description:
      "A preparation-focused service for players wanting help getting ready for specific encounters.",

    startingPrice: 8.99,

    turnaround: "Same Day",
    delivery: "Guided Service",

    available: true,

    features: [
      "Build review",
      "Preparation checklist",
      "Strategy assistance",
      "Discord guidance",
    ],
  },

  {
    slug: "bloxburg-house-build",
    name: "Bloxburg House Building",
    game: "Bloxburg",
    category: "Building",
    initials: "BH",

    shortDescription:
      "Custom Bloxburg homes designed around your preferred style, budget, and property requirements.",

    description:
      "A complete Bloxburg house-building service based around your references, style, and requirements.",

    startingPrice: 24.99,

    turnaround: "2–7 Days",
    delivery: "Custom Build",

    badge: "BEST SELLER",
    featured: true,

    available: true,

    features: [
      "Custom house design",
      "Reference-based builds",
      "Room planning",
      "Exterior detailing",
    ],
  },

  {
    slug: "bloxburg-interior-design",
    name: "Bloxburg Interior Design",
    game: "Bloxburg",
    category: "Design",
    initials: "BI",

    shortDescription:
      "Interior redesigns and decorating for existing Bloxburg homes and custom builds.",

    description:
      "Interior design focused on furnishing, layouts, decorating, and improving existing spaces.",

    startingPrice: 12.99,

    turnaround: "1–4 Days",
    delivery: "Custom Build",

    available: true,

    features: [
      "Interior decorating",
      "Room redesign",
      "Furniture layouts",
      "Style matching",
    ],
  },

  {
    slug: "bloxburg-mansion-build",
    name: "Bloxburg Mansion Build",
    game: "Bloxburg",
    category: "Building",
    initials: "BM",

    shortDescription:
      "Large-scale luxury home construction for more detailed and ambitious Bloxburg projects.",

    description:
      "A larger custom-build option intended for detailed homes, estates, and luxury projects.",

    startingPrice: 49.99,

    turnaround: "4–10 Days",
    delivery: "Large Custom Build",

    badge: "PREMIUM",

    available: true,

    features: [
      "Large custom property",
      "Detailed floor plans",
      "Exterior design",
      "Interior planning",
    ],
  },

  {
    slug: "bloxburg-starter-home",
    name: "Bloxburg Starter Home",
    game: "Bloxburg",
    category: "Building",
    initials: "BS",

    shortDescription:
      "A polished smaller home for players wanting something affordable, clean, and complete.",

    description:
      "A smaller custom home designed around practical budgets without losing BirdShop's detailed design approach.",

    startingPrice: 14.99,

    turnaround: "1–3 Days",
    delivery: "Custom Build",

    available: true,

    features: [
      "Smaller house design",
      "Budget conscious",
      "Interior included",
      "Fast turnaround",
    ],
  },

  {
    slug: "bloxburg-landscaping",
    name: "Bloxburg Landscaping",
    game: "Bloxburg",
    category: "Design",
    initials: "BL",

    shortDescription:
      "Upgrade the outside of your property with landscaping, paths, plants, and exterior detailing.",

    description:
      "A focused landscaping service for improving the exterior presentation of an existing property.",

    startingPrice: 9.99,

    turnaround: "1–3 Days",
    delivery: "Custom Design",

    available: true,

    features: [
      "Plant placement",
      "Path design",
      "Outdoor detailing",
      "Style matching",
    ],
  },

  {
    slug: "bloxburg-room-makeover",
    name: "Bloxburg Room Makeover",
    game: "Bloxburg",
    category: "Design",
    initials: "BR",

    shortDescription:
      "Transform a single room or small area without rebuilding your entire Bloxburg property.",

    description:
      "A smaller interior-design option for individual rooms and focused home improvements.",

    startingPrice: 7.99,

    turnaround: "Same Day–2 Days",
    delivery: "Custom Design",

    available: true,

    features: [
      "Single-room redesign",
      "Furniture planning",
      "Theme matching",
      "Smaller projects",
    ],
  },

  {
    slug: "roblox-obby-coaching",
    name: "Roblox Obby Coaching",
    game: "Roblox",
    category: "Coaching",
    initials: "RO",

    shortDescription:
      "One-on-one help improving movement, timing, and consistency across difficult obstacle courses.",

    description:
      "A guided coaching service focused on helping players improve movement and obstacle-course consistency.",

    startingPrice: 8.99,

    turnaround: "Scheduled Session",
    delivery: "Guided Service",

    available: true,

    features: [
      "Movement guidance",
      "Practice sessions",
      "Technique review",
      "Discord communication",
    ],
  },

  {
    slug: "roblox-progression-help",
    name: "Roblox Game Progression",
    game: "Roblox",
    category: "Progression",
    initials: "RP",

    shortDescription:
      "Flexible progression assistance for supported Roblox games and specific player goals.",

    description:
      "A general Roblox progression option for supported games that do not have their own dedicated BirdShop listing.",

    startingPrice: 11.99,

    turnaround: "1–4 Days",
    delivery: "Custom Service",

    available: true,

    features: [
      "Multiple supported games",
      "Goal-based service",
      "Custom scope",
      "Progress updates",
    ],
  },

  {
    slug: "roblox-custom-task",
    name: "Roblox Custom Task",
    game: "Roblox",
    category: "Custom",
    initials: "RT",

    shortDescription:
      "Request a specific supported Roblox task that does not fit one of the standard service listings.",

    description:
      "A flexible Roblox service for custom requests, unusual tasks, or game-specific requirements.",

    startingPrice: null,

    turnaround: "Varies",
    delivery: "Custom Quote",

    available: true,

    features: [
      "Custom requirements",
      "Game-specific requests",
      "Quote before starting",
      "Discord consultation",
    ],
  },

  {
    slug: "minecraft-starter-base",
    name: "Minecraft Starter Base",
    game: "Minecraft",
    category: "Building",
    initials: "MS",

    shortDescription:
      "A complete starter base designed around your world, preferred style, and available space.",

    description:
      "A practical Minecraft base-building service for players wanting a polished early-game home.",

    startingPrice: 14.99,

    turnaround: "1–3 Days",
    delivery: "Custom Build",

    available: true,

    features: [
      "Custom starter base",
      "Storage layout",
      "Interior setup",
      "Style selection",
    ],
  },

  {
    slug: "minecraft-mega-base",
    name: "Minecraft Mega Base",
    game: "Minecraft",
    category: "Building",
    initials: "MM",

    shortDescription:
      "Large custom Minecraft structures for ambitious survival and creative-world projects.",

    description:
      "A large-scale Minecraft building option designed for detailed and ambitious projects.",

    startingPrice: 44.99,

    turnaround: "4–10 Days",
    delivery: "Large Custom Build",

    badge: "PREMIUM",

    available: true,

    features: [
      "Large-scale builds",
      "Custom themes",
      "Interior planning",
      "Detailed structures",
    ],
  },

  {
    slug: "minecraft-resource-gathering",
    name: "Minecraft Resource Gathering",
    game: "Minecraft",
    category: "Grinding",
    initials: "MR",

    shortDescription:
      "Resource-focused assistance for players preparing to build, craft, or expand their world.",

    description:
      "A flexible resource-oriented service based on the materials required for your next Minecraft goal.",

    startingPrice: 9.99,

    turnaround: "1–3 Days",
    delivery: "Custom Service",

    available: true,

    features: [
      "Selected resources",
      "Custom quantities",
      "Goal-based requests",
      "Progress updates",
    ],
  },

  {
    slug: "minecraft-redstone-setup",
    name: "Minecraft Redstone Setup",
    game: "Minecraft",
    category: "Build Setup",
    initials: "RS",

    shortDescription:
      "Help designing and setting up practical Redstone systems for your Minecraft builds.",

    description:
      "A technical build service for supported Redstone systems, mechanisms, and practical automation.",

    startingPrice: 12.99,

    turnaround: "1–4 Days",
    delivery: "Technical Build",

    available: true,

    features: [
      "Redstone planning",
      "System setup",
      "Troubleshooting",
      "Custom mechanisms",
    ],
  },

  {
    slug: "gta-heist-preparation",
    name: "GTA V Heist Preparation",
    game: "GTA V",
    category: "Coaching",
    initials: "GH",

    shortDescription:
      "Preparation and strategy help for players organizing supported GTA Online heist content.",

    description:
      "A coaching and preparation service focused on planning routes, roles, and approaches.",

    startingPrice: 9.99,

    turnaround: "Scheduled Session",
    delivery: "Guided Service",

    available: true,

    features: [
      "Preparation planning",
      "Role discussion",
      "Strategy assistance",
      "Discord guidance",
    ],
  },

  {
    slug: "gta-vehicle-setup",
    name: "GTA V Vehicle Setup Guide",
    game: "GTA V",
    category: "Build Setup",
    initials: "GV",

    shortDescription:
      "Help planning vehicle selections, customization direction, and garage organization.",

    description:
      "A guided GTA Online service focused on vehicle planning and customization direction.",

    startingPrice: 7.99,

    turnaround: "Same Day",
    delivery: "Guided Service",

    available: true,

    features: [
      "Vehicle recommendations",
      "Garage planning",
      "Customization ideas",
      "Budget planning",
    ],
  },

  {
    slug: "fortnite-coaching",
    name: "Fortnite Coaching",
    game: "Fortnite",
    category: "Coaching",
    initials: "FC",

    shortDescription:
      "Personal gameplay coaching focused on decision-making, mechanics, and overall consistency.",

    description:
      "A guided coaching session built around the areas of Fortnite you specifically want to improve.",

    startingPrice: 12.99,

    turnaround: "Scheduled Session",
    delivery: "Coaching Session",

    available: true,

    features: [
      "Gameplay review",
      "Decision-making",
      "Mechanical practice",
      "Personal feedback",
    ],
  },

  {
    slug: "fortnite-build-edit-coaching",
    name: "Fortnite Build & Edit Coaching",
    game: "Fortnite",
    category: "Coaching",
    initials: "FE",

    shortDescription:
      "Focused practice for building, editing, movement, and mechanical consistency.",

    description:
      "A mechanics-focused Fortnite coaching option for players wanting targeted build and edit practice.",

    startingPrice: 9.99,

    turnaround: "Scheduled Session",
    delivery: "Coaching Session",

    available: true,

    features: [
      "Build practice",
      "Edit practice",
      "Movement review",
      "Training routines",
    ],
  },

  {
    slug: "custom-game-service",
    name: "Custom Game Service",
    game: "Multi-Game",
    category: "Custom",
    initials: "CG",

    shortDescription:
      "Have something specific in mind? Request a personalized game service directly through BirdShop.",

    description:
      "A flexible service option for requests that do not fit one of BirdShop's standard listings.",

    startingPrice: null,

    turnaround: "Varies",
    delivery: "Custom Quote",

    badge: "CUSTOM",
    featured: true,

    available: true,

    features: [
      "Custom requests",
      "Multiple supported games",
      "Quote before purchase",
      "Discord consultation",
    ],
  },

  {
    slug: "custom-build-request",
    name: "Custom Build Request",
    game: "Multi-Game",
    category: "Custom",
    initials: "CB",

    shortDescription:
      "Send references and requirements for a completely custom building or design request.",

    description:
      "A flexible custom-build option for larger or unusual projects requiring a personalized quote.",

    startingPrice: null,

    turnaround: "Varies",
    delivery: "Custom Quote",

    available: true,

    features: [
      "Reference images",
      "Custom scope",
      "Personalized quote",
      "Large projects",
    ],
  },
];

export const serviceGames = [
  "All Services",
  "Deepwoken",
  "Bloxburg",
  "Roblox",
  "Minecraft",
  "GTA V",
  "Fortnite",
  "Multi-Game",
];

export const serviceCategories = [
  "All Types",
  "Progression",
  "Build Setup",
  "Building",
  "Design",
  "Grinding",
  "Coaching",
  "Custom",
];

export const services = Object.fromEntries(
  serviceList.map((service) => [
    service.slug,
    service,
  ])
) as Record<string, Service>;