import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { ArrowIcon, ShieldIcon, MessageIcon, CheckIcon } from "@/components/SiteIcons";
import s from "./how-to-order.module.css";
export const metadata = { title: "How to Order", description: "Choose your BirdShop package, pay securely and continue in your private chat. Digital products and custom requests explained." };
const paths = [
  { id: "services", number: "01", label: "READY-TO-BUY SERVICES", title: "Your package. Your next step.", intro: "Know what you need? Choose a defined package and go straight to checkout.", href: "/services", action: "Explore service packages", steps: [
    ["Choose your tier", "Compare Basic, Standard and Premium. Review the price, included work and turnaround before you buy."],
    ["Make it yours", "Enter your name and email, then complete secure payment through Stripe. No ticket or quote request is needed."],
    ["Step into your private chat", "Checkout brings you back to BirdShop and opens your conversation. Your order appears once payment is confirmed."],
    ["Plan the details together", "Share references, requirements and scheduling details. Keep the conversation and progress updates in one place."] ] },
  { id: "products", number: "02", label: "DIGITAL PRODUCTS", title: "Find it. Order it. Enjoy it.", intro: "A simple checkout for game keys and other digital products.", href: "/products", action: "Browse digital products", steps: [
    ["Find the right product", "Check the product description, platform, region and available stock."],
    ["Review your cart", "Choose your quantity and enter the email address you want to use for your order."],
    ["Complete secure checkout", "Pay through Stripe. BirdShop confirms payment before assigning your purchased codes."],
    ["Receive your delivery", "Check your email for delivery and keep your private order link to follow its status."] ] },
  { id: "custom", number: "03", label: "SOMETHING MORE PERSONAL", title: "Let’s shape it together.", intro: "For work beyond a listed package, start with a conversation.", href: "/contact?topic=service", action: "Discuss a custom service", steps: [
    ["Tell us your idea", "Choose a service and describe what you have in mind through Contact."],
    ["Agree on the details", "Discuss scope, timing and price in your private chat before committing."],
    ["Pay the agreed quote", "When your payment request is ready, open it directly from the conversation."],
    ["Keep everything together", "After payment is confirmed, your order and next steps stay connected to that same chat."] ] },
];
export default function HowToOrder() {
 return <main className="page-shell"><SiteHeader />
  <section className={s.hero}>
   <div><span className={s.eyebrow}>THE BIRDSHOP EXPERIENCE</span><h1>A clear path.<br /><em>From choice to delivery.</em></h1><p>Find what fits, checkout with confidence, and leave the next steps to a conversation.</p><div className={s.heroActions}><Link href="#services">Find your way <ArrowIcon /></Link><Link href="/service-chat">Return to your chat</Link></div></div>
   <aside className={s.journey}><span>THOUGHTFULLY SIMPLE</span><h2>Good service starts<br />with clarity.</h2>{[["01", "Choose what fits", "Defined packages or something custom."], ["02", "Checkout securely", "A clear price before you commit."], ["03", "Keep in touch", "Your private space for the next steps."]].map(([n,t,d]) => <div key={n}><b>{n}</b><p><strong>{t}</strong><small>{d}</small></p></div>)}</aside>
  </section>
  <nav className={s.pathNav} aria-label="Order guides">{paths.map(p => <Link href={'#'+p.id} key={p.id}><span>{p.number}</span>{p.label}<ArrowIcon /></Link>)}</nav>
  <div className={s.guides}>{paths.map(p => <section id={p.id} className={s.guide} key={p.id}><header><span className={s.eyebrow}>{p.label}</span><h2>{p.title}</h2><p>{p.intro}</p><Link href={p.href}>{p.action}<ArrowIcon /></Link></header><ol>{p.steps.map(([title,copy],i) => <li key={title}><span>{String(i+1).padStart(2,'0')}</span><div><h3>{title}</h3><p>{copy}</p></div></li>)}</ol></section>)}</div>
  <section className={s.assurance}><div><ShieldIcon /><h3>Secure checkout</h3><p>Payments are handled through Stripe.</p></div><div><MessageIcon /><h3>A private conversation</h3><p>Service details and updates stay together.</p></div><div><CheckIcon /><h3>Here for the next step</h3><p>Need help with delivery? Contact us with your reference.</p></div></section>
  <section className={s.help}><div><span className={s.eyebrow}>A LITTLE EXTRA GUIDANCE</span><h2>Still have a question?</h2><p>Payment confirmation and email delivery can take a moment. Check your order status and spam folder, or get in touch if you need a hand.</p></div><Link href="/contact">Talk to BirdShop <ArrowIcon /></Link></section>
  <SiteFooter /></main>;
}
