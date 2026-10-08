import type { Metadata } from "next";

import { faqs } from "@/lib/faqs";

export const metadata: Metadata = {
  title: "FAQs",
  description: "Answers to common questions about ordering, payment and delivery at BirdShop.",
};

// FAQPage structured data from the same lib/faqs entries the page renders,
// so search results never show an answer the page does not.
const faqJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
}).replace(/</g, "\\u003c");

export default function FaqsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqJsonLd }}
      />

      {children}
    </>
  );
}
