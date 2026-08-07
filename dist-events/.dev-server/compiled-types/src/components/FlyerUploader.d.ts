import React from "react";
import type { ParsedFlyer } from "@/lib/parser";
interface FlyerUploaderProps {
  onDataExtracted: (data: ParsedFlyer) => void;
}
export declare function FlyerUploader({ onDataExtracted }: FlyerUploaderProps): React.JSX.Element;
export {};
