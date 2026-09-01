import { CustomerHeader } from "@/components/customer/header";
import { CustomerFooter } from "@/components/customer/footer";
import { RESTAURANT } from "@/constants";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FoodEstablishment",
    "name": RESTAURANT.name,
    "image": "https://somo.pk/logo.jpeg",
    "@id": "https://somo.pk/#restaurant",
    "url": "https://somo.pk",
    "telephone": RESTAURANT.phone,
    "priceRange": "$$",
    "menu": "https://somo.pk/menu",
    "servesCuisine": ["Pizza", "Burger", "Fast Food", "International Cuisine"],
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "15-D Main Commercial Boulevard",
      "addressLocality": "Lahore Garden",
      "addressRegion": "Punjab",
      "addressCountry": "PK"
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday"
      ],
      "opens": "13:00",
      "closes": "22:00"
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CustomerHeader />
      <main className="flex-1">{children}</main>
      <CustomerFooter />
    </div>
  );
}
