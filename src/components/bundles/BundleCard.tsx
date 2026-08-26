import React from "react";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface BundleItem {
  id: string;
  club_id: string;
  allocation_amount: number;
  clubs?: {
    id: string;
    title: string;
    slug: string;
  };
}

export interface Bundle {
  id: string;
  title: string;
  description: string;
  price: number;
  active: boolean;
  bundle_items?: BundleItem[];
}

interface BundleCardProps {
  bundle: Bundle;
}

export const BundleCard: React.FC<BundleCardProps> = ({ bundle }) => {
  return (
    <Card className="neu-border flex flex-col justify-between h-full group hover:shadow-[6px_6px_0_0_var(--color-ink)] hover:-translate-y-1 transition-all">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl font-bold">{bundle.title}</CardTitle>
          <Badge variant="default" className="bg-green-600 font-mono">
            ${bundle.price.toFixed(2)}
          </Badge>
        </div>
        <CardDescription className="line-clamp-2 mt-2">
          {bundle.description || "A multi-club membership bundle."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <p className="text-sm font-semibold mb-2">Includes Memberships To:</p>
        <div className="flex flex-wrap gap-1">
          {bundle.bundle_items?.map((item) => (
            <Badge key={item.id} variant="secondary" className="text-xs">
              {item.clubs?.title || "Unknown Club"}
            </Badge>
          ))}
          {(!bundle.bundle_items || bundle.bundle_items.length === 0) && (
            <span className="text-sm text-gray-500 italic">No clubs listed</span>
          )}
        </div>
      </CardContent>

      <CardFooter>
        <Link
          to={`/bundles/${bundle.id}`}
          className="neu-border neu-press w-full py-2 text-center bg-blue-600 text-white font-bold tracking-wide"
        >
          View Details
        </Link>
      </CardFooter>
    </Card>
  );
};
