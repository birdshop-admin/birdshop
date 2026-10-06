"use client";
import { useState } from "react";
import Link from "next/link";
import type { Service } from "@/lib/services";
import { ArrowIcon } from "@/components/SiteIcons";
import ServiceEditor from "./ServiceEditor";
import s from "./services.module.css";
type Entry = { service: Service; visible: boolean };
export default function ServiceCatalog({ services }: { services: Entry[] }) {
 const [query, setQuery] = useState("");
 const [filter, setFilter] = useState("all");
 const live = (service: Service) => service.packages?.filter(p => p.enabled && p.cents !== null).length ?? 0;
 const filtered = services.filter(({service,visible}) => `${service.name} ${service.game} ${service.category}`.toLowerCase().includes(query.toLowerCase()) && (filter === "all" || (filter === "visible" ? visible : filter === "hidden" ? !visible : live(service) < 3)));
 return <div className={s.catalog}>
  <div className={s.metrics}>{[["Services",services.length],["Visible",services.filter(s => s.visible).length],["Packages enabled",services.reduce((n,s) => n+live(s.service),0)]].map(([label,n]) => <article key={label}><span>{label}</span><strong>{n}</strong></article>)}</div>
  <details className={s.newService}><summary><span><b>＋ Add a new service</b><small>Create a listing and define its three packages.</small></span><span className={s.expand}>+</span></summary><ServiceEditor /></details>
  <section className={s.catalogPanel}>
   <header className={s.catalogHeader}><div><span>YOUR CATALOG</span><h2>Services & packages</h2><p>Set a price, scope and included work for each tier, then enable purchase and save.</p></div><Link href="/services" target="_blank" rel="noreferrer">View storefront <ArrowIcon /></Link></header>
   <div className={s.toolbar}><label><span>Find a service</span><input type="search" placeholder="Search name, game or category…" value={query} onChange={e => setQuery(e.target.value)} /></label><label><span>Show</span><select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All services</option><option value="visible">Visible services</option><option value="hidden">Hidden services</option><option value="setup">Packages to set up</option></select></label><p>{filtered.length} of {services.length} services</p></div>
   <div className={s.serviceList}>{filtered.map(({service,visible}) => <details className={s.serviceRow} key={service.slug}><summary><span className={s.monogram} aria-hidden="true">{service.initials}</span><span className={s.serviceName}><small>{service.game} · {service.category}</small><strong>{service.name}</strong><span>{live(service)} of 3 packages enabled</span></span><span className={s.status}>{!visible ? "Hidden" : !service.available ? "Paused" : "Visible"}</span><span className={s.expand} aria-hidden="true">+</span></summary><ServiceEditor service={service} visible={visible}/></details>)}</div>
   {!filtered.length && <p className={s.empty}>No services match. Try another search or add a new service.</p>}
  </section>
 </div>;
}
