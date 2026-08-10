import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { useAuthHydration } from "@/hooks/useAuthHydration";
import { toast } from "sonner";
import {
  Search,
  Plus,
  X,
  MapPin,
  Tag,
  Clock,
  CheckCircle,
  AlertCircle,
  Filter,
  Package,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ItemType = "lost" | "found";
export type ItemStatus = "active" | "resolved";

export const CATEGORIES = [
  "Electronics",
  "Documents",
  "Keys",
  "Clothing",
  "Accessories",
  "Books",
  "Sports",
  "Other",
] as const;

export type ItemCategory = (typeof CATEGORIES)[number];

export interface LostFoundItem {
  id: string;
  user_id: string;
  type: ItemType;
  title: string;
  description: string;
  category: ItemCategory;
  location: string | null;
  image_url: string | null;
  contact_info: string | null;
  status: ItemStatus;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string | null; handle: string | null } | null;
}

interface NewItemForm {
  type: ItemType;
  title: string;
  description: string;
  category: ItemCategory;
  location: string;
  contact_info: string;
}

const EMPTY_FORM: NewItemForm = {
  type: "lost",
  title: "",
  description: "",
  category: "Other",
  location: "",
  contact_info: "",
};

// ─── Badge helpers ─────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: ItemType }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border-2 border-black px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${
        type === "lost" ? "bg-peach text-black" : "bg-lime text-black"
      }`}
    >
      {type === "lost" ? <AlertCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
      {type === "lost" ? "Lost" : "Found"}
    </span>
  );
}

function CategoryBadge({ category }: { category: ItemCategory }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold text-black/70 ring-1 ring-black/10">
      <Tag className="h-3 w-3" />
      {category}
    </span>
  );
}

// ─── Item Card ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onResolve,
  currentUserId,
}: {
  item: LostFoundItem;
  onResolve: (id: string) => void;
  currentUserId: string | null;
}) {
  const isOwner = currentUserId === item.user_id;
  const timeAgo = (() => {
    const diff = Date.now() - new Date(item.created_at).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  })();

  return (
    <article
      className="group relative flex flex-col gap-3 rounded-xl border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-150 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
      aria-label={`${item.type === "lost" ? "Lost" : "Found"}: ${item.title}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={item.type} />
          <CategoryBadge category={item.category} />
        </div>
        {isOwner && item.status === "active" && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-2 border-black font-mono text-[10px] font-black uppercase hover:bg-lime"
            onClick={() => onResolve(item.id)}
            id={`resolve-btn-${item.id}`}
          >
            Mark Resolved
          </Button>
        )}
      </div>

      {/* Title & description */}
      <div>
        <h3 className="font-mono text-lg font-black leading-tight text-black">{item.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-black/70">{item.description}</p>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-[11px] text-black/60">
        {item.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {item.location}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeAgo}
        </span>
        {item.profiles?.full_name && (
          <span className="font-semibold text-black/80">by {item.profiles.full_name}</span>
        )}
      </div>

      {/* Contact */}
      {item.contact_info && (
        <div className="rounded-lg border border-black/10 bg-cream px-3 py-2 text-xs">
          <span className="font-bold">Contact: </span>
          {item.contact_info}
        </div>
      )}
    </article>
  );
}

// ─── New Item Dialog ───────────────────────────────────────────────────────────

function NewItemDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: NewItemForm) => void;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState<NewItemForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof NewItemForm, string>>>({});

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!form.title.trim() || form.title.trim().length < 3) {
      errs.title = "Title must be at least 3 characters.";
    }
    if (!form.description.trim() || form.description.trim().length < 10) {
      errs.description = "Description must be at least 10 characters.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(form);
    }
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="neu-border bg-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-xl font-black uppercase text-black">
            Post an Item
          </DialogTitle>
          <DialogDescription className="text-sm text-black/60">
            Report something you've lost or found on campus.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          {/* Lost / Found toggle */}
          <div className="flex gap-2">
            {(["lost", "found"] as ItemType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t }))}
                className={`flex-1 rounded-lg border-2 border-black py-2.5 font-mono text-sm font-black uppercase transition-colors ${
                  form.type === t
                    ? t === "lost"
                      ? "bg-peach"
                      : "bg-lime"
                    : "bg-white hover:bg-cream"
                }`}
                id={`type-btn-${t}`}
              >
                {t === "lost" ? "🔍 I Lost Something" : "📦 I Found Something"}
              </button>
            ))}
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1">
            <label htmlFor="lf-title" className="text-xs font-bold uppercase tracking-wider">
              Item Name / Title *
            </label>
            <Input
              id="lf-title"
              placeholder="e.g. Black AirPods case, Student ID card"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="border-2 border-black font-mono"
              maxLength={120}
            />
            {errors.title && <span className="text-xs text-red-600">{errors.title}</span>}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label htmlFor="lf-desc" className="text-xs font-bold uppercase tracking-wider">
              Description *
            </label>
            <textarea
              id="lf-desc"
              placeholder="Describe the item — color, brand, distinguishing features..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="min-h-[80px] w-full rounded-md border-2 border-black bg-white px-3 py-2 font-mono text-sm placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black"
              maxLength={1000}
            />
            {errors.description && (
              <span className="text-xs text-red-600">{errors.description}</span>
            )}
          </div>

          {/* Category & Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="lf-category" className="text-xs font-bold uppercase tracking-wider">
                Category
              </label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v as ItemCategory }))}
              >
                <SelectTrigger id="lf-category" className="border-2 border-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="lf-location" className="text-xs font-bold uppercase tracking-wider">
                Location
              </label>
              <Input
                id="lf-location"
                placeholder="e.g. Library 3rd floor"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="border-2 border-black font-mono"
                maxLength={120}
              />
            </div>
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-1">
            <label htmlFor="lf-contact" className="text-xs font-bold uppercase tracking-wider">
              Contact Info (optional)
            </label>
            <Input
              id="lf-contact"
              placeholder="e.g. email or phone number"
              value={form.contact_info}
              onChange={(e) => setForm((f) => ({ ...f, contact_info: e.target.value }))}
              className="border-2 border-black font-mono"
              maxLength={200}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="border-2 border-black"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="neu-border bg-lime font-mono font-black uppercase text-black hover:bg-lime/80"
              id="lf-submit-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting…
                </>
              ) : (
                "Post Item"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function LostFoundPage() {
  const supabase = createClient();
  const { user } = useAuthHydration();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ItemType | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  // ── Fetch items ──────────────────────────────────────────────────────────────
  const {
    data: items = [],
    refetch,
    isLoading,
  } = useQuery<LostFoundItem[]>({
    queryKey: ["lost_found_items", typeFilter, categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from("lost_found_items")
        .select("*, profiles(full_name, handle)")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (typeFilter !== "all") query = query.eq("type", typeFilter);
      if (categoryFilter !== "all") query = query.eq("category", categoryFilter);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as LostFoundItem[];
    },
  });

  // ── Create item ──────────────────────────────────────────────────────────────
  const { mutate: createItem, isPending: isCreating } = useMutation({
    mutationFn: async (form: NewItemForm) => {
      if (!user) throw new Error("You must be signed in to post an item.");
      const { error } = await supabase.from("lost_found_items").insert({
        user_id: user.id,
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        location: form.location.trim() || null,
        contact_info: form.contact_info.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item posted! We hope you find what you're looking for 🙏");
      setDialogOpen(false);
      refetch();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to post item. Please try again.");
    },
  });

  // ── Resolve item ─────────────────────────────────────────────────────────────
  const { mutate: resolveItem } = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lost_found_items")
        .update({ status: "resolved" })
        .eq("id", id)
        .eq("user_id", user?.id ?? "");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item marked as resolved! 🎉");
      refetch();
    },
    onError: () => {
      toast.error("Failed to resolve item. Please try again.");
    },
  });

  // ── Realtime subscription ────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("lost_found_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "lost_found_items" }, () => {
        refetch();
      })
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [supabase, refetch]);

  // ── Filter items ─────────────────────────────────────────────────────────────
  const filteredItems = (items as LostFoundItem[]).filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      (item.location ?? "").toLowerCase().includes(q)
    );
  });

  const lostCount = filteredItems.filter((i) => i.type === "lost").length;
  const foundCount = filteredItems.filter((i) => i.type === "found").length;

  return (
    <SiteShell>
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        {/* Page Header */}
        <header className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Package className="h-7 w-7" aria-hidden="true" />
                <h1 className="font-mono text-3xl font-black uppercase leading-none tracking-tight text-black">
                  Lost &amp; Found
                </h1>
              </div>
              <p className="text-sm text-black/60">
                Report something you've lost or help reunite others with their belongings.
              </p>
            </div>
            <Button
              onClick={() => setDialogOpen(true)}
              disabled={!user}
              className="neu-border bg-lime font-mono font-black uppercase text-black hover:bg-lime/80 disabled:opacity-50"
              id="post-item-btn"
              title={!user ? "Sign in to post an item" : undefined}
            >
              <Plus className="mr-2 h-4 w-4" />
              Post Item
            </Button>
          </div>

          {/* Stats strip */}
          <div className="mt-4 flex gap-4">
            <span
              className={`flex items-center gap-1.5 rounded-full border-2 border-black bg-peach px-3 py-1 font-mono text-sm font-black`}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              {lostCount} Lost
            </span>
            <span className="flex items-center gap-1.5 rounded-full border-2 border-black bg-lime px-3 py-1 font-mono text-sm font-black">
              <CheckCircle className="h-3.5 w-3.5" />
              {foundCount} Found
            </span>
          </div>
        </header>

        {/* Filters */}
        <section aria-label="Filters" className="mb-6 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40"
              aria-hidden="true"
            />
            <Input
              id="lf-search"
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-2 border-black pl-9 font-mono"
              aria-label="Search lost and found items"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-black/40 hover:text-black"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-black/50" aria-hidden="true" />
            {(["all", "lost", "found"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-full border-2 border-black px-3 py-1 font-mono text-xs font-black uppercase transition-colors ${
                  typeFilter === t ? "bg-black text-white" : "bg-white hover:bg-cream"
                }`}
                id={`filter-type-${t}`}
              >
                {t === "all" ? "All" : t === "lost" ? "Lost" : "Found"}
              </button>
            ))}
          </div>

          {/* Category select */}
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as ItemCategory | "all")}
          >
            <SelectTrigger
              id="lf-cat-filter"
              className="w-36 border-2 border-black font-mono text-xs"
            >
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {/* Items grid */}
        <main aria-label="Lost and found items">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-black/40" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-black/30 py-24 text-center">
              <Package className="h-14 w-14 text-black/20" />
              <div>
                <p className="font-mono text-xl font-black uppercase text-black/40">
                  {search ? `No results for "${search}"` : "Nothing here yet"}
                </p>
                <p className="mt-1 text-sm text-black/40">
                  {search
                    ? "Try a different search term."
                    : "Be the first to post a lost or found item!"}
                </p>
              </div>
              {search && (
                <Button
                  variant="outline"
                  onClick={() => setSearch("")}
                  className="border-2 border-black"
                >
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onResolve={(id) => resolveItem(id)}
                  currentUserId={user?.id ?? null}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* New Item Dialog */}
      <NewItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={(form) => createItem(form)}
        isSubmitting={isCreating}
      />
    </SiteShell>
  );
}
