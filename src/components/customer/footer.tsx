import Link from "next/link";
import { MapPin, Phone, Mail } from "lucide-react";
import { RESTAURANT } from "@/constants";

export function CustomerFooter() {
  return (
    <footer className="mt-auto border-t bg-gradient-to-b from-white to-slate-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-3 lg:px-8">
        <div>
          <h3 className="text-xl font-black bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            {RESTAURANT.name}
          </h3>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Modern dining experience with premium quality food. Fast delivery, dine-in & takeaway services available.
          </p>
        </div>
        <div>
          <h4 className="font-bold text-foreground mb-3">Quick Links</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li>
              <Link href="/menu" className="hover:text-primary transition-colors flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                Menu
              </Link>
            </li>
            <li>
              <Link href="/deals" className="hover:text-primary transition-colors flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                Deals
              </Link>
            </li>
            <li>
              <Link href="/track" className="hover:text-primary transition-colors flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                Track Order
              </Link>
            </li>
          </ul>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3 text-muted-foreground hover:text-primary transition-colors group">
            <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="leading-relaxed">{RESTAURANT.location}</span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Phone className="h-5 w-5 text-primary shrink-0" />
            <div className="flex flex-col gap-1">
              <a href={`tel:${RESTAURANT.phone}`} className="hover:text-primary transition-colors font-medium">
                {RESTAURANT.phone}
              </a>
              <a href={`tel:${RESTAURANT.phone2}`} className="hover:text-primary transition-colors font-medium">
                {RESTAURANT.phone2}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors group">
            <Mail className="h-5 w-5 text-primary shrink-0 group-hover:scale-110 transition-transform" />
            <a href={`mailto:${RESTAURANT.email}`} className="font-medium">
              {RESTAURANT.email}
            </a>
          </div>
        </div>
      </div>
      <div className="border-t bg-white/80 py-4 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} <span className="font-bold text-primary">{RESTAURANT.name}</span>. All rights reserved.</p>
      </div>
    </footer>
  );
}
