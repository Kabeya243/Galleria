// Gallery lightbox of a published advanced site — verbatim copy of
// the standalone builder's gallery-lightbox.tsx, with lucide icons
// (UI/UX pass 8 Nov 2026) and focus returned to the tile that opened it.
"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type GalleryWork = {
  title: string;
  image?: string;
  category?: string;
};

export function GalleryLightbox({ works, className }: { works: GalleryWork[]; className?: string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState("Tout");
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const categories = [...new Set(works.map((work) => work.category).filter((category): category is string => Boolean(category)))];
  const visibleWorks = works.map((work, index) => ({ work, index })).filter(({ work }) => activeCategory === "Tout" || work.category === activeCategory);
  const activePosition = visibleWorks.findIndex(({ index }) => index === activeIndex);

  function moveLightbox(offset: number) {
    if (activePosition < 0 || !visibleWorks.length) return;
    const nextPosition = (activePosition + offset + visibleWorks.length) % visibleWorks.length;
    setActiveIndex(visibleWorks[nextPosition].index);
  }

  useEffect(() => {
    if (activeIndex === null) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowRight") moveLightbox(1);
      if (event.key === "ArrowLeft") moveLightbox(-1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, activePosition, visibleWorks.length]);

  const activeWork = activeIndex === null ? null : works[activeIndex];

  // Focus the close button when the lightbox opens, and give focus back
  // to the tile that opened it when it closes.
  useEffect(() => {
    if (activeIndex === null) {
      triggerRef.current?.focus();
      triggerRef.current = null;
    } else {
      closeRef.current?.focus();
    }
  }, [activeIndex]);

  return <>
    {categories.length > 0 && <div className="gallery-filters" aria-label="Filtrer les œuvres">
      {["Tout", ...categories].map((category) => <button key={category} type="button" className={activeCategory === category ? "active" : ""} aria-pressed={activeCategory === category} onClick={() => { setActiveCategory(category); setActiveIndex(null); }}>{category}</button>)}
    </div>}
    <div className={className}>
      {visibleWorks.map(({ work, index }) => {
        const content = <>
          {work.image && <img src={work.image} alt={work.title} loading="lazy" />}
          <span>{work.title}</span>
        </>;
        return <div key={`${work.title}-${index}`} className={`published-art art-${index % 3 + 1}`}>
          {work.image
            ? <button className="gallery-work-button" type="button" onClick={(event) => { triggerRef.current = event.currentTarget; setActiveIndex(index); }} aria-label={`Agrandir : ${work.title}`}>{content}</button>
            : content}
        </div>;
      })}
    </div>
    {activeWork?.image && <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={activeWork.title} onClick={() => setActiveIndex(null)}>
      <button ref={closeRef} className="gallery-lightbox-close" type="button" onClick={() => setActiveIndex(null)} aria-label="Fermer l’aperçu"><X size={22} aria-hidden="true" /></button>
      {visibleWorks.length > 1 && <button className="gallery-lightbox-previous" type="button" onClick={(event) => { event.stopPropagation(); moveLightbox(-1); }} aria-label="Œuvre précédente"><ChevronLeft size={26} aria-hidden="true" /></button>}
      <figure onClick={(event) => event.stopPropagation()}>
        <img src={activeWork.image} alt={activeWork.title} />
        <figcaption>{activeWork.title}</figcaption>
      </figure>
      {visibleWorks.length > 1 && <button className="gallery-lightbox-next" type="button" onClick={(event) => { event.stopPropagation(); moveLightbox(1); }} aria-label="Œuvre suivante"><ChevronRight size={26} aria-hidden="true" /></button>}
    </div>}
  </>;
}
