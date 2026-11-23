import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
export const metadata:Metadata={title:{default:"BirdShop Marketplace — Your next great find",template:"%s | BirdShop Marketplace"},description:"Discover digital products and game services from independent, owner-approved BirdShop sellers.",robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body><a className="skip-link" href="#site-content">Skip to content</a><SiteHeader/>{children}<SiteFooter/></body></html>;}
