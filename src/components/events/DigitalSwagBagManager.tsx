import React, { useState } from "react";
import { Gift, Plus, Trash2, Mail, ExternalLink, Tag, BarChart3, CheckCircle2, Eye } from "lucide-react";
import {
  DigitalSwagItem,
  calculateSponsorRoiList,
  compileSwagBagHtmlEmail,
} from "@/lib/digitalSwagBag";
import { cn } from "@/lib/utils";

export interface DigitalSwagBagManagerProps {
  eventId?: string;
  eventName?: string;
  initialItems?: DigitalSwagItem[];
  totalDeliveries?: number;
  onSaveItems?: (items: DigitalSwagItem[]) => void;
  className?: string;
}

export const MOCK_SWAG_ITEMS: DigitalSwagItem[] = [
  {
    id: "swag-1",
    event_id: "evt-1",
    sponsor_name: "Red Bull",
    title: "Free Energy Drink Voucher",
    promo_code: "REDBULL50",
    asset_url: "https://cdn.campus.edu/swag/redbull.pdf",
    description: "Show this code for 50% off Red Bull at the campus store",
    click_count: 42,
  },
  {
    id: "swag-2",
    event_id: "evt-1",
    sponsor_name: "GitHub",
    title: "Student Developer Pack Offer",
    promo_code: "GHSTUDENT2026",
    asset_url: "https://education.github.com",
    description: "Unlock free GitHub Copilot and $200 cloud credits",
    click_count: 85,
  },
];

export const DigitalSwagBagManager: React.FC<DigitalSwagBagManagerProps> = ({
  eventId = "evt-1",
  eventName = "Gala Ballroom 2026",
  initialItems = MOCK_SWAG_ITEMS,
  totalDeliveries = 150,
  onSaveItems,
  className,
}) => {
  const [items, setItems] = useState<DigitalSwagItem[]>(initialItems);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  // Form State
  const [sponsorName, setSponsorName] = useState("");
  const [title, setTitle] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [description, setDescription] = useState("");

  const roiList = calculateSponsorRoiList(items, totalDeliveries);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sponsorName.trim() || !title.trim()) return;

    const newItem: DigitalSwagItem = {
      id: `swag-${Date.now()}`,
      event_id: eventId,
      sponsor_name: sponsorName.trim(),
      title: title.trim(),
      asset_url: assetUrl.trim() || null,
      promo_code: promoCode.trim() || null,
      description: description.trim() || null,
      click_count: 0,
    };

    const updated = [...items, newItem];
    setItems(updated);
    if (onSaveItems) onSaveItems(updated);

    // Reset Form
    setSponsorName("");
    setTitle("");
    setAssetUrl("");
    setPromoCode("");
    setDescription("");
    setShowAddForm(false);
  };

  const handleDeleteItem = (id: string) => {
    const updated = items.filter((i) => i.id !== id);
    setItems(updated);
    if (onSaveItems) onSaveItems(updated);
  };

  const emailPreviewHtml = compileSwagBagHtmlEmail(eventName, "Alex Rivera", items);

  return (
    <div className={cn("border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0", className)}>
      {/* Header Bar */}
      <div className="p-5 bg-purple-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-purple-950">
            <Gift className="w-5 h-5 text-purple-600" />
            <span>Digital Swag Bag Manager — {eventName}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Paperless event logistics. Attendees automatically receive sponsor coupons & PDF flyers via email upon kiosk check-in.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="px-3.5 py-1.5 border-2 border-black bg-white hover:bg-gray-100 font-bold text-xs uppercase rounded-md flex items-center gap-1.5"
          >
            <Eye className="w-4 h-4 text-purple-600" />
            Preview Email
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3.5 py-1.5 border-2 border-black bg-black text-white font-bold text-xs uppercase rounded-md hover:bg-gray-800 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {showAddForm ? "Cancel" : "Add Swag Asset"}
          </button>
        </div>
      </div>

      {/* Add Item Form Drawer */}
      {showAddForm && (
        <form onSubmit={handleAddItem} className="p-5 bg-purple-50 border-b-2 border-black space-y-4">
          <h4 className="font-bold text-sm uppercase text-black">Assemble Digital Swag Collateral</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase block mb-1">Sponsor Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Red Bull / AWS"
                value={sponsorName}
                onChange={(e) => setSponsorName(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black bg-white font-sans text-xs rounded-md"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase block mb-1">Asset Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Free Energy Drink Voucher"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black bg-white font-sans text-xs rounded-md"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase block mb-1">Exclusive Promo Code</label>
              <input
                type="text"
                placeholder="e.g. REDBULL50"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black bg-white font-sans text-xs rounded-md"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase block mb-1">PDF / Flyer Download URL</label>
              <input
                type="url"
                placeholder="https://cdn.campus.edu/voucher.pdf"
                value={assetUrl}
                onChange={(e) => setAssetUrl(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black bg-white font-sans text-xs rounded-md"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase block mb-1">Description</label>
            <input
              type="text"
              placeholder="Show this voucher code for 50% off at the door..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black bg-white font-sans text-xs rounded-md"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 border-2 border-black bg-purple-600 text-white font-bold text-xs uppercase rounded-md hover:bg-purple-700 flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            Add to Swag Bag
          </button>
        </form>
      )}

      {/* Main Content Grid: Items List & Sponsor ROI Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* Swag Bag Items List */}
        <div className="lg:col-span-2 p-5 border-b-2 lg:border-b-0 lg:border-r-2 border-black space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
            <Gift className="w-4 h-4 text-purple-600" />
            Active Digital Swag Assets ({items.length})
          </h4>

          {items.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-gray-300 rounded-xl text-xs text-gray-500">
              No digital swag assets added yet. Click "Add Swag Asset" above to assemble your paperless bag.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="p-4 border-2 border-black rounded-lg bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-300">
                      {item.sponsor_name}
                    </span>
                    <h5 className="font-bold text-sm text-black">{item.title}</h5>
                    {item.description && <p className="text-xs font-sans text-gray-600">{item.description}</p>}
                    <div className="flex flex-wrap gap-2 text-xs pt-1">
                      {item.promo_code && (
                        <span className="bg-amber-100 border border-amber-400 text-amber-900 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                          <Tag className="w-3 h-3 text-amber-700" />
                          Code: {item.promo_code}
                        </span>
                      )}
                      {item.asset_url && (
                        <a
                          href={item.asset_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-700 underline font-bold flex items-center gap-1 hover:text-purple-900"
                        >
                          Asset Link <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-2 border border-black bg-rose-100 hover:bg-rose-200 text-rose-800 rounded text-xs flex items-center gap-1"
                    title="Delete item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sponsor ROI Analytics Panel (#3535) */}
        <div className="lg:col-span-1 p-5 bg-white space-y-4">
          <div className="flex items-center gap-2 font-bold uppercase text-xs text-black border-b border-black/10 pb-2">
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            <span>Sponsor ROI & CTR Analytics</span>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-sans text-emerald-950 space-y-1">
            <div className="flex justify-between font-bold">
              <span>Swag Bags Delivered:</span>
              <span>{totalDeliveries.toLocaleString()} attendees</span>
            </div>
            <p className="text-[11px] text-emerald-800">
              Track paperless collateral engagement to report concrete ROI back to sponsors.
            </p>
          </div>

          <div className="space-y-3">
            {roiList.map((roi, idx) => (
              <div key={idx} className="p-3 border border-black rounded-lg bg-gray-50 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-black">{roi.sponsorName}</span>
                  <span className="px-2 py-0.5 bg-emerald-100 border border-emerald-400 text-emerald-900 font-bold text-[11px] rounded-full">
                    {roi.ctrPercent}% CTR
                  </span>
                </div>
                <div className="text-[11px] font-sans text-gray-600 flex justify-between">
                  <span>{roi.itemCount} Swag Asset(s)</span>
                  <span>{roi.totalClicks} Clicks</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Email Preview Modal (#3535) */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h3 className="font-bold text-base uppercase flex items-center gap-2">
                <Mail className="w-5 h-5 text-purple-600" />
                Live Swag Bag Email Preview
              </h3>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-3 py-1 border border-black bg-gray-100 hover:bg-gray-200 rounded font-bold text-xs"
              >
                Close Preview
              </button>
            </div>

            <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
              <div dangerouslySetInnerHTML={{ __html: emailPreviewHtml }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
