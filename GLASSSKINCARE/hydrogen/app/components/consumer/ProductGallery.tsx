import { useState } from "react";

interface GalleryImage {
  url: string;
  altText: string | null;
  id?: string;
}

interface ProductGalleryProps {
  images: GalleryImage[];
  productTitle: string;
}

export function ProductGallery({ images, productTitle }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  if (!images.length) {
    return (
      <div className="aspect-square w-full rounded-xl bg-brand-pink/20 flex items-center justify-center font-bold text-brand-text border-4 border-brand-text shadow-play">
        NO IMAGE
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Main image */}
      <div className="aspect-square w-full overflow-hidden rounded-xl bg-white border-4 border-brand-text shadow-play relative">
        <img
          key={active.url}
          src={active.url}
          alt={active.altText ?? productTitle}
          className="h-full w-full object-cover"
        />
        <div className="absolute top-4 left-4 bg-brand-yellow text-brand-text text-[10px] px-3 py-1 -rotate-2 font-bold border-2 border-brand-text shadow-play">
          Best Seller
        </div>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1 mt-2">
          {images.map((img, idx) => (
            <button
              key={img.id ?? img.url}
              onClick={() => setActiveIndex(idx)}
              className={`flex-shrink-0 h-20 w-20 rounded-lg overflow-hidden border-2 transition-all ${
                idx === activeIndex
                  ? "border-brand-text shadow-play -translate-y-1"
                  : "border-brand-text/30 opacity-70 hover:opacity-100 hover:border-brand-text"
              }`}
              aria-label={`View image ${idx + 1}`}
            >
              <img
                src={img.url}
                alt={img.altText ?? `${productTitle} ${idx + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
