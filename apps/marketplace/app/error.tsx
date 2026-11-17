"use client";
import Link from "next/link";
export default function ErrorPage({reset}:{reset:()=>void}){return <main id="site-content" className="market-error"><h1>We couldn’t load this page.</h1><p>Please try again. Your order and payment status have not changed.</p><button onClick={reset}>Try again</button><Link href="/">Back to marketplace</Link></main>;}
