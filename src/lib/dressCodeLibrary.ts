export interface DressCodeDefinition {
  name: string;
  description: string;
  guidelines: string;
  images: string[];
}

export const DRESS_CODE_LIBRARY: Record<string, DressCodeDefinition> = {
  casual: {
    name: "Casual",
    description: "Relaxed, comfortable everyday clothing.",
    guidelines:
      "T-shirts, jeans, clean sneakers, casual dresses, or sweaters. Avoid ripped or dirty items.",
    images: ["/images/dress-code/casual_1.jpg", "/images/dress-code/casual_2.jpg"],
  },
  smart_casual: {
    name: "Smart Casual",
    description: "Elevated, neat casual attire that is presentable but not stiff.",
    guidelines:
      "Polos, button-downs, dark jeans (no rips), chinos, blouses, simple dresses, loafers, flats, or clean fashion sneakers.",
    images: ["/images/dress-code/smart_casual_1.jpg", "/images/dress-code/smart_casual_2.jpg"],
  },
  business_casual: {
    name: "Business Casual",
    description: "Professional, neat, and corporate-appropriate without being fully formal.",
    guidelines: "Slacks or a skirt, collared shirt or blouse. No jeans, no sneakers.",
    images: [
      "/images/dress-code/business_casual_1.jpg",
      "/images/dress-code/business_casual_2.jpg",
    ],
  },
  formal: {
    name: "Formal / Black Tie",
    description: "Elegant and sophisticated dress for high-profile evening events.",
    guidelines:
      "Suits with ties, tuxedos, formal evening gowns, elegant cocktail dresses, and polished dress shoes.",
    images: ["/images/dress-code/formal_1.jpg", "/images/dress-code/formal_2.jpg"],
  },
};
